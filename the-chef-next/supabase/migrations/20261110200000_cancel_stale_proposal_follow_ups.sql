-- F-4 (hosted acceptance, 2026-11-10): the "Quote follow-up" automation is
-- scheduled once per issued quote version (trigger 'quote_sent'). It stayed
-- "awaiting approval" after the client accepted, declined or asked for a
-- revision, and after a newer revision superseded the version. Approving one
-- would still have queued "A note about your catering proposal" to the client.
--
-- Additive and backwards compatible. No table changes.
--   1. A trigger cancels open follow-ups as soon as a version stops awaiting a
--      client response (any status other than sent/viewed).
--   2. The processor refuses to send a follow-up for a version that is no
--      longer awaiting a response, even if it was already approved.
--   3. A one-time update cancels any follow-up that is already stale.

create function crm_private.cancel_stale_quote_version_actions() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status not in ('sent','viewed') then
    update crm_private.scheduled_actions
       set status='cancelled',last_error='Proposal no longer awaiting a response',updated_at=now()
     where entity_type='quote_version' and entity_id=new.id
       and status in ('pending','awaiting_approval');
  end if;
  return new;
end $$;
revoke all on function crm_private.cancel_stale_quote_version_actions() from public,anon,authenticated;

create trigger quote_version_cancel_stale_actions
  after update of status on public.quote_versions
  for each row when (old.status is distinct from new.status)
  execute function crm_private.cancel_stale_quote_version_actions();

-- Same body as 20260911210739_catering_revenue_operations.sql, plus the
-- quote-version status guard (marked GUARD below).
create or replace function public.process_due_scheduled_actions(p_limit integer default 10)
returns integer language plpgsql security definer set search_path='' as $$
declare s crm_private.scheduled_actions; r public.automation_rules; eid uuid; cid uuid; lid uuid;
  first_name text; recipient text; event_type text; event_date date; communication_id uuid; processed integer=0;
  version_status text;
begin
  for s in select * from crm_private.scheduled_actions where status='pending' and due_at<=now()
    order by due_at,id for update skip locked limit least(greatest(p_limit,1),50)
  loop
    update crm_private.scheduled_actions set status='processing',attempts=attempts+1,updated_at=now() where id=s.id;
    select * into strict r from public.automation_rules where id=s.automation_rule_id;
    if s.entity_type='event' then eid=s.entity_id;
    elsif s.entity_type='quote_version' then
      select q.event_id,v.status into eid,version_status
        from public.quote_versions v join public.quotes q on q.id=v.quote_id where v.id=s.entity_id;
      -- GUARD: never follow up on a proposal the client has answered or that was replaced.
      if version_status is null or version_status not in ('sent','viewed') then
        update crm_private.scheduled_actions
           set status='cancelled',last_error='Proposal no longer awaiting a response',updated_at=now()
         where id=s.id;
        continue;
      end if;
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

update crm_private.scheduled_actions s
   set status='cancelled',last_error='Proposal no longer awaiting a response',updated_at=now()
  from public.quote_versions v
 where s.entity_type='quote_version' and v.id=s.entity_id
   and v.status not in ('sent','viewed')
   and s.status in ('pending','awaiting_approval');
