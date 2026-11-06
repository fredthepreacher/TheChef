-- No default passwords or automatic owner promotion.
-- Set this only in an explicit trusted administrator SQL session, then run this file:
-- select set_config('crm.bootstrap_owner_id', '<existing verified auth.users UUID>', false);
do $$
declare owner_id uuid := nullif(current_setting('crm.bootstrap_owner_id',true),'')::uuid;
begin
  if owner_id is not null then
    if exists(select 1 from public.profiles where role='owner' and active) then
      raise exception 'An owner already exists; use a reviewed role migration for changes';
    end if;
    insert into public.profiles(id,full_name,role) values(owner_id,'Chef Frankie','owner');
  end if;
end $$;
