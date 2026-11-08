-- Phase 2: catering event operations. No Music/Entertainment data is involved.

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  address text not null default '' check (length(address) <= 500),
  city text not null default '' check (length(city) <= 100),
  state text not null default '' check (length(state) <= 100),
  postal_code text not null default '' check (length(postal_code) <= 20),
  contact_name text not null default '' check (length(contact_name) <= 200),
  contact_email text not null default '' check (
    length(contact_email) <= 254
    and (contact_email = '' or contact_email = lower(trim(contact_email)))
  ),
  contact_phone text not null default '' check (length(contact_phone) <= 30),
  loading_instructions text not null default '' check (length(loading_instructions) <= 4000),
  kitchen_availability text not null default 'unknown'
    check (kitchen_availability in ('unknown','none','limited','full','commercial')),
  parking_loading_notes text not null default '' check (length(parking_loading_notes) <= 4000),
  setup_restrictions text not null default '' check (length(setup_restrictions) <= 4000),
  notes text not null default '' check (length(notes) <= 4000),
  coi_requirement text not null default 'unknown'
    check (coi_requirement in ('unknown','not_required','required')),
  additional_insured_requirements text not null default ''
    check (length(additional_insured_requirements) <= 4000),
  insurance_notes text not null default '' check (length(insurance_notes) <= 4000),
  insurance_due_days_before_event integer
    check (insurance_due_days_before_event between 0 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index venues_identity_idx
  on public.venues (
    lower(trim(name)),
    lower(trim(address)),
    lower(trim(city)),
    lower(trim(state))
  );
create index venues_name_idx on public.venues (lower(name));

alter table public.events
  add column venue_id uuid references public.venues(id),
  add column venue_snapshot jsonb not null default '{}'::jsonb,
  add column start_time time,
  add column end_time time,
  add column service_style text not null default '',
  add column coi_status text not null default 'requirement_unknown'
    check (coi_status in (
      'not_required',
      'requirement_unknown',
      'required',
      'requested',
      'received',
      'submitted_to_venue',
      'approved',
      'rejected_needs_revision'
    )),
  add column coi_due_at timestamptz,
  add column venue_requirements text not null default ''
    check (length(venue_requirements) <= 4000),
  add column additional_insured_information text not null default ''
    check (length(additional_insured_information) <= 4000),
  add column coi_internal_notes text not null default ''
    check (length(coi_internal_notes) <= 4000),
  add column guest_count_confirmed_at timestamptz,
  add column client_confirmed_at timestamptz,
  add constraint event_time_order check (
    start_time is null or end_time is null or end_time > start_time
  );
create index events_venue_id_idx on public.events(venue_id);
create index events_coi_due_idx on public.events(coi_due_at)
  where coi_status not in ('not_required','approved');

create table public.event_menus (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  version integer not null check (version > 0),
  status text not null default 'draft'
    check (status in ('draft','client_review','revision_requested','approved','locked')),
  package_details text not null default '' check (length(package_details) <= 4000),
  appetizers text not null default '' check (length(appetizers) <= 4000),
  entrees text not null default '' check (length(entrees) <= 4000),
  seafood text not null default '' check (length(seafood) <= 4000),
  sides text not null default '' check (length(sides) <= 4000),
  desserts text not null default '' check (length(desserts) <= 4000),
  bread text not null default '' check (length(bread) <= 4000),
  dietary_accommodations text not null default ''
    check (length(dietary_accommodations) <= 4000),
  allergy_notes text not null default '' check (length(allergy_notes) <= 4000),
  substitutions text not null default '' check (length(substitutions) <= 4000),
  custom_menu_notes text not null default '' check (length(custom_menu_notes) <= 4000),
  internal_prep_notes text not null default '' check (length(internal_prep_notes) <= 4000),
  approved_at timestamptz,
  locked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, version),
  check (status not in ('approved','locked') or approved_at is not null),
  check (status <> 'locked' or locked_at is not null)
);
create index event_menus_event_idx on public.event_menus(event_id,version desc);

alter table public.events
  add column current_menu_id uuid references public.event_menus(id);
create index events_current_menu_idx on public.events(current_menu_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id),
  lead_id uuid references public.leads(id),
  event_id uuid references public.events(id),
  title text not null check (length(trim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 4000),
  category text not null default 'administrative'
    check (category in (
      'food_prep','purchasing','equipment','staffing','venue',
      'insurance','client','transport','setup','administrative'
    )),
  assignee_id uuid references public.profiles(id),
  due_at timestamptz,
  status text not null default 'todo'
    check (status in ('todo','in_progress','blocked','complete')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  required boolean not null default true,
  completed_at timestamptz,
  notes text not null default '' check (length(notes) <= 4000),
  automation_key text check (automation_key is null or length(automation_key) <= 200),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_id is not null or lead_id is not null or event_id is not null),
  check ((status = 'complete') = (completed_at is not null))
);
create index tasks_event_due_idx on public.tasks(event_id,due_at);
create index tasks_status_due_idx on public.tasks(status,due_at);
create unique index tasks_event_automation_idx
  on public.tasks(event_id,automation_key)
  where event_id is not null and automation_key is not null;
create unique index tasks_lead_automation_idx
  on public.tasks(lead_id,automation_key)
  where lead_id is not null and automation_key is not null;

create table public.event_documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  client_id uuid not null references public.clients(id),
  category text not null check (category in (
    'coi','contract','venue_requirements','menu',
    'floor_plan','event_instructions','other'
  )),
  state text not null default 'active'
    check (state in ('active','superseded','archived')),
  bucket_id text not null default 'crm-documents'
    check (bucket_id = 'crm-documents'),
  storage_path text not null unique check (length(storage_path) between 1 and 1000),
  original_filename text not null check (length(original_filename) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  document_group_id uuid not null default gen_random_uuid(),
  version integer not null default 1 check (version > 0),
  replaces_document_id uuid references public.event_documents(id),
  uploaded_by uuid not null references public.profiles(id),
  notes text not null default '' check (length(notes) <= 4000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_group_id,version),
  check ((state = 'archived') = (archived_at is not null))
);
create index event_documents_event_idx
  on public.event_documents(event_id,created_at desc);
create index event_documents_group_idx
  on public.event_documents(document_group_id,version desc);

create table public.communications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  lead_id uuid references public.leads(id),
  event_id uuid references public.events(id),
  channel text not null check (channel in ('email')),
  direction text not null check (direction in ('outbound','inbound')),
  template_key text not null check (length(template_key) between 1 and 100),
  recipient text not null check (length(recipient) between 3 and 254),
  subject text not null check (length(subject) between 1 and 500),
  body text not null default '',
  status text not null default 'queued'
    check (status in ('queued','processing','sent','failed','cancelled')),
  provider_id text,
  idempotency_key text not null unique,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'sent' or sent_at is not null)
);
create index communications_client_idx
  on public.communications(client_id,created_at desc);
create index communications_event_idx
  on public.communications(event_id,created_at desc);

create table crm_private.email_outbox (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null unique references public.communications(id),
  template_key text not null,
  recipient_email text not null,
  template_data jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  status text not null default 'queued'
    check (status in ('queued','processing','sent','failed','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_outbox_dispatch_idx
  on crm_private.email_outbox(status,available_at)
  where status in ('queued','failed');
alter table crm_private.email_outbox enable row level security;
revoke all on crm_private.email_outbox from public,anon,authenticated;
grant all on crm_private.email_outbox to service_role;

-- Public operational tables are visible and mutable only to active operators.
do $$ declare t text; begin
  foreach t in array array[
    'venues','event_menus','tasks','event_documents','communications'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format(
      'create policy operator_read on public.%I for select to authenticated using ((select crm_private.is_operator()))',
      t
    );
  end loop;
end $$;

grant insert,update on public.venues to authenticated;
grant insert,update on public.event_menus to authenticated;
grant insert,update on public.tasks to authenticated;
grant insert,update on public.event_documents to authenticated;
grant update (
  venue_id,venue_snapshot,start_time,end_time,service_style,
  coi_status,coi_due_at,venue_requirements,additional_insured_information,
  coi_internal_notes,guest_count_confirmed_at,client_confirmed_at,current_menu_id
) on public.events to authenticated;

create policy operator_insert on public.venues for insert to authenticated
  with check ((select crm_private.is_operator()));
create policy operator_update on public.venues for update to authenticated
  using ((select crm_private.is_operator()))
  with check ((select crm_private.is_operator()));
create policy operator_insert on public.event_menus for insert to authenticated
  with check ((select crm_private.is_operator()));
create policy operator_update on public.event_menus for update to authenticated
  using ((select crm_private.is_operator()))
  with check ((select crm_private.is_operator()));
create policy operator_insert on public.tasks for insert to authenticated
  with check ((select crm_private.is_operator()));
create policy operator_update on public.tasks for update to authenticated
  using ((select crm_private.is_operator()))
  with check ((select crm_private.is_operator()));
create policy operator_insert on public.event_documents for insert to authenticated
  with check ((select crm_private.is_operator()));
create policy operator_update on public.event_documents for update to authenticated
  using ((select crm_private.is_operator()))
  with check ((select crm_private.is_operator()));

-- Permit operator cleanup of failed direct uploads. The product archives
-- registered documents rather than deleting historical versions.
create policy crm_document_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'crm-documents'
    and (select crm_private.is_operator())
  );

-- Venue snapshots change only when an operator explicitly links/relinks a venue.
create function crm_private.snapshot_event_venue() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v public.venues;
begin
  if new.venue_id is null then
    if tg_op = 'INSERT' or old.venue_id is distinct from new.venue_id then
      new.venue_snapshot = '{}'::jsonb;
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' or old.venue_id is distinct from new.venue_id then
    select * into strict v from public.venues where id = new.venue_id;
    new.venue_snapshot = to_jsonb(v) - 'created_at' - 'updated_at';
    if new.coi_status = 'requirement_unknown' then
      new.coi_status = case v.coi_requirement
        when 'required' then 'required'
        when 'not_required' then 'not_required'
        else 'requirement_unknown'
      end;
    end if;
    if new.additional_insured_information = '' then
      new.additional_insured_information = v.additional_insured_requirements;
    end if;
    if new.venue_requirements = '' then
      new.venue_requirements = v.insurance_notes;
    end if;
    if new.coi_due_at is null and v.insurance_due_days_before_event is not null then
      new.coi_due_at =
        ((new.event_date::timestamp + time '17:00') at time zone 'America/New_York')
        - make_interval(days => v.insurance_due_days_before_event);
    end if;
  end if;
  return new;
end $$;
revoke all on function crm_private.snapshot_event_venue() from public,anon,authenticated;
create trigger event_venue_snapshot
  before insert or update of venue_id on public.events
  for each row execute function crm_private.snapshot_event_venue();

create function crm_private.validate_event_menu_link() returns trigger
language plpgsql security invoker set search_path='' as $$
declare linked_event_id uuid;
begin
  if new.current_menu_id is not null then
    select event_id into strict linked_event_id
    from public.event_menus
    where id = new.current_menu_id;
    if linked_event_id <> new.id then
      raise exception 'Current menu must belong to this event';
    end if;
  end if;
  return new;
end $$;
revoke all on function crm_private.validate_event_menu_link()
  from public,anon,authenticated;
create trigger event_current_menu_consistency
  before insert or update of current_menu_id on public.events
  for each row execute function crm_private.validate_event_menu_link();

create function crm_private.prepare_event_menu() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op = 'UPDATE' and old.status = 'locked' then
    raise exception 'Locked menu revisions are immutable';
  end if;
  if new.status in ('approved','locked') and new.approved_at is null then
    new.approved_at = now();
  elsif new.status not in ('approved','locked') then
    new.approved_at = null;
  end if;
  if new.status = 'locked' and new.locked_at is null then
    new.locked_at = now();
  elsif new.status <> 'locked' then
    new.locked_at = null;
  end if;
  if tg_op = 'UPDATE' then new.updated_at = now(); end if;
  return new;
end $$;
revoke all on function crm_private.prepare_event_menu() from public,anon,authenticated;
create trigger event_menu_state
  before insert or update on public.event_menus
  for each row execute function crm_private.prepare_event_menu();

create function crm_private.prepare_task() returns trigger
language plpgsql security invoker set search_path='' as $$
declare e public.events;
declare l public.leads;
begin
  if new.event_id is not null then
    select * into strict e from public.events where id = new.event_id;
    new.client_id = e.client_id;
    if new.lead_id is null then new.lead_id = e.lead_id; end if;
  elsif new.lead_id is not null then
    select * into strict l from public.leads where id = new.lead_id;
    new.client_id = l.client_id;
  end if;
  if new.status = 'complete' and new.completed_at is null then
    new.completed_at = now();
  elsif new.status <> 'complete' then
    new.completed_at = null;
  end if;
  if tg_op = 'UPDATE' then new.updated_at = now(); end if;
  return new;
end $$;
revoke all on function crm_private.prepare_task() from public,anon,authenticated;
create trigger task_consistency
  before insert or update on public.tasks
  for each row execute function crm_private.prepare_task();

create function crm_private.prepare_event_document() returns trigger
language plpgsql security invoker set search_path='' as $$
declare e public.events;
declare replaced public.event_documents;
begin
  select * into strict e from public.events where id = new.event_id;
  new.client_id = e.client_id;
  if tg_op = 'UPDATE' then
    if old.event_id <> new.event_id
      or old.client_id <> new.client_id
      or old.category <> new.category
      or old.bucket_id <> new.bucket_id
      or old.storage_path <> new.storage_path
      or old.original_filename <> new.original_filename
      or old.mime_type <> new.mime_type
      or old.size_bytes <> new.size_bytes
      or old.document_group_id <> new.document_group_id
      or old.version <> new.version
      or old.replaces_document_id is distinct from new.replaces_document_id
      or old.uploaded_by <> new.uploaded_by
      or old.created_at <> new.created_at then
      raise exception 'Document file metadata is immutable';
    end if;
    if old.state in ('superseded','archived') and new.state <> old.state then
      raise exception 'Historical document state is immutable';
    end if;
  elsif new.replaces_document_id is not null then
    select * into strict replaced
    from public.event_documents
    where id = new.replaces_document_id;
    if replaced.event_id <> new.event_id or replaced.category <> new.category then
      raise exception 'Replacement must match event and category';
    end if;
    new.document_group_id = replaced.document_group_id;
    new.version = replaced.version + 1;
  else
    new.version = 1;
  end if;
  if new.state = 'archived' and new.archived_at is null then
    new.archived_at = now();
  elsif new.state <> 'archived' then
    new.archived_at = null;
  end if;
  if tg_op = 'UPDATE' then new.updated_at = now(); end if;
  return new;
end $$;
revoke all on function crm_private.prepare_event_document() from public,anon,authenticated;
create trigger event_document_consistency
  before insert or update on public.event_documents
  for each row execute function crm_private.prepare_event_document();

create function crm_private.supersede_replaced_document() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.replaces_document_id is not null then
    update public.event_documents
    set state = 'superseded'
    where id = new.replaces_document_id and state = 'active';
  end if;
  return new;
end $$;
revoke all on function crm_private.supersede_replaced_document()
  from public,anon,authenticated;
create trigger event_document_replacement
  after insert on public.event_documents
  for each row execute function crm_private.supersede_replaced_document();

-- Reuse the protected Phase 1 audit trigger for all operational records.
create trigger venues_audit before insert or update on public.venues
  for each row execute function crm_private.audit_change();
create trigger event_menus_audit before insert or update on public.event_menus
  for each row execute function crm_private.audit_change();
create trigger tasks_audit before insert or update on public.tasks
  for each row execute function crm_private.audit_change();
create trigger event_documents_audit before insert or update on public.event_documents
  for each row execute function crm_private.audit_change();
create trigger communications_audit before insert or update on public.communications
  for each row execute function crm_private.audit_change();

create function crm_private.create_event_operations() returns trigger
language plpgsql security definer set search_path='' as $$
declare menu_id uuid;
declare due_base timestamptz;
begin
  insert into public.event_menus(
    event_id,version,package_details,dietary_accommodations,
    allergy_notes,custom_menu_notes,created_by
  ) values (
    new.id,
    1,
    coalesce(new.package_snapshot->>'badge',''),
    coalesce(new.menu_snapshot->>'dietary_notes',''),
    coalesce(new.menu_snapshot->>'dietary_notes',''),
    coalesce(new.menu_snapshot->>'menu_notes',''),
    auth.uid()
  ) returning id into menu_id;
  update public.events set current_menu_id = menu_id where id = new.id;

  due_base := (new.event_date::timestamp + time '17:00')
    at time zone 'America/New_York';
  insert into public.tasks(
    client_id,lead_id,event_id,title,description,category,due_at,
    priority,automation_key,created_by
  ) values
    (new.client_id,new.lead_id,new.id,'Confirm venue',
      'Link the venue and verify the address, access, kitchen, parking, and setup requirements.',
      'venue',greatest(now(),due_base - interval '30 days'),'high','confirm_venue',auth.uid()),
    (new.client_id,new.lead_id,new.id,'Confirm guest count',
      'Record the final guest count and mark it confirmed.',
      'client',greatest(now(),due_base - interval '7 days'),'high','confirm_guest_count',auth.uid()),
    (new.client_id,new.lead_id,new.id,'Confirm menu and allergies',
      'Complete the working menu, dietary accommodations, and allergy review.',
      'food_prep',greatest(now(),due_base - interval '14 days'),'high','confirm_menu',auth.uid()),
    (new.client_id,new.lead_id,new.id,'Confirm COI requirements',
      'Determine whether the venue requires a COI and record the deadline and additional insured wording.',
      'insurance',greatest(now(),due_base - interval '21 days'),'high','confirm_coi',auth.uid()),
    (new.client_id,new.lead_id,new.id,'Confirm venue access and loading',
      'Verify arrival time, loading route, parking, and setup restrictions.',
      'venue',greatest(now(),due_base - interval '7 days'),'normal','confirm_access',auth.uid()),
    (new.client_id,new.lead_id,new.id,'Final client confirmation',
      'Confirm the final date, time, guest count, menu, and arrival plan with the client.',
      'client',greatest(now(),due_base - interval '2 days'),'urgent','client_confirmation',auth.uid())
  on conflict(event_id,automation_key)
    where event_id is not null and automation_key is not null
    do nothing;
  return new;
end $$;
revoke all on function crm_private.create_event_operations() from public,anon,authenticated;
create trigger event_operations_defaults
  after insert on public.events
  for each row execute function crm_private.create_event_operations();

-- Backfill working menus and default tasks for Phase 1 events.
insert into public.event_menus(
  event_id,version,package_details,dietary_accommodations,
  allergy_notes,custom_menu_notes
)
select
  e.id,
  1,
  coalesce(e.package_snapshot->>'badge',''),
  coalesce(e.menu_snapshot->>'dietary_notes',''),
  coalesce(e.menu_snapshot->>'dietary_notes',''),
  coalesce(e.menu_snapshot->>'menu_notes','')
from public.events e
where not exists (
  select 1 from public.event_menus m where m.event_id = e.id
);
update public.events e
set current_menu_id = m.id
from public.event_menus m
where m.event_id = e.id and m.version = 1 and e.current_menu_id is null;

do $$ declare e public.events; declare due_base timestamptz; begin
  for e in select * from public.events loop
    due_base := (e.event_date::timestamp + time '17:00')
      at time zone 'America/New_York';
    insert into public.tasks(
      client_id,lead_id,event_id,title,description,category,due_at,
      priority,automation_key
    ) values
      (e.client_id,e.lead_id,e.id,'Confirm venue',
        'Link the venue and verify the address, access, kitchen, parking, and setup requirements.',
        'venue',greatest(now(),due_base - interval '30 days'),'high','confirm_venue'),
      (e.client_id,e.lead_id,e.id,'Confirm guest count',
        'Record the final guest count and mark it confirmed.',
        'client',greatest(now(),due_base - interval '7 days'),'high','confirm_guest_count'),
      (e.client_id,e.lead_id,e.id,'Confirm menu and allergies',
        'Complete the working menu, dietary accommodations, and allergy review.',
        'food_prep',greatest(now(),due_base - interval '14 days'),'high','confirm_menu'),
      (e.client_id,e.lead_id,e.id,'Confirm COI requirements',
        'Determine whether the venue requires a COI and record the deadline and additional insured wording.',
        'insurance',greatest(now(),due_base - interval '21 days'),'high','confirm_coi'),
      (e.client_id,e.lead_id,e.id,'Confirm venue access and loading',
        'Verify arrival time, loading route, parking, and setup restrictions.',
        'venue',greatest(now(),due_base - interval '7 days'),'normal','confirm_access'),
      (e.client_id,e.lead_id,e.id,'Final client confirmation',
        'Confirm the final date, time, guest count, menu, and arrival plan with the client.',
        'client',greatest(now(),due_base - interval '2 days'),'urgent','client_confirmation')
    on conflict(event_id,automation_key)
      where event_id is not null and automation_key is not null
      do nothing;
  end loop;
end $$;

grant select,insert on public.tasks,public.communications to service_role;
grant update (body,status,provider_id,sent_at) on public.communications
  to service_role;

-- Extend the atomic intake transaction with one durable acknowledgment and
-- one internal follow-up task. A request UUID can enqueue each only once.
create or replace function public.submit_catering_inquiry(
  p_id uuid,
  p_inquiry jsonb,
  p_snapshot jsonb,
  p_network_key text,
  p_email_key text
) returns void
language plpgsql security invoker set search_path='' as $$
declare
  cid uuid;
  lid uuid;
  communication_id uuid;
  existing jsonb;
  k text;
  n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select payload into existing
  from crm_private.inquiry_requests
  where request_id = p_id;
  if found then
    if existing <> p_inquiry then
      raise exception 'Request conflict' using errcode='P0002';
    end if;
    return;
  end if;

  foreach k in array array[p_network_key,p_email_key] loop
    insert into crm_private.rate_limits(key,window_start,count)
    values(k,date_trunc('hour',now()),1)
    on conflict(key) do update set
      count = case
        when crm_private.rate_limits.window_start = excluded.window_start
          then crm_private.rate_limits.count + 1
        else 1
      end,
      window_start = excluded.window_start
    returning count into n;
    if n > (case when k = p_email_key then 3 else 10 end) then
      raise exception 'Too many inquiries' using errcode='P0003';
    end if;
  end loop;

  insert into public.clients(
    first_name,last_name,email,phone,preferred_contact_method,referral_source
  ) values (
    p_inquiry->>'first_name',
    p_inquiry->>'last_name',
    lower(trim(p_inquiry->>'email')),
    p_inquiry->>'phone',
    p_inquiry->>'preferred_contact_method',
    p_inquiry->>'referral_source'
  )
  on conflict(email) do nothing
  returning id into cid;

  if cid is null then
    select id into strict cid
    from public.clients
    where email = lower(trim(p_inquiry->>'email'));
  end if;

  insert into public.leads(
    client_id,event_type,requested_date,guest_count,
    package_interest,inquiry,package_snapshot
  ) values (
    cid,
    p_inquiry->>'event_type',
    (p_inquiry->>'requested_date')::date,
    (p_inquiry->>'guest_count')::integer,
    p_inquiry->>'package_interest',
    p_inquiry,
    p_snapshot
  ) returning id into lid;

  insert into crm_private.inquiry_requests(request_id,payload)
  values(p_id,p_inquiry);

  insert into public.tasks(
    client_id,lead_id,title,description,category,due_at,
    priority,automation_key
  ) values (
    cid,
    lid,
    'Respond to new catering inquiry',
    'Review the inquiry and make the first personal response.',
    'client',
    now() + interval '1 day',
    'high',
    'inquiry_follow_up'
  );

  insert into public.communications(
    client_id,lead_id,channel,direction,template_key,recipient,
    subject,status,idempotency_key
  ) values (
    cid,
    lid,
    'email',
    'outbound',
    'inquiry_acknowledgment',
    lower(trim(p_inquiry->>'email')),
    'We received your catering inquiry',
    'queued',
    'inquiry_acknowledgment:' || p_id::text
  ) returning id into communication_id;

  insert into crm_private.email_outbox(
    communication_id,template_key,recipient_email,template_data,idempotency_key
  ) values (
    communication_id,
    'inquiry_acknowledgment',
    lower(trim(p_inquiry->>'email')),
    jsonb_build_object(
      'first_name',p_inquiry->>'first_name',
      'event_type',p_inquiry->>'event_type',
      'requested_date',p_inquiry->>'requested_date',
      'guest_count',p_inquiry->>'guest_count',
      'package_interest',p_inquiry->>'package_interest'
    ),
    'inquiry_acknowledgment:' || p_id::text
  );
end $$;
revoke all on function public.submit_catering_inquiry(
  uuid,jsonb,jsonb,text,text
) from public,anon,authenticated;
grant execute on function public.submit_catering_inquiry(
  uuid,jsonb,jsonb,text,text
) to service_role;
