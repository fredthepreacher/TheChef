-- Provider acceptance (2026-11-10): send a new inquiry's own emails immediately.
--
-- The website now dispatches the customer's acknowledgment and Chef's
-- new-inquiry alert right after the intake transaction commits. The generic
-- public.claim_email_outbox takes every queued item, which would also send
-- emails an operator queued for an explicit "Send queued emails" (for example
-- a proposal email). This claim is limited to the given idempotency keys, so
-- the intake path can only ever send that inquiry's two messages.
--
-- Additive: no existing function, table or policy changes.

create function public.claim_email_outbox_by_keys(p_idempotency_keys text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if p_idempotency_keys is null or cardinality(p_idempotency_keys) = 0 then
    return '[]'::jsonb;
  end if;
  with claimed as (
    select id from crm_private.email_outbox
    where idempotency_key = any(p_idempotency_keys)
      and status in ('queued','failed') and available_at<=now() and attempt_count<5
    order by available_at,id for update skip locked limit 10
  ), updated as (
    update crm_private.email_outbox o set status='processing',attempt_count=o.attempt_count+1,
      locked_at=now(),updated_at=now() from claimed where o.id=claimed.id
    returning o.id,o.communication_id,o.template_key,o.recipient_email,o.template_data,
      o.idempotency_key,o.attempt_count
  ) select coalesce(jsonb_agg(to_jsonb(updated)),'[]'::jsonb) into result from updated;
  return result;
end $$;
revoke all on function public.claim_email_outbox_by_keys(text[]) from public,anon,authenticated;
grant execute on function public.claim_email_outbox_by_keys(text[]) to service_role;
