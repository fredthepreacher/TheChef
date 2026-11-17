-- Phase 3 revenue hardening. The original Phase 3 migration is already hosted;
-- all corrections remain additive and preserve its immutable history.

create or replace function crm_private.prepare_payment_transaction() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.transaction_type='refund' and new.amount_cents > 0 then new.amount_cents=-new.amount_cents; end if;
  if new.transaction_type='payment' and new.amount_cents < 0 then raise exception 'Payment amount must be positive'; end if;
  if new.source='stripe' and (new.provider_event_id is null or new.recorded_by is not null) then
    raise exception 'Stripe entries require a provider event and no operator actor';
  end if;
  if new.source='manual' and (
    new.recorded_by is null or
    new.recorded_by is distinct from auth.uid() or
    not crm_private.is_operator()
  ) then
    raise exception 'Manual entries require the current CRM operator';
  end if;
  return new;
end $$;
revoke all on function crm_private.prepare_payment_transaction() from public,anon,authenticated;

drop function public.process_stripe_checkout_event(text,text,text,text,text,boolean);
create function public.process_stripe_checkout_event(
  p_provider_event_id text,
  p_event_type text,
  p_payload_sha256 text,
  p_provider_session_id text,
  p_provider_payment_id text,
  p_paid boolean,
  p_amount_total bigint,
  p_currency text
) returns boolean language plpgsql security definer set search_path='' as $$
declare request_row public.payment_requests;
begin
  if p_payload_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'Invalid event digest'; end if;
  if p_event_type not in ('checkout.session.completed','checkout.session.expired') then
    raise exception 'Unsupported Stripe event';
  end if;
  insert into crm_private.stripe_webhook_events(provider_event_id,event_type,payload_sha256)
    values(p_provider_event_id,p_event_type,p_payload_sha256)
    on conflict(provider_event_id) do nothing;
  if not found then return false; end if;
  select * into request_row from public.payment_requests
    where provider_checkout_session_id=p_provider_session_id for update;
  if not found then raise exception 'Unknown checkout session'; end if;
  if p_event_type='checkout.session.completed' and p_paid then
    if request_row.status<>'open' then raise exception 'Checkout request is not open'; end if;
    if p_provider_payment_id is null then raise exception 'Paid checkout is missing a payment identifier'; end if;
    if p_amount_total is distinct from request_row.amount_cents then raise exception 'Checkout amount mismatch'; end if;
    if upper(coalesce(p_currency,'')) is distinct from request_row.currency then raise exception 'Checkout currency mismatch'; end if;
    insert into public.payment_transactions(event_financial_id,transaction_type,source,amount_cents,
      currency,status,provider_payment_id,provider_event_id,idempotency_key,note)
      values(request_row.event_financial_id,'payment','stripe',request_row.amount_cents,request_row.currency,'posted',
        p_provider_payment_id,p_provider_event_id,'stripe-event:'||p_provider_event_id,
        initcap(request_row.purpose)||' paid through Stripe Checkout');
    update public.payment_requests set status='completed',updated_at=now() where id=request_row.id;
  elsif p_event_type='checkout.session.expired' and request_row.status='open' then
    update public.payment_requests set status='expired',updated_at=now() where id=request_row.id;
  end if;
  return true;
end $$;
revoke all on function public.process_stripe_checkout_event(text,text,text,text,text,boolean,bigint,text)
  from public,anon,authenticated;
grant execute on function public.process_stripe_checkout_event(text,text,text,text,text,boolean,bigint,text)
  to service_role;

-- Lifecycle emails remain operator-approved. Activating these rules schedules
-- drafts only; no commercially significant message is sent autonomously.
update public.automation_rules
set active=true,updated_at=now()
where requires_operator_approval and action_key in (
  'draft_quote_follow_up','draft_booking_confirmation','draft_thank_you',
  'draft_review_request','draft_rebooking_message'
);

insert into public.automation_rules(
  name,trigger_key,action_key,delay_minutes,requires_operator_approval,active,created_by
)
select 'Upcoming event reminder','event_booked','draft_upcoming_event_reminder',0,true,true,p.id
from public.profiles p
where p.active and p.role='owner'
order by p.created_at
limit 1
on conflict(name) do update set
  trigger_key=excluded.trigger_key,
  action_key=excluded.action_key,
  delay_minutes=excluded.delay_minutes,
  requires_operator_approval=true,
  active=true,
  updated_at=now();

-- A brand-new database has no owner profile while migrations run. Seed the
-- same approval-gated defaults when its first active owner is provisioned.
create function crm_private.ensure_owner_automation_rules() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.role='owner' and new.active then
    insert into public.automation_rules(
      name,trigger_key,action_key,delay_minutes,requires_operator_approval,active,created_by
    )
    select seed.name,seed.trigger_key,seed.action_key,seed.delay_minutes,true,true,new.id
    from (values
      ('Quote follow-up','quote_sent','draft_quote_follow_up',2880),
      ('Booking confirmation','deposit_satisfied','draft_booking_confirmation',0),
      ('Upcoming event reminder','event_booked','draft_upcoming_event_reminder',0),
      ('Event thank-you','event_completed','draft_thank_you',1440),
      ('Review request','thank_you_sent','draft_review_request',4320),
      ('Rebooking reminder','event_completed','draft_rebooking_message',129600)
    ) as seed(name,trigger_key,action_key,delay_minutes)
    on conflict(name) do nothing;
  end if;
  return new;
end $$;
revoke all on function crm_private.ensure_owner_automation_rules() from public,anon,authenticated;
create trigger profiles_seed_automation_rules
after insert or update of role,active on public.profiles
for each row execute function crm_private.ensure_owner_automation_rules();

create or replace function crm_private.schedule_actions(
  p_trigger_key text,p_entity_type text,p_entity_id uuid
) returns void language plpgsql security definer set search_path='' as $$
declare r public.automation_rules; scheduled_for timestamptz;
begin
  for r in select * from public.automation_rules where active and trigger_key=p_trigger_key loop
    scheduled_for=now()+make_interval(mins=>r.delay_minutes);
    if r.action_key='draft_upcoming_event_reminder' and p_entity_type='event' then
      select greatest(now(),e.event_date::timestamptz-interval '7 days')
      into scheduled_for from public.events e where e.id=p_entity_id;
    end if;
    insert into crm_private.scheduled_actions(automation_rule_id,entity_type,entity_id,
      idempotency_key,due_at,status)
      values(r.id,p_entity_type,p_entity_id,r.id::text||':'||p_entity_id::text,
        scheduled_for,case when r.requires_operator_approval then 'awaiting_approval' else 'pending' end)
      on conflict(idempotency_key) do nothing;
  end loop;
end $$;
revoke all on function crm_private.schedule_actions(text,text,uuid) from public,anon,authenticated;

create or replace function crm_private.schedule_event_lifecycle() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='booked' and old.status<>'booked' then
    perform crm_private.schedule_actions('event_booked','event',new.id);
  end if;
  if new.status='completed' and old.status<>'completed' then
    perform crm_private.schedule_actions('event_completed','event',new.id);
  end if;
  if new.status in ('cancelled','archived') and old.status<>new.status then
    update crm_private.scheduled_actions set status='cancelled',updated_at=now()
      where entity_type='event' and entity_id=new.id and status in ('pending','awaiting_approval');
  end if;
  return new;
end $$;
revoke all on function crm_private.schedule_event_lifecycle() from public,anon,authenticated;
