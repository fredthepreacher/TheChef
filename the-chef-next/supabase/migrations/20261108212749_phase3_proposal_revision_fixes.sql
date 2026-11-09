-- Phase 3 hosted UI acceptance fixes (2026-11-08). Additive: replaces two
-- functions in place (same signatures, same grants), adds one nullable-by-
-- default column and one operator-only read function. No data is rewritten.
--
-- D-1  prepare_and_issue_proposal always inserted a new public.agreements row,
--      but agreements.event_id is unique, so issuing any revision after the
--      first proposal for an event failed with 23505. It now reuses the
--      event's agreement and appends the next agreement_versions row.
-- D-2  respond_to_proposal_by_token appended the client's message to the
--      issued quote version's client_notes, which crm_private.prepare_quote_version
--      rejects ("Issued quote versions are immutable"), so a revision request
--      or decline that included a message failed. Issued versions now only
--      change status; the message is stored with the private access event and
--      operators read it through list_proposal_responses.

-- ── D-2 storage ───────────────────────────────────────────────────────────
alter table crm_private.proposal_access_events
  add column message text not null default ''
  check (length(message) <= 4000);

-- ── D-1 ───────────────────────────────────────────────────────────────────
create or replace function public.prepare_and_issue_proposal(
  p_quote_version_id uuid,
  p_agreement_snapshot jsonb,
  p_content_sha256 text,
  p_token_sha256 text,
  p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v public.quote_versions;
  q public.quotes;
  existing_agreement public.agreements;
  v_agreement_id uuid;
  v_agreement_version_id uuid;
  v_next_agreement_version integer;
  v_token_id uuid;
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

  -- One agreement per event: a revision appends a new agreement version.
  select * into existing_agreement from public.agreements a where a.event_id=q.event_id for update;
  if found then
    if exists(select 1 from public.agreement_versions av
              where av.agreement_id=existing_agreement.id and av.status='accepted') then
      raise exception 'This event already has an accepted agreement';
    end if;
    -- create_quote_revision normally supersedes these already; kept defensive.
    update public.agreement_versions av set status='superseded'
      where av.agreement_id=existing_agreement.id and av.status in ('draft','sent');
    select coalesce(max(av.version),0)+1 into v_next_agreement_version
      from public.agreement_versions av where av.agreement_id=existing_agreement.id;
    v_agreement_id := existing_agreement.id;
    if existing_agreement.quote_id<>q.id then
      update public.agreements a set quote_id=q.id where a.id=v_agreement_id;
    end if;
  else
    insert into public.agreements(event_id,quote_id,created_by)
      values(q.event_id,q.id,auth.uid()) returning id into v_agreement_id;
    v_next_agreement_version := 1;
  end if;

  update public.quote_versions set status='ready_for_review',expires_at=p_expires_at where id=v.id;
  insert into public.agreement_versions(agreement_id,quote_version_id,version,status,
    agreement_snapshot,content_sha256,created_by)
    values(v_agreement_id,v.id,v_next_agreement_version,'sent',p_agreement_snapshot,p_content_sha256,auth.uid())
    returning id into v_agreement_version_id;
  update public.agreements a set current_version_id=v_agreement_version_id where a.id=v_agreement_id;
  insert into crm_private.proposal_access_tokens(quote_version_id,token_sha256,expires_at,created_by)
    values(v.id,p_token_sha256,p_expires_at,auth.uid()) returning id into v_token_id;
  update public.quote_versions set status='sent' where id=v.id;
  update public.leads set status='quote_sent',lost_reason=null where id=q.lead_id;
  perform crm_private.schedule_actions('quote_sent','quote_version',v.id);
  return v_token_id;
end $$;
revoke all on function public.prepare_and_issue_proposal(uuid,jsonb,text,text,timestamptz) from public,anon;
grant execute on function public.prepare_and_issue_proposal(uuid,jsonb,text,text,timestamptz) to authenticated;

-- ── D-2 ───────────────────────────────────────────────────────────────────
create or replace function public.respond_to_proposal_by_token(
  p_token_sha256 text,
  p_response text,
  p_message text,
  p_network_hash text
) returns boolean language plpgsql security definer set search_path='' as $$
declare
  token_row crm_private.proposal_access_tokens;
  version_row public.quote_versions;
  quote_row public.quotes;
  v_message text := trim(coalesce(p_message,''));
begin
  if p_response not in ('declined','revision_requested') or length(v_message)>4000 then
    raise exception 'Invalid response';
  end if;
  select * into token_row from crm_private.proposal_access_tokens
    where token_sha256=p_token_sha256 and revoked_at is null and expires_at>now() for update;
  if not found then raise exception 'Proposal access is invalid or expired' using errcode='P0002'; end if;
  if p_network_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid network evidence'; end if;
  select * into strict version_row from public.quote_versions where id=token_row.quote_version_id for update;
  if version_row.status not in ('sent','viewed') then raise exception 'Proposal cannot be changed'; end if;
  select * into strict quote_row from public.quotes where id=version_row.quote_id;
  -- Issued versions are immutable apart from status; the client's words are
  -- kept with the access event instead of being appended to client_notes.
  update public.quote_versions set status=p_response where id=version_row.id;
  update public.leads set status=case when p_response='declined' then 'lost' else 'awaiting_decision' end,
    lost_reason=case when p_response='declined' then coalesce(nullif(v_message,''),'Proposal declined') else null end
    where id=quote_row.lead_id;
  insert into crm_private.proposal_access_events(proposal_token_id,action,network_hash,message)
    values(token_row.id,p_response,p_network_hash,v_message);
  return true;
end $$;
revoke all on function public.respond_to_proposal_by_token(text,text,text,text) from public,anon,authenticated;
grant execute on function public.respond_to_proposal_by_token(text,text,text,text) to service_role;

-- ── Operator read access to client responses ─────────────────────────────
create function public.list_proposal_responses(p_quote_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not crm_private.is_operator() then raise exception 'Forbidden' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'version', v.version,
             'action', e.action,
             'message', e.message,
             'created_at', e.created_at
           ) order by e.created_at desc)
    from crm_private.proposal_access_events e
    join crm_private.proposal_access_tokens t on t.id=e.proposal_token_id
    join public.quote_versions v on v.id=t.quote_version_id
    where v.quote_id=p_quote_id and e.action in ('accepted','declined','revision_requested')
  ), '[]'::jsonb);
end $$;
revoke all on function public.list_proposal_responses(uuid) from public,anon;
grant execute on function public.list_proposal_responses(uuid) to authenticated;
