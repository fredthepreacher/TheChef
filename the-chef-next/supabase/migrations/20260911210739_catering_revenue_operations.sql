-- Phase 3: catering revenue operations. All money is stored as integer cents.
-- Public proposal tokens are opaque; only their SHA-256 hashes are persisted.

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number bigint generated always as identity unique,
  client_id uuid not null references public.clients(id),
  lead_id uuid not null references public.leads(id),
  event_id uuid references public.events(id),
  current_version_id uuid,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(lead_id)
);
create index quotes_client_idx on public.quotes(client_id,created_at desc);
create index quotes_event_idx on public.quotes(event_id) where event_id is not null;

create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id),
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in (
    'draft','ready_for_review','sent','viewed','revision_requested',
    'approved','declined','expired','superseded'
  )),
  title text not null default 'Catering proposal' check (length(trim(title)) between 1 and 200),
  introduction text not null default '' check (length(introduction) <= 8000),
  client_notes text not null default '' check (length(client_notes) <= 8000),
  internal_notes text not null default '' check (length(internal_notes) <= 8000),
  currency text not null default 'USD' check (currency = 'USD'),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  tax_rate_bps integer not null default 0 check (tax_rate_bps between 0 and 10000),
  service_charge_rate_bps integer not null default 0 check (service_charge_rate_bps between 0 and 10000),
  gratuity_cents bigint not null default 0 check (gratuity_cents >= 0),
  delivery_fee_cents bigint not null default 0 check (delivery_fee_cents >= 0),
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  taxable_cents bigint not null default 0 check (taxable_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  service_charge_cents bigint not null default 0 check (service_charge_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  deposit_type text not null default 'percentage' check (deposit_type in ('fixed','percentage')),
  deposit_value bigint not null default 2500 check (deposit_value >= 0),
  deposit_required_cents bigint not null default 0 check (deposit_required_cents >= 0),
  expires_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  decided_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(quote_id,version),
  check (expires_at is null or expires_at > created_at)
);
create index quote_versions_quote_idx on public.quote_versions(quote_id,version desc);
create index quote_versions_status_idx on public.quote_versions(status,updated_at desc);
alter table public.quotes add constraint quotes_current_version_fk
  foreign key(current_version_id) references public.quote_versions(id);

create table public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references public.quote_versions(id),
  description text not null check (length(trim(description)) between 1 and 500),
  details text not null default '' check (length(details) <= 4000),
  quantity_milli integer not null default 1000 check (quantity_milli > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  line_total_cents bigint not null default 0 check (line_total_cents >= 0),
  taxable boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quote_line_items_version_idx
  on public.quote_line_items(quote_version_id,display_order,id);

create table public.event_financials (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id),
  approved_quote_version_id uuid references public.quote_versions(id),
  commercial_status text not null default 'proposal' check (commercial_status in (
    'proposal','approved_deposit_pending','booked','balance_due',
    'paid','completed','cancelled','refunded'
  )),
  deposit_due_at timestamptz,
  balance_due_at timestamptz,
  gross_due_cents bigint not null default 0 check (gross_due_cents >= 0),
  deposit_required_cents bigint not null default 0 check (deposit_required_cents >= 0),
  paid_cents bigint not null default 0,
  refunded_cents bigint not null default 0 check (refunded_cents >= 0),
  balance_remaining_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index event_financials_status_idx on public.event_financials(commercial_status,updated_at desc);

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  event_financial_id uuid not null references public.event_financials(id),
  transaction_type text not null check (transaction_type in ('payment','refund','adjustment')),
  source text not null check (source in ('stripe','manual')),
  amount_cents bigint not null check (amount_cents <> 0),
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'posted' check (status in ('pending','posted','failed','void')),
  provider_payment_id text,
  provider_event_id text,
  idempotency_key text not null unique,
  note text not null default '' check (length(note) <= 2000),
  recorded_by uuid references public.profiles(id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index payment_provider_event_idx on public.payment_transactions(provider_event_id)
  where provider_event_id is not null;
create unique index payment_provider_payment_idx on public.payment_transactions(provider_payment_id,transaction_type)
  where provider_payment_id is not null and status='posted';
create index payment_financial_idx on public.payment_transactions(event_financial_id,occurred_at desc);

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  event_financial_id uuid not null references public.event_financials(id),
  purpose text not null check(purpose in ('deposit','balance')),
  amount_cents bigint not null check(amount_cents > 0),
  currency text not null default 'USD' check(currency='USD'),
  status text not null default 'created' check(status in ('created','open','completed','expired','cancelled')),
  provider text not null default 'stripe' check(provider='stripe'),
  provider_checkout_session_id text unique,
  checkout_url text,
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_requests_financial_idx on public.payment_requests(event_financial_id,created_at desc);

create table crm_private.stripe_webhook_events (
  provider_event_id text primary key,
  event_type text not null,
  payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
  processed_at timestamptz not null default now()
);
alter table crm_private.stripe_webhook_events enable row level security;
revoke all on crm_private.stripe_webhook_events from public,anon,authenticated;
grant all on crm_private.stripe_webhook_events to service_role;

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id),
  quote_id uuid not null references public.quotes(id),
  current_version_id uuid,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agreement_versions (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id),
  quote_version_id uuid not null references public.quote_versions(id),
  version integer not null check(version > 0),
  status text not null default 'draft' check(status in ('draft','sent','accepted','superseded','void')),
  title text not null default 'Catering service agreement' check(length(trim(title)) between 1 and 200),
  agreement_snapshot jsonb not null,
  content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
  accepted_typed_name text,
  consent_text text,
  accepted_at timestamptz,
  accepted_ip_hash text,
  accepted_user_agent text,
  accepted_proposal_token_id uuid,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(agreement_id,version),
  check (
    status <> 'accepted' or
    (length(trim(accepted_typed_name)) > 0 and length(trim(consent_text)) > 0 and accepted_at is not null)
  )
);
create index agreement_versions_agreement_idx on public.agreement_versions(agreement_id,version desc);
alter table public.agreements add constraint agreements_current_version_fk
  foreign key(current_version_id) references public.agreement_versions(id);

create table crm_private.proposal_access_tokens (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references public.quote_versions(id),
  token_sha256 text not null unique check(token_sha256 ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  access_count integer not null default 0 check(access_count >= 0)
);
create index proposal_access_version_idx on crm_private.proposal_access_tokens(quote_version_id);

create table crm_private.proposal_access_events (
  id uuid primary key default gen_random_uuid(),
  proposal_token_id uuid not null references crm_private.proposal_access_tokens(id),
  action text not null check(action in ('viewed','accepted','declined','revision_requested')),
  network_hash text not null check(network_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index proposal_access_events_token_idx on crm_private.proposal_access_events(proposal_token_id,created_at desc);
alter table crm_private.proposal_access_events enable row level security;
revoke all on crm_private.proposal_access_events from public,anon,authenticated;
grant all on crm_private.proposal_access_events to service_role;

create table public.email_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references public.communications(id),
  attempt_number integer not null check(attempt_number > 0),
  provider text not null check(provider in ('resend')),
  provider_message_id text,
  status text not null check(status in ('submitted','delivered','deferred','bounced','complained','failed')),
  error_code text,
  error_message text,
  attempted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(communication_id,attempt_number)
);
create unique index email_delivery_provider_idx on public.email_delivery_attempts(provider,provider_message_id)
  where provider_message_id is not null;

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check(length(trim(name)) between 1 and 200),
  trigger_key text not null check(length(trim(trigger_key)) between 1 and 100),
  action_key text not null check(length(trim(action_key)) between 1 and 100),
  delay_minutes integer not null default 0 check(delay_minutes between 0 and 525600),
  requires_operator_approval boolean not null default true,
  active boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  generation_type text not null check(generation_type in (
    'event_summary','draft_inquiry_response','draft_quote_follow_up',
    'draft_booking_confirmation','draft_thank_you','missing_information','next_actions'
  )),
  model text not null check(length(model) between 3 and 200),
  input_sha256 text not null check(input_sha256 ~ '^[0-9a-f]{64}$'),
  output_text text not null check(length(output_text) between 1 and 20000),
  input_tokens integer check(input_tokens is null or input_tokens>=0),
  output_tokens integer check(output_tokens is null or output_tokens>=0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_generations_event_idx on public.ai_generations(event_id,created_at desc);

create table crm_private.scheduled_actions (
  id uuid primary key default gen_random_uuid(),
  automation_rule_id uuid not null references public.automation_rules(id),
  entity_type text not null,
  entity_id uuid not null,
  idempotency_key text not null unique,
  due_at timestamptz not null,
  status text not null default 'pending' check(status in ('pending','awaiting_approval','processing','completed','cancelled','failed')),
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0 check(attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scheduled_actions_due_idx on crm_private.scheduled_actions(status,due_at);

create function crm_private.schedule_actions(p_trigger_key text,p_entity_type text,p_entity_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.automation_rules;
begin
  for r in select * from public.automation_rules where active and trigger_key=p_trigger_key loop
    insert into crm_private.scheduled_actions(automation_rule_id,entity_type,entity_id,
      idempotency_key,due_at,status)
      values(r.id,p_entity_type,p_entity_id,r.id::text||':'||p_entity_id::text,
        now()+make_interval(mins=>r.delay_minutes),
        case when r.requires_operator_approval then 'awaiting_approval' else 'pending' end)
      on conflict(idempotency_key) do nothing;
  end loop;
end $$;
revoke all on function crm_private.schedule_actions(text,text,uuid) from public,anon,authenticated;

create table crm_private.resend_webhook_events (
  provider_event_id text primary key,
  event_type text not null,
  payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
  processed_at timestamptz not null default now()
);
alter table crm_private.resend_webhook_events enable row level security;
revoke all on crm_private.resend_webhook_events from public,anon,authenticated;
grant all on crm_private.resend_webhook_events to service_role;

-- Restrictive privileges and operator RLS for all operator-visible revenue tables.
do $$ declare t text; begin
  foreach t in array array[
    'quotes','quote_versions','quote_line_items','event_financials',
    'payment_transactions','payment_requests','agreements','agreement_versions',
    'email_delivery_attempts','automation_rules','ai_generations'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format(
      'create policy operator_read on public.%I for select to authenticated using ((select crm_private.is_operator()))',t
    );
  end loop;
end $$;

grant insert,update on public.quotes,public.quote_versions,public.quote_line_items,
  public.agreements,public.agreement_versions,public.automation_rules to authenticated;
grant insert on public.payment_transactions to authenticated;
grant insert on public.ai_generations to authenticated;
grant select on sequence public.quotes_quote_number_seq to authenticated;

do $$ declare t text; begin
  foreach t in array array[
    'quotes','quote_versions','quote_line_items','event_financials',
    'agreements','agreement_versions','automation_rules'
  ] loop
    execute format(
      'create policy operator_insert on public.%I for insert to authenticated with check ((select crm_private.is_operator()))',t
    );
    execute format(
      'create policy operator_update on public.%I for update to authenticated using ((select crm_private.is_operator())) with check ((select crm_private.is_operator()))',t
    );
  end loop;
end $$;
create policy operator_insert on public.payment_transactions for insert to authenticated
  with check ((select crm_private.is_operator()));
create policy operator_insert on public.ai_generations for insert to authenticated
  with check ((select crm_private.is_operator()));

alter table crm_private.proposal_access_tokens enable row level security;
alter table crm_private.scheduled_actions enable row level security;
revoke all on crm_private.proposal_access_tokens,crm_private.scheduled_actions from public,anon,authenticated;
grant all on crm_private.proposal_access_tokens,crm_private.scheduled_actions to service_role;
grant select,insert,update on public.quotes,public.quote_versions,public.quote_line_items,
  public.event_financials,public.payment_transactions,public.agreements,
  public.payment_requests,public.agreement_versions,public.email_delivery_attempts,
  public.automation_rules,public.ai_generations
  to service_role;

-- Quote and relationship invariants.
create function crm_private.prepare_quote() returns trigger
language plpgsql security definer set search_path='' as $$
declare l public.leads; e public.events;
begin
  select * into strict l from public.leads where id=new.lead_id;
  new.client_id=l.client_id;
  if new.event_id is not null then
    select * into strict e from public.events where id=new.event_id;
    if e.lead_id <> new.lead_id or e.client_id <> new.client_id then
      raise exception 'Quote event does not match lead and client';
    end if;
  end if;
  if tg_op='UPDATE' then
    if new.lead_id <> old.lead_id or new.client_id <> old.client_id or new.created_by <> old.created_by then
      raise exception 'Quote identity is immutable';
    end if;
    new.updated_at=now();
  end if;
  return new;
end $$;
revoke all on function crm_private.prepare_quote() from public,anon,authenticated;
create trigger quote_consistency before insert or update on public.quotes
  for each row execute function crm_private.prepare_quote();

create function crm_private.prepare_quote_version() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.status <> 'draft' then raise exception 'New quote versions must begin as drafts'; end if;
    new.subtotal_cents=0; new.taxable_cents=0; new.tax_cents=0;
    new.service_charge_cents=0; new.total_cents=0; new.deposit_required_cents=0;
  else
    if old.status <> 'draft' and row(
      new.title,new.introduction,new.client_notes,new.discount_cents,new.tax_rate_bps,
      new.service_charge_rate_bps,new.gratuity_cents,new.delivery_fee_cents,
      new.deposit_type,new.deposit_value,new.expires_at
    ) is distinct from row(
      old.title,old.introduction,old.client_notes,old.discount_cents,old.tax_rate_bps,
      old.service_charge_rate_bps,old.gratuity_cents,old.delivery_fee_cents,
      old.deposit_type,old.deposit_value,old.expires_at
    ) then raise exception 'Issued quote versions are immutable'; end if;
    if new.quote_id <> old.quote_id or new.version <> old.version or new.created_by <> old.created_by then
      raise exception 'Quote version identity is immutable';
    end if;
    if pg_trigger_depth()=1 then
      new.subtotal_cents=old.subtotal_cents; new.taxable_cents=old.taxable_cents;
      new.tax_cents=old.tax_cents; new.service_charge_cents=old.service_charge_cents;
      new.total_cents=old.total_cents; new.deposit_required_cents=old.deposit_required_cents;
    end if;
    if new.status='sent' and old.status <> 'sent' then new.sent_at=coalesce(new.sent_at,now()); end if;
    if new.status='viewed' and old.status not in ('viewed','approved','declined') then new.viewed_at=coalesce(new.viewed_at,now()); end if;
    if new.status in ('approved','declined') and old.status <> new.status then new.decided_at=coalesce(new.decided_at,now()); end if;
    new.updated_at=now();
  end if;
  return new;
end $$;
revoke all on function crm_private.prepare_quote_version() from public,anon,authenticated;
create trigger quote_version_consistency before insert or update on public.quote_versions
  for each row execute function crm_private.prepare_quote_version();

create function crm_private.prepare_quote_line_item() returns trigger
language plpgsql security definer set search_path='' as $$
declare s text;
begin
  select status into strict s from public.quote_versions where id=new.quote_version_id;
  if s <> 'draft' then raise exception 'Issued quote line items are immutable'; end if;
  if tg_op='UPDATE' and new.quote_version_id <> old.quote_version_id then
    raise exception 'Line item version is immutable';
  end if;
  new.line_total_cents=round(new.quantity_milli::numeric*new.unit_price_cents/1000)::bigint;
  if tg_op='UPDATE' then new.updated_at=now(); end if;
  return new;
end $$;
revoke all on function crm_private.prepare_quote_line_item() from public,anon,authenticated;
create trigger quote_line_item_consistency before insert or update on public.quote_line_items
  for each row execute function crm_private.prepare_quote_line_item();

create function crm_private.recalculate_quote_version() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  vid uuid; sub bigint; sum_taxable bigint; disc bigint; taxable_after bigint;
  rate_tax integer; rate_service integer; fee_gratuity bigint; fee_delivery bigint;
  dep_type text; dep_value bigint; tax bigint; service bigint; total bigint; deposit bigint;
begin
  if tg_table_name='quote_versions' then
    vid=new.id;
  else
    vid=case when tg_op='DELETE' then old.quote_version_id else new.quote_version_id end;
  end if;
  select coalesce(sum(line_total_cents),0),coalesce(sum(line_total_cents) filter(where taxable),0)
    into sub,sum_taxable from public.quote_line_items i where i.quote_version_id=vid;
  select least(discount_cents,sub),tax_rate_bps,service_charge_rate_bps,
         gratuity_cents,delivery_fee_cents,deposit_type,deposit_value
    into strict disc,rate_tax,rate_service,fee_gratuity,fee_delivery,dep_type,dep_value
    from public.quote_versions where id=vid for update;
  select greatest(0,sum_taxable - round(disc::numeric * case when sub=0 then 0 else sum_taxable::numeric/sub end)::bigint)
    into taxable_after;
  tax=round(taxable_after::numeric*rate_tax/10000)::bigint;
  service=round(greatest(0,sub-disc)::numeric*rate_service/10000)::bigint;
  total=greatest(0,sub-disc+tax+service+fee_gratuity+fee_delivery);
  deposit=case when dep_type='fixed' then least(dep_value,total)
               else round(total::numeric*least(dep_value,10000)/10000)::bigint end;
  update public.quote_versions set subtotal_cents=sub,taxable_cents=taxable_after,
    tax_cents=tax,service_charge_cents=service,total_cents=total,
    deposit_required_cents=deposit,updated_at=now() where id=vid;
  return coalesce(new,old);
end $$;
revoke all on function crm_private.recalculate_quote_version() from public,anon,authenticated;
create trigger quote_line_item_totals after insert or update or delete on public.quote_line_items
  for each row execute function crm_private.recalculate_quote_version();
create trigger quote_version_setting_totals
  after update of discount_cents,tax_rate_bps,service_charge_rate_bps,gratuity_cents,
    delivery_fee_cents,deposit_type,deposit_value on public.quote_versions
  for each row when (pg_trigger_depth()=0)
  execute function crm_private.recalculate_quote_version();

create function crm_private.validate_current_quote_version() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.current_version_id is not null and not exists(
    select 1 from public.quote_versions where id=new.current_version_id and quote_id=new.id
  ) then raise exception 'Current version must belong to quote'; end if;
  return new;
end $$;
revoke all on function crm_private.validate_current_quote_version() from public,anon,authenticated;
create trigger quote_current_version_consistency before insert or update on public.quotes
  for each row execute function crm_private.validate_current_quote_version();

create function public.create_quote_for_lead(p_lead_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare l public.leads; event_id uuid; quote_id uuid; version_id uuid;
begin
  if not crm_private.is_operator() then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into strict l from public.leads where id=p_lead_id for update;
  if l.status in ('lost','cancelled','archived') then raise exception 'Lead is closed'; end if;
  select id into event_id from public.events where lead_id=l.id;
  if event_id is null then
    insert into public.events(lead_id,client_id,event_type,event_date,guest_count,package_snapshot,menu_snapshot)
      values(l.id,l.client_id,l.event_type,l.requested_date,l.guest_count,l.package_snapshot,'{}'::jsonb)
      returning id into event_id;
  end if;
  select id into quote_id from public.quotes where lead_id=l.id;
  if quote_id is not null then return quote_id; end if;
  insert into public.quotes(client_id,lead_id,event_id,created_by)
    values(l.client_id,l.id,event_id,auth.uid()) returning id into quote_id;
  insert into public.quote_versions(quote_id,version,expires_at,created_by)
    values(quote_id,1,now()+interval '14 days',auth.uid()) returning id into version_id;
  update public.quotes set current_version_id=version_id where id=quote_id;
  return quote_id;
end $$;
revoke all on function public.create_quote_for_lead(uuid) from public,anon;
grant execute on function public.create_quote_for_lead(uuid) to authenticated;

-- Append-only money ledger and materialized event balance.
create function crm_private.prepare_payment_transaction() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.transaction_type='refund' and new.amount_cents > 0 then new.amount_cents=-new.amount_cents; end if;
  if new.transaction_type='payment' and new.amount_cents < 0 then raise exception 'Payment amount must be positive'; end if;
  if new.source='stripe' and (new.provider_event_id is null or new.recorded_by is not null) then
    raise exception 'Stripe entries require a provider event and no operator actor';
  end if;
  if new.source='manual' and new.recorded_by is null then raise exception 'Manual entries require an operator'; end if;
  return new;
end $$;
revoke all on function crm_private.prepare_payment_transaction() from public,anon,authenticated;
create trigger payment_transaction_consistency before insert on public.payment_transactions
  for each row execute function crm_private.prepare_payment_transaction();

create function crm_private.refresh_event_financials() returns trigger
language plpgsql security definer set search_path='' as $$
declare fid uuid; net bigint; refunds bigint; required bigint; gross bigint; current_state text;
begin
  fid=new.event_financial_id;
  select coalesce(sum(amount_cents) filter(where status='posted'),0),
         coalesce(-sum(amount_cents) filter(where status='posted' and amount_cents<0),0)
    into net,refunds from public.payment_transactions where event_financial_id=fid;
  select deposit_required_cents,gross_due_cents,commercial_status into required,gross,current_state
    from public.event_financials where id=fid for update;
  update public.event_financials set paid_cents=greatest(net,0),refunded_cents=refunds,
    balance_remaining_cents=greatest(gross-net,0),
    commercial_status=case
      when current_state in ('cancelled','completed','refunded') then current_state
      when net>=gross and gross>0 then 'paid'
      when net>=required and required>0 then 'booked'
      when current_state='proposal' then current_state
      else 'approved_deposit_pending' end,
    updated_at=now() where id=fid;
  if net>=required and required>0 and current_state not in ('booked','balance_due','paid','completed') then
    perform crm_private.schedule_actions('deposit_satisfied','event',
      (select event_id from public.event_financials where id=fid));
  end if;
  return new;
end $$;
revoke all on function crm_private.refresh_event_financials() from public,anon,authenticated;
create trigger payment_refresh_financial after insert on public.payment_transactions
  for each row execute function crm_private.refresh_event_financials();

create function public.create_stripe_payment_request(
  p_event_financial_id uuid,p_purpose text,p_provider_session_id text,
  p_checkout_url text,p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare f public.event_financials; amount bigint; result uuid;
begin
  if not crm_private.is_operator() then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into strict f from public.event_financials where id=p_event_financial_id for update;
  if p_purpose='deposit' then amount=greatest(f.deposit_required_cents-f.paid_cents,0);
  elsif p_purpose='balance' then amount=f.balance_remaining_cents;
  else raise exception 'Invalid payment purpose'; end if;
  if amount<=0 then raise exception 'No payment is due'; end if;
  if p_provider_session_id is null or p_checkout_url is null then raise exception 'Provider checkout is required'; end if;
  update public.payment_requests set status='cancelled',updated_at=now()
    where event_financial_id=f.id and purpose=p_purpose and status in ('created','open');
  insert into public.payment_requests(event_financial_id,purpose,amount_cents,status,
    provider_checkout_session_id,checkout_url,expires_at,created_by)
    values(f.id,p_purpose,amount,'open',p_provider_session_id,p_checkout_url,p_expires_at,auth.uid())
    returning id into result;
  return result;
end $$;
revoke all on function public.create_stripe_payment_request(uuid,text,text,text,timestamptz) from public,anon;
grant execute on function public.create_stripe_payment_request(uuid,text,text,text,timestamptz) to authenticated;

create function public.process_stripe_checkout_event(
  p_provider_event_id text,p_event_type text,p_payload_sha256 text,
  p_provider_session_id text,p_provider_payment_id text,p_paid boolean
) returns boolean language plpgsql security definer set search_path='' as $$
declare request_row public.payment_requests;
begin
  if p_payload_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'Invalid event digest'; end if;
  insert into crm_private.stripe_webhook_events(provider_event_id,event_type,payload_sha256)
    values(p_provider_event_id,p_event_type,p_payload_sha256)
    on conflict(provider_event_id) do nothing;
  if not found then return false; end if;
  select * into request_row from public.payment_requests
    where provider_checkout_session_id=p_provider_session_id for update;
  if not found then raise exception 'Unknown checkout session'; end if;
  if p_event_type='checkout.session.completed' and p_paid then
    insert into public.payment_transactions(event_financial_id,transaction_type,source,amount_cents,
      currency,status,provider_payment_id,provider_event_id,idempotency_key,note)
      values(request_row.event_financial_id,'payment','stripe',request_row.amount_cents,'USD','posted',
        p_provider_payment_id,p_provider_event_id,'stripe-event:'||p_provider_event_id,
        initcap(request_row.purpose)||' paid through Stripe Checkout');
    update public.payment_requests set status='completed',updated_at=now() where id=request_row.id;
  elsif p_event_type='checkout.session.expired' then
    update public.payment_requests set status='expired',updated_at=now() where id=request_row.id;
  end if;
  return true;
end $$;
revoke all on function public.process_stripe_checkout_event(text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.process_stripe_checkout_event(text,text,text,text,text,boolean) to service_role;

create function crm_private.guard_event_booking() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='booked' and old.status <> 'booked' and not exists(
    select 1 from public.event_financials f where f.event_id=new.id
      and f.commercial_status in ('booked','balance_due','paid','completed')
  ) then raise exception 'Required deposit has not been recorded'; end if;
  return new;
end $$;
revoke all on function crm_private.guard_event_booking() from public,anon,authenticated;
create trigger event_booking_financial_guard before update of status on public.events
  for each row execute function crm_private.guard_event_booking();

create function crm_private.schedule_event_lifecycle() returns trigger
language plpgsql security definer set search_path='' as $$
begin
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
create trigger event_revenue_lifecycle after update of status on public.events
  for each row execute function crm_private.schedule_event_lifecycle();

-- Agreement acceptance snapshots cannot be edited after acceptance.
create function crm_private.prepare_agreement_version() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if old.status='accepted' then raise exception 'Accepted agreement evidence is immutable'; end if;
    if new.agreement_id<>old.agreement_id or new.quote_version_id<>old.quote_version_id or
       new.version<>old.version or new.agreement_snapshot<>old.agreement_snapshot or
       new.content_sha256<>old.content_sha256 or new.created_by<>old.created_by then
      raise exception 'Agreement snapshot and identity are immutable';
    end if;
    new.updated_at=now();
  end if;
  return new;
end $$;
revoke all on function crm_private.prepare_agreement_version() from public,anon,authenticated;
create trigger agreement_version_consistency before update on public.agreement_versions
  for each row execute function crm_private.prepare_agreement_version();

-- Operator-issued tokens and server-only public proposal projection.
create function public.issue_proposal_access(p_quote_version_id uuid,p_token_sha256 text,p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not crm_private.is_operator() then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_token_sha256 !~ '^[0-9a-f]{64}$' or p_expires_at <= now() then raise exception 'Invalid proposal access'; end if;
  if not exists(select 1 from public.quote_versions where id=p_quote_version_id and status in ('ready_for_review','sent','viewed')) then
    raise exception 'Quote version is not ready for client access';
  end if;
  update crm_private.proposal_access_tokens set revoked_at=now()
    where quote_version_id=p_quote_version_id and revoked_at is null;
  insert into crm_private.proposal_access_tokens(quote_version_id,token_sha256,expires_at,created_by)
    values(p_quote_version_id,p_token_sha256,p_expires_at,auth.uid()) returning id into result;
  update public.quote_versions set status='sent' where id=p_quote_version_id and status='ready_for_review';
  return result;
end $$;
revoke all on function public.issue_proposal_access(uuid,text,timestamptz) from public,anon;
grant execute on function public.issue_proposal_access(uuid,text,timestamptz) to authenticated;

create function public.prepare_and_issue_proposal(
  p_quote_version_id uuid,
  p_agreement_snapshot jsonb,
  p_content_sha256 text,
  p_token_sha256 text,
  p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.quote_versions; q public.quotes; agreement_id uuid; agreement_version_id uuid; token_id uuid;
begin
  if not crm_private.is_operator() then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into strict v from public.quote_versions where id=p_quote_version_id for update;
  select * into strict q from public.quotes where id=v.quote_id for update;
  if q.current_version_id<>v.id or q.event_id is null or v.status<>'draft' or v.total_cents<=0 then
    raise exception 'Proposal is incomplete or not the current draft';
  end if;
  if jsonb_typeof(p_agreement_snapshot)<>'object' or length(coalesce(p_agreement_snapshot->>'terms',''))<20
     or p_content_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'Agreement snapshot is invalid'; end if;
  if p_token_sha256 !~ '^[0-9a-f]{64}$' or p_expires_at<=now() then raise exception 'Proposal access is invalid'; end if;
  update public.quote_versions set status='ready_for_review',expires_at=p_expires_at where id=v.id;
  insert into public.agreements(event_id,quote_id,created_by)
    values(q.event_id,q.id,auth.uid()) returning id into agreement_id;
  insert into public.agreement_versions(agreement_id,quote_version_id,version,status,
    agreement_snapshot,content_sha256,created_by)
    values(agreement_id,v.id,1,'sent',p_agreement_snapshot,p_content_sha256,auth.uid())
    returning id into agreement_version_id;
  update public.agreements set current_version_id=agreement_version_id where id=agreement_id;
  insert into crm_private.proposal_access_tokens(quote_version_id,token_sha256,expires_at,created_by)
    values(v.id,p_token_sha256,p_expires_at,auth.uid()) returning id into token_id;
  update public.quote_versions set status='sent' where id=v.id;
  update public.leads set status='quote_sent',lost_reason=null where id=q.lead_id;
  perform crm_private.schedule_actions('quote_sent','quote_version',v.id);
  return token_id;
end $$;
revoke all on function public.prepare_and_issue_proposal(uuid,jsonb,text,text,timestamptz) from public,anon;
grant execute on function public.prepare_and_issue_proposal(uuid,jsonb,text,text,timestamptz) to authenticated;

create function public.create_quote_revision(p_quote_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare q public.quotes; prior public.quote_versions; next_id uuid; next_version integer;
begin
  if not crm_private.is_operator() then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into strict q from public.quotes where id=p_quote_id for update;
  select * into strict prior from public.quote_versions where id=q.current_version_id for update;
  if prior.status in ('draft','approved') then raise exception 'Current quote cannot be revised'; end if;
  select max(version)+1 into next_version from public.quote_versions where quote_id=q.id;
  insert into public.quote_versions(quote_id,version,title,introduction,client_notes,internal_notes,
    currency,discount_cents,tax_rate_bps,service_charge_rate_bps,gratuity_cents,delivery_fee_cents,
    deposit_type,deposit_value,expires_at,created_by)
  values(q.id,next_version,prior.title,prior.introduction,prior.client_notes,prior.internal_notes,
    prior.currency,prior.discount_cents,prior.tax_rate_bps,prior.service_charge_rate_bps,
    prior.gratuity_cents,prior.delivery_fee_cents,prior.deposit_type,prior.deposit_value,
    now()+interval '14 days',auth.uid()) returning id into next_id;
  insert into public.quote_line_items(quote_version_id,description,details,quantity_milli,
    unit_price_cents,taxable,display_order)
    select next_id,description,details,quantity_milli,unit_price_cents,taxable,display_order
    from public.quote_line_items where quote_version_id=prior.id order by display_order,id;
  update public.quote_versions set status='superseded' where id=prior.id;
  update public.agreement_versions set status='superseded'
    where quote_version_id=prior.id and status in ('draft','sent');
  update crm_private.proposal_access_tokens set revoked_at=now()
    where quote_version_id=prior.id and revoked_at is null;
  update public.quotes set current_version_id=next_id where id=q.id;
  return next_id;
end $$;
revoke all on function public.create_quote_revision(uuid) from public,anon;
grant execute on function public.create_quote_revision(uuid) to authenticated;

create function public.revoke_proposal_access(p_quote_version_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not crm_private.is_operator() then raise exception 'Forbidden' using errcode='42501'; end if;
  update crm_private.proposal_access_tokens set revoked_at=now()
    where quote_version_id=p_quote_version_id and revoked_at is null;
end $$;
revoke all on function public.revoke_proposal_access(uuid) from public,anon;
grant execute on function public.revoke_proposal_access(uuid) to authenticated;

create function public.get_proposal_by_token(p_token_sha256 text,p_network_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare token_row crm_private.proposal_access_tokens; result jsonb; request_count integer;
begin
  if p_network_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into token_row from crm_private.proposal_access_tokens
    where token_sha256=p_token_sha256 and revoked_at is null and expires_at>now() for update;
  if not found then return null; end if;
  insert into crm_private.rate_limits(key,window_start,count)
    values('proposal:'||token_row.id::text||':'||p_network_hash,date_trunc('hour',now()),1)
    on conflict(key) do update set count=case when crm_private.rate_limits.window_start=excluded.window_start
      then crm_private.rate_limits.count+1 else 1 end,window_start=excluded.window_start returning count into request_count;
  if request_count>60 then raise exception 'Too many proposal requests' using errcode='P0003'; end if;
  update crm_private.proposal_access_tokens set last_accessed_at=now(),access_count=access_count+1 where id=token_row.id;
  insert into crm_private.proposal_access_events(proposal_token_id,action,network_hash)
    values(token_row.id,'viewed',p_network_hash);
  update public.quote_versions set status='viewed',viewed_at=coalesce(viewed_at,now())
    where id=token_row.quote_version_id and status='sent';
  select jsonb_build_object(
    'quote_number',q.quote_number,'version',v.version,'status',v.status,
    'title',v.title,'introduction',v.introduction,'client_notes',v.client_notes,
    'currency',v.currency,'subtotal_cents',v.subtotal_cents,'discount_cents',v.discount_cents,
    'tax_cents',v.tax_cents,'service_charge_cents',v.service_charge_cents,
    'gratuity_cents',v.gratuity_cents,'delivery_fee_cents',v.delivery_fee_cents,
    'total_cents',v.total_cents,'deposit_required_cents',v.deposit_required_cents,
    'expires_at',v.expires_at,
    'client',jsonb_build_object('first_name',c.first_name,'last_name',c.last_name),
    'event',jsonb_build_object('event_type',l.event_type,'requested_date',l.requested_date,'guest_count',l.guest_count),
    'agreement_terms',coalesce((select av.agreement_snapshot->>'terms'
      from public.agreements a join public.agreement_versions av on av.id=a.current_version_id
      where a.quote_id=q.id and av.quote_version_id=v.id),''),
    'line_items',coalesce((select jsonb_agg(jsonb_build_object(
      'description',i.description,'details',i.details,'quantity_milli',i.quantity_milli,
      'unit_price_cents',i.unit_price_cents,'line_total_cents',i.line_total_cents
    ) order by i.display_order,i.id) from public.quote_line_items i where i.quote_version_id=v.id),'[]'::jsonb)
  ) into result
  from public.quote_versions v join public.quotes q on q.id=v.quote_id
  join public.clients c on c.id=q.client_id join public.leads l on l.id=q.lead_id
  where v.id=token_row.quote_version_id;
  return result;
end $$;
revoke all on function public.get_proposal_by_token(text,text) from public,anon,authenticated;
grant execute on function public.get_proposal_by_token(text,text) to service_role;

create function public.accept_proposal_by_token(
  p_token_sha256 text,
  p_typed_name text,
  p_consent_text text,
  p_ip_hash text,
  p_user_agent text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  token_row crm_private.proposal_access_tokens;
  version_row public.quote_versions;
  quote_row public.quotes;
  agreement_row public.agreements;
  agreement_version_row public.agreement_versions;
  financial_id uuid;
begin
  if length(trim(p_typed_name)) not between 2 and 200 or length(trim(p_consent_text)) not between 10 and 1000 then
    raise exception 'Typed name and explicit consent are required';
  end if;
  select * into token_row from crm_private.proposal_access_tokens
    where token_sha256=p_token_sha256 and revoked_at is null and expires_at>now() for update;
  if not found then raise exception 'Proposal access is invalid or expired' using errcode='P0002'; end if;
  select * into strict version_row from public.quote_versions where id=token_row.quote_version_id for update;
  select * into strict quote_row from public.quotes where id=version_row.quote_id;
  if quote_row.event_id is null then raise exception 'Proposal is not linked to an event'; end if;
  select * into strict agreement_row from public.agreements where quote_id=quote_row.id and event_id=quote_row.event_id;
  select * into strict agreement_version_row from public.agreement_versions
    where id=agreement_row.current_version_id for update;
  if version_row.status='approved' and agreement_version_row.status='accepted' then
    return jsonb_build_object('accepted',true,'event_id',quote_row.event_id);
  end if;
  if version_row.status not in ('sent','viewed') or agreement_version_row.status <> 'sent' then
    raise exception 'Proposal is not available for acceptance';
  end if;
  update public.agreement_versions set status='accepted',accepted_typed_name=trim(p_typed_name),
    consent_text=p_consent_text,accepted_at=now(),accepted_ip_hash=p_ip_hash,
    accepted_user_agent=left(coalesce(p_user_agent,''),1000),accepted_proposal_token_id=token_row.id
    where id=agreement_version_row.id;
  insert into crm_private.proposal_access_events(proposal_token_id,action,network_hash)
    values(token_row.id,'accepted',p_ip_hash);
  update public.quote_versions set status='approved' where id=version_row.id;
  update public.quote_versions set status='superseded'
    where quote_id=quote_row.id and id<>version_row.id and status not in ('declined','expired','superseded');
  insert into public.event_financials(event_id,approved_quote_version_id,commercial_status,
    gross_due_cents,deposit_required_cents,balance_remaining_cents)
  values(quote_row.event_id,version_row.id,'approved_deposit_pending',version_row.total_cents,
    version_row.deposit_required_cents,version_row.total_cents)
  on conflict(event_id) do update set approved_quote_version_id=excluded.approved_quote_version_id,
    commercial_status='approved_deposit_pending',gross_due_cents=excluded.gross_due_cents,
    deposit_required_cents=excluded.deposit_required_cents,
    balance_remaining_cents=greatest(excluded.gross_due_cents-public.event_financials.paid_cents,0),updated_at=now()
  returning id into financial_id;
  update public.leads set status='awaiting_deposit',lost_reason=null where id=quote_row.lead_id;
  perform crm_private.schedule_actions('proposal_accepted','event',quote_row.event_id);
  return jsonb_build_object('accepted',true,'event_id',quote_row.event_id,'financial_id',financial_id);
end $$;
revoke all on function public.accept_proposal_by_token(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.accept_proposal_by_token(text,text,text,text,text) to service_role;

create function public.respond_to_proposal_by_token(p_token_sha256 text,p_response text,p_message text,p_network_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare token_row crm_private.proposal_access_tokens; version_row public.quote_versions; quote_row public.quotes;
begin
  if p_response not in ('declined','revision_requested') or length(p_message)>4000 then raise exception 'Invalid response'; end if;
  select * into token_row from crm_private.proposal_access_tokens
    where token_sha256=p_token_sha256 and revoked_at is null and expires_at>now() for update;
  if not found then raise exception 'Proposal access is invalid or expired' using errcode='P0002'; end if;
  if p_network_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid network evidence'; end if;
  select * into strict version_row from public.quote_versions where id=token_row.quote_version_id for update;
  if version_row.status not in ('sent','viewed') then raise exception 'Proposal cannot be changed'; end if;
  select * into strict quote_row from public.quotes where id=version_row.quote_id;
  update public.quote_versions set status=p_response,client_notes=
    case when trim(p_message)='' then client_notes else concat(client_notes,E'\n\nClient response: ',trim(p_message)) end
    where id=version_row.id;
  update public.leads set status=case when p_response='declined' then 'lost' else 'awaiting_decision' end,
    lost_reason=case when p_response='declined' then coalesce(nullif(trim(p_message),''),'Proposal declined') else null end
    where id=quote_row.lead_id;
  insert into crm_private.proposal_access_events(proposal_token_id,action,network_hash)
    values(token_row.id,p_response,p_network_hash);
  return true;
end $$;
revoke all on function public.respond_to_proposal_by_token(text,text,text,text) from public,anon,authenticated;
grant execute on function public.respond_to_proposal_by_token(text,text,text,text) to service_role;

create function public.enqueue_proposal_email(
  p_quote_version_id uuid,p_token_sha256 text,p_proposal_url text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare q public.quotes; v public.quote_versions; c public.clients; communication_id uuid;
begin
  if not crm_private.is_operator() then raise exception 'Forbidden' using errcode='42501'; end if;
  if not exists(select 1 from crm_private.proposal_access_tokens where quote_version_id=p_quote_version_id
    and token_sha256=p_token_sha256 and revoked_at is null and expires_at>now()) then raise exception 'Invalid proposal token'; end if;
  if p_proposal_url not like 'https://%' and p_proposal_url not like 'http://localhost:%' then raise exception 'Invalid proposal URL'; end if;
  select * into strict v from public.quote_versions where id=p_quote_version_id;
  select * into strict q from public.quotes where id=v.quote_id;
  select * into strict c from public.clients where id=q.client_id;
  insert into public.communications(client_id,lead_id,event_id,channel,direction,template_key,
    recipient,subject,status,idempotency_key)
    values(c.id,q.lead_id,q.event_id,'email','outbound','catering_proposal',c.email,
      'Your catering proposal from The Chef','queued',p_idempotency_key)
    on conflict(idempotency_key) do update set updated_at=public.communications.updated_at
    returning id into communication_id;
  insert into crm_private.email_outbox(communication_id,template_key,recipient_email,template_data,idempotency_key)
    values(communication_id,'catering_proposal',c.email,jsonb_build_object(
      'first_name',c.first_name,'quote_number',q.quote_number,'proposal_url',p_proposal_url,
      'total_cents',v.total_cents,'deposit_required_cents',v.deposit_required_cents,
      'expires_at',v.expires_at),p_idempotency_key)
    on conflict(idempotency_key) do nothing;
  return communication_id;
end $$;
revoke all on function public.enqueue_proposal_email(uuid,text,text,text) from public,anon;
grant execute on function public.enqueue_proposal_email(uuid,text,text,text) to authenticated;

create function public.claim_email_outbox(p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  with claimed as (
    select id from crm_private.email_outbox
    where status in ('queued','failed') and available_at<=now() and attempt_count<5
    order by available_at,id for update skip locked limit least(greatest(p_limit,1),50)
  ), updated as (
    update crm_private.email_outbox o set status='processing',attempt_count=o.attempt_count+1,
      locked_at=now(),updated_at=now() from claimed where o.id=claimed.id
    returning o.id,o.communication_id,o.template_key,o.recipient_email,o.template_data,
      o.idempotency_key,o.attempt_count
  ) select coalesce(jsonb_agg(to_jsonb(updated)),'[]'::jsonb) into result from updated;
  return result;
end $$;
revoke all on function public.claim_email_outbox(integer) from public,anon,authenticated;
grant execute on function public.claim_email_outbox(integer) to service_role;

create function public.complete_email_outbox(
  p_outbox_id uuid,p_success boolean,p_provider_message_id text default null,
  p_error_code text default null,p_error_message text default null
) returns void language plpgsql security definer set search_path='' as $$
declare o crm_private.email_outbox; next_status text;
begin
  select * into strict o from crm_private.email_outbox where id=p_outbox_id for update;
  if o.status<>'processing' then raise exception 'Outbox item is not processing'; end if;
  next_status=case when p_success then 'sent' else 'failed' end;
  update crm_private.email_outbox set status=next_status,provider_message_id=p_provider_message_id,
    last_error=case when p_success then null else left(coalesce(p_error_message,'Delivery failed'),2000) end,
    available_at=case when p_success then available_at else now()+make_interval(mins => least(1440,5*(2^least(attempt_count,8))::integer)) end,
    locked_at=null,updated_at=now() where id=o.id;
  update public.communications set status=next_status,provider_id=p_provider_message_id,
    sent_at=case when p_success then now() else null end,updated_at=now() where id=o.communication_id;
  insert into public.email_delivery_attempts(communication_id,attempt_number,provider,
    provider_message_id,status,error_code,error_message)
    values(o.communication_id,o.attempt_count,'resend',p_provider_message_id,
      case when p_success then 'submitted' else 'failed' end,p_error_code,left(p_error_message,2000));
end $$;
revoke all on function public.complete_email_outbox(uuid,boolean,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_email_outbox(uuid,boolean,text,text,text) to service_role;

create function public.process_resend_webhook(
  p_provider_event_id text,p_event_type text,p_payload_sha256 text,p_provider_message_id text
) returns boolean language plpgsql security definer set search_path='' as $$
declare mapped text;
begin
  insert into crm_private.resend_webhook_events(provider_event_id,event_type,payload_sha256)
    values(p_provider_event_id,p_event_type,p_payload_sha256) on conflict(provider_event_id) do nothing;
  if not found then return false; end if;
  mapped=case p_event_type when 'email.delivered' then 'delivered' when 'email.bounced' then 'bounced'
    when 'email.complained' then 'complained' when 'email.delivery_delayed' then 'deferred'
    when 'email.failed' then 'failed' else null end;
  if mapped is not null then
    update public.email_delivery_attempts set status=mapped,updated_at=now()
      where provider='resend' and provider_message_id=p_provider_message_id;
    if mapped in ('bounced','complained','failed') then
      update public.communications set status='failed',updated_at=now()
        where provider_id=p_provider_message_id;
    end if;
  end if;
  return true;
end $$;
revoke all on function public.process_resend_webhook(text,text,text,text) from public,anon,authenticated;
grant execute on function public.process_resend_webhook(text,text,text,text) to service_role;

create function public.list_scheduled_actions()
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not crm_private.is_operator() then raise exception 'Forbidden' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'name',r.name,'action_key',r.action_key,'entity_type',s.entity_type,
    'entity_id',s.entity_id,'due_at',s.due_at,'status',s.status,'last_error',s.last_error
  ) order by s.due_at desc),'[]'::jsonb) into result
  from crm_private.scheduled_actions s join public.automation_rules r on r.id=s.automation_rule_id
  where s.status not in ('completed','cancelled') or s.updated_at>now()-interval '30 days';
  return result;
end $$;
revoke all on function public.list_scheduled_actions() from public,anon;
grant execute on function public.list_scheduled_actions() to authenticated;

create function public.approve_scheduled_action(p_action_id uuid,p_approved boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not crm_private.is_operator() then raise exception 'Forbidden' using errcode='42501'; end if;
  update crm_private.scheduled_actions set status=case when p_approved then 'pending' else 'cancelled' end,
    updated_at=now() where id=p_action_id and status='awaiting_approval';
  if not found then raise exception 'Scheduled action is unavailable'; end if;
end $$;
revoke all on function public.approve_scheduled_action(uuid,boolean) from public,anon;
grant execute on function public.approve_scheduled_action(uuid,boolean) to authenticated;

create function public.process_due_scheduled_actions(p_limit integer default 10)
returns integer language plpgsql security definer set search_path='' as $$
declare s crm_private.scheduled_actions; r public.automation_rules; eid uuid; cid uuid; lid uuid;
  first_name text; recipient text; event_type text; event_date date; communication_id uuid; processed integer=0;
begin
  for s in select * from crm_private.scheduled_actions where status='pending' and due_at<=now()
    order by due_at,id for update skip locked limit least(greatest(p_limit,1),50)
  loop
    update crm_private.scheduled_actions set status='processing',attempts=attempts+1,updated_at=now() where id=s.id;
    select * into strict r from public.automation_rules where id=s.automation_rule_id;
    if s.entity_type='event' then eid=s.entity_id;
    elsif s.entity_type='quote_version' then
      select q.event_id into eid from public.quote_versions v join public.quotes q on q.id=v.quote_id where v.id=s.entity_id;
    else
      update crm_private.scheduled_actions set status='failed',last_error='Unsupported entity type',updated_at=now() where id=s.id;
      continue;
    end if;
    select e.client_id,e.lead_id,e.event_type,e.event_date,c.first_name,c.email
      into strict cid,lid,event_type,event_date,first_name,recipient
      from public.events e join public.clients c on c.id=e.client_id where e.id=eid;
    insert into public.communications(client_id,lead_id,event_id,channel,direction,template_key,
      recipient,subject,status,idempotency_key)
    values(cid,lid,eid,'email','outbound',r.action_key,recipient,
      case r.action_key
        when 'draft_quote_follow_up' then 'A note about your catering proposal'
        when 'draft_booking_confirmation' then 'Your catering booking update'
        when 'draft_thank_you' then 'Thank you from The Chef'
        when 'draft_review_request' then 'How was your experience with The Chef?'
        when 'draft_rebooking_message' then 'Plan your next event with The Chef'
        else 'An update from The Chef' end,
      'queued','scheduled:'||s.id::text)
    on conflict(idempotency_key) do update set updated_at=public.communications.updated_at
    returning id into communication_id;
    insert into crm_private.email_outbox(communication_id,template_key,recipient_email,template_data,idempotency_key)
    values(communication_id,r.action_key,recipient,jsonb_build_object('first_name',first_name,
      'event_type',event_type,'event_date',event_date),'scheduled:'||s.id::text)
    on conflict(idempotency_key) do nothing;
    update crm_private.scheduled_actions set status='completed',updated_at=now() where id=s.id;
    processed=processed+1;
  end loop;
  return processed;
end $$;
revoke all on function public.process_due_scheduled_actions(integer) from public,anon,authenticated;
grant execute on function public.process_due_scheduled_actions(integer) to service_role;

-- Audit operator-visible mutable entities. Ledger insert history is immutable and separately attributable.
create trigger quotes_audit before insert or update on public.quotes for each row execute function crm_private.audit_change();
create trigger quote_versions_audit before insert or update on public.quote_versions for each row execute function crm_private.audit_change();
create trigger quote_line_items_audit before insert or update on public.quote_line_items for each row execute function crm_private.audit_change();
create trigger event_financials_audit before insert or update on public.event_financials for each row execute function crm_private.audit_change();
create trigger payment_requests_audit before insert or update on public.payment_requests for each row execute function crm_private.audit_change();
create trigger agreements_audit before insert or update on public.agreements for each row execute function crm_private.audit_change();
create trigger agreement_versions_audit before insert or update on public.agreement_versions for each row execute function crm_private.audit_change();
create trigger automation_rules_audit before insert or update on public.automation_rules for each row execute function crm_private.audit_change();
create trigger ai_generations_audit before insert on public.ai_generations for each row execute function crm_private.audit_change();

-- Seed safe defaults disabled. Operators must deliberately activate each rule.
insert into public.automation_rules(name,trigger_key,action_key,delay_minutes,requires_operator_approval,active,created_by)
select seed.name,seed.trigger_key,seed.action_key,seed.delay_minutes,seed.requires_approval,false,p.id
from (values
  ('Quote follow-up','quote_sent','draft_quote_follow_up',2880,true),
  ('Booking confirmation','deposit_satisfied','draft_booking_confirmation',0,true),
  ('Event thank-you','event_completed','draft_thank_you',1440,true),
  ('Review request','thank_you_sent','draft_review_request',4320,true),
  ('Rebooking reminder','event_completed','draft_rebooking_message',129600,true)
) as seed(name,trigger_key,action_key,delay_minutes,requires_approval)
cross join lateral (select id from public.profiles where active and role='owner' order by created_at limit 1) p;
