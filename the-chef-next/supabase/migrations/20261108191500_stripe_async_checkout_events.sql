-- Accept Stripe's delayed-payment Checkout lifecycle while preserving the
-- existing signature, amount, currency, unknown-session and idempotency gates.

create or replace function public.process_stripe_checkout_event(
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
  if p_event_type not in (
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'checkout.session.expired'
  ) then
    raise exception 'Unsupported Stripe event';
  end if;
  insert into crm_private.stripe_webhook_events(provider_event_id,event_type,payload_sha256)
    values(p_provider_event_id,p_event_type,p_payload_sha256)
    on conflict(provider_event_id) do nothing;
  if not found then return false; end if;
  select * into request_row from public.payment_requests
    where provider_checkout_session_id=p_provider_session_id for update;
  if not found then raise exception 'Unknown checkout session'; end if;
  if p_event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded') and p_paid then
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
