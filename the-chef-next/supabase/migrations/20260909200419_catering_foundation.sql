-- Catering only. Run through migration tooling, never from a public client.
create schema if not exists crm_private;
revoke all on schema crm_private from public, anon;
grant usage on schema crm_private to authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id),
  full_name text not null default '',
  role text not null check (role in ('owner','manager','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
create policy own_profile on public.profiles for select to authenticated using (id=(select auth.uid()));

-- Protected role lookup avoids recursive RLS; no editable JWT metadata.
create function crm_private.is_operator() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles where id=auth.uid() and active and role in ('owner','manager')
  );
$$;
revoke all on function crm_private.is_operator() from public, anon;
grant execute on function crm_private.is_operator() to authenticated;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null, last_name text not null,
  email text not null unique check (email=lower(trim(email))),
  phone text not null, preferred_contact_method text not null check (preferred_contact_method in ('email','phone')),
  referral_source text not null default '', notes text not null default '',
  marketing_opt_in boolean not null default false, archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  status text not null default 'new_inquiry' check (status in ('new_inquiry','contacted','consultation_scheduled','quote_sent','awaiting_decision','awaiting_deposit','booked','pre_event','completed','lost','cancelled','archived')),
  source text not null default 'catering_website',
  event_type text not null, requested_date date not null,
  guest_count integer not null check (guest_count between 1 and 10000),
  package_interest text not null,
  inquiry jsonb not null, package_snapshot jsonb not null,
  lost_reason text, last_contact_at timestamptz, next_follow_up_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (status <> 'lost' or length(trim(lost_reason)) > 0 and lost_reason is not null)
);
create index leads_client_id_idx on public.leads(client_id);
create index leads_status_created_idx on public.leads(status,created_at desc);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  lead_id uuid not null unique references public.leads(id),
  event_type text not null, event_date date not null,
  guest_count integer not null check (guest_count between 1 and 10000),
  status text not null default 'prospective' check (status in ('prospective','booked','pre_event','completed','cancelled','archived')),
  package_snapshot jsonb not null, menu_snapshot jsonb not null,
  internal_notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index events_client_id_idx on public.events(client_id);
create index events_date_idx on public.events(event_date);
create table public.activity_log (
  id uuid primary key default gen_random_uuid(), actor_user_id uuid,
  action text not null, entity_type text not null, entity_id uuid not null,
  metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index activity_entity_idx on public.activity_log(entity_id,created_at desc);

do $$ declare t text; begin
  foreach t in array array['clients','leads','events','activity_log'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy operator_read on public.%I for select to authenticated using ((select crm_private.is_operator()))',t);
  end loop;
end $$;
grant update (notes,archived) on public.clients to authenticated;
grant update (status,lost_reason,next_follow_up_at,last_contact_at) on public.leads to authenticated;
grant update (event_date,guest_count,status,internal_notes) on public.events to authenticated;
grant insert on public.events to authenticated;
create policy client_update on public.clients for update to authenticated using ((select crm_private.is_operator())) with check ((select crm_private.is_operator()));
create policy lead_update on public.leads for update to authenticated using ((select crm_private.is_operator())) with check ((select crm_private.is_operator()));
create policy event_update on public.events for update to authenticated using ((select crm_private.is_operator())) with check ((select crm_private.is_operator()));
create policy event_insert on public.events for insert to authenticated with check ((select crm_private.is_operator()));

-- Only triggers may append audit entries; clients cannot forge or edit the log.
create function crm_private.audit_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' then new.updated_at=now(); end if;
  insert into public.activity_log(actor_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),lower(tg_op),tg_table_name,new.id,
    case when tg_op='UPDATE' then jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(new)) else jsonb_build_object('created',true) end);
  return new;
end $$;
revoke all on function crm_private.audit_change() from public,anon,authenticated;
create trigger clients_audit before insert or update on public.clients for each row execute function crm_private.audit_change();
create trigger leads_audit before insert or update on public.leads for each row execute function crm_private.audit_change();
create trigger events_audit before insert or update on public.events for each row execute function crm_private.audit_change();

-- Snapshot consistency is enforced even for direct authenticated Data API calls.
create function crm_private.event_snapshot() returns trigger
language plpgsql security invoker set search_path='' as $$
declare l public.leads;
begin
  select * into strict l from public.leads where id=new.lead_id;
  if l.status in ('lost','cancelled','archived') then raise exception 'Lead is closed'; end if;
  new.client_id=l.client_id;
  new.event_type=l.event_type;
  new.package_snapshot=l.package_snapshot;
  new.menu_snapshot=jsonb_build_object('menu_notes',l.inquiry->>'menu_notes','dietary_notes',l.inquiry->>'dietary_notes','approved',false);
  return new;
end $$;
revoke all on function crm_private.event_snapshot() from public,anon,authenticated;
create trigger event_snapshot before insert on public.events for each row execute function crm_private.event_snapshot();

create table crm_private.inquiry_requests (
  request_id uuid primary key, payload jsonb not null, created_at timestamptz not null default now()
);
create table crm_private.rate_limits (
  key text primary key, window_start timestamptz not null, count integer not null
);
alter table crm_private.inquiry_requests enable row level security;
alter table crm_private.rate_limits enable row level security;
revoke all on all tables in schema crm_private from public,anon,authenticated;
grant all on all tables in schema crm_private to service_role;
grant select,insert,update on public.clients,public.leads to service_role;

-- Security invoker: only service_role receives EXECUTE. One atomic intake transaction.
create function public.submit_catering_inquiry(p_id uuid,p_inquiry jsonb,p_snapshot jsonb,p_network_key text,p_email_key text)
returns void language plpgsql security invoker set search_path='' as $$
declare cid uuid; existing jsonb; k text; n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select payload into existing from crm_private.inquiry_requests where request_id=p_id;
  if found then
    if existing <> p_inquiry then raise exception 'Request conflict' using errcode='P0002'; end if;
    return;
  end if;
  -- Per-network and per-email hourly limits. Counters survive server restarts.
  foreach k in array array[p_network_key,p_email_key] loop
    insert into crm_private.rate_limits(key,window_start,count) values(k,date_trunc('hour',now()),1)
    on conflict(key) do update set
      count=case when crm_private.rate_limits.window_start=excluded.window_start then crm_private.rate_limits.count+1 else 1 end,
      window_start=excluded.window_start returning count into n;
    if n > (case when k=p_email_key then 3 else 10 end) then raise exception 'Too many inquiries' using errcode='P0003'; end if;
  end loop;
  insert into public.clients(first_name,last_name,email,phone,preferred_contact_method,referral_source)
  values(p_inquiry->>'first_name',p_inquiry->>'last_name',lower(trim(p_inquiry->>'email')),p_inquiry->>'phone',p_inquiry->>'preferred_contact_method',p_inquiry->>'referral_source')
  on conflict(email) do nothing returning id into cid;
  if cid is null then select id into strict cid from public.clients where email=lower(trim(p_inquiry->>'email')); end if;
  insert into public.leads(client_id,event_type,requested_date,guest_count,package_interest,inquiry,package_snapshot)
  values(cid,p_inquiry->>'event_type',(p_inquiry->>'requested_date')::date,(p_inquiry->>'guest_count')::integer,p_inquiry->>'package_interest',p_inquiry,p_snapshot);
  insert into crm_private.inquiry_requests(request_id,payload) values(p_id,p_inquiry);
end $$;
revoke all on function public.submit_catering_inquiry(uuid,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.submit_catering_inquiry(uuid,jsonb,jsonb,text,text) to service_role;

-- Private buckets only. File workflows will be added in the operational phase.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('crm-documents','crm-documents',false,10485760,array['application/pdf','image/jpeg','image/png']),
       ('crm-client-uploads','crm-client-uploads',false,10485760,array['application/pdf','image/jpeg','image/png']);
create policy crm_document_read on storage.objects for select to authenticated using (bucket_id in ('crm-documents','crm-client-uploads') and (select crm_private.is_operator()));
create policy crm_document_insert on storage.objects for insert to authenticated with check (bucket_id in ('crm-documents','crm-client-uploads') and (select crm_private.is_operator()));
create policy crm_document_update on storage.objects for update to authenticated using (bucket_id in ('crm-documents','crm-client-uploads') and (select crm_private.is_operator())) with check (bucket_id in ('crm-documents','crm-client-uploads') and (select crm_private.is_operator()));
-- No DELETE policy: document removal is intentionally unavailable in Phase 1.
