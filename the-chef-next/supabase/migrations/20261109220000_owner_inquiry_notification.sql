-- Chef's new-inquiry notification (Phase 3.5 integration, 2026-11-09).
--
-- Adds a 6-argument overload of submit_catering_inquiry. It runs the existing
-- 5-argument intake transaction unchanged, then, in the SAME transaction,
-- queues one internal alert to the owner address the server passes in
-- (Vercel env CHEF_NOTIFICATION_EMAIL; never hard-coded here).
--
-- * The 5-argument function is not modified. Callers that pass no recipient
--   (older deployments, or no address configured) behave exactly as before.
-- * Idempotent per request UUID: retries and duplicate submissions never queue
--   a second alert, and a retry of a request first saved without an alert
--   queues exactly one.
-- * A missing or malformed recipient never blocks the customer's inquiry; the
--   alert is simply not queued.
-- * Delivery uses the existing outbox/dispatcher (template
--   'owner_inquiry_notification' in lib/email/templates.ts).

create index if not exists leads_request_id_idx
  on public.leads ((inquiry->>'request_id'));

create function public.submit_catering_inquiry(
  p_id uuid,
  p_inquiry jsonb,
  p_snapshot jsonb,
  p_network_key text,
  p_email_key text,
  p_owner_email text
) returns void
language plpgsql security invoker set search_path='' as $$
declare
  recipient text := lower(trim(coalesce(p_owner_email, '')));
  alert_key text := 'owner_inquiry_notification:' || p_id::text;
  l public.leads;
  communication_id uuid;
begin
  perform public.submit_catering_inquiry(
    p_id, p_inquiry, p_snapshot, p_network_key, p_email_key
  );

  if length(recipient) > 254
    or recipient !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return;
  end if;

  select * into l
  from public.leads
  where inquiry->>'request_id' = p_id::text
  order by created_at
  limit 1;
  if not found then
    return;
  end if;

  insert into public.communications(
    client_id,lead_id,channel,direction,template_key,recipient,
    subject,status,idempotency_key
  ) values (
    l.client_id,
    l.id,
    'email',
    'outbound',
    'owner_inquiry_notification',
    recipient,
    'New catering inquiry (Chef alert)',
    'queued',
    alert_key
  )
  on conflict(idempotency_key) do nothing
  returning id into communication_id;

  if communication_id is null then
    return; -- already queued for this request
  end if;

  insert into crm_private.email_outbox(
    communication_id,template_key,recipient_email,template_data,idempotency_key
  ) values (
    communication_id,
    'owner_inquiry_notification',
    recipient,
    jsonb_build_object(
      'lead_id', l.id,
      'first_name', l.inquiry->>'first_name',
      'last_name', l.inquiry->>'last_name',
      'email', l.inquiry->>'email',
      'phone', l.inquiry->>'phone',
      'preferred_contact_method', l.inquiry->>'preferred_contact_method',
      'event_type', l.inquiry->>'event_type',
      'requested_date', l.inquiry->>'requested_date',
      'guest_count', l.inquiry->>'guest_count',
      'event_location', l.inquiry->>'event_location',
      'package_interest', l.inquiry->>'package_interest'
    ),
    alert_key
  )
  on conflict(idempotency_key) do nothing;
end $$;

revoke all on function public.submit_catering_inquiry(
  uuid,jsonb,jsonb,text,text,text
) from public,anon,authenticated;
grant execute on function public.submit_catering_inquiry(
  uuid,jsonb,jsonb,text,text,text
) to service_role;
