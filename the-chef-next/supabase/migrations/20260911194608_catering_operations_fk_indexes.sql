create index communications_lead_id_idx
  on public.communications(lead_id);
create index event_documents_client_id_idx
  on public.event_documents(client_id);
create index event_documents_replaces_id_idx
  on public.event_documents(replaces_document_id);
create index event_documents_uploaded_by_idx
  on public.event_documents(uploaded_by);
create index event_menus_created_by_idx
  on public.event_menus(created_by);
create index tasks_assignee_id_idx
  on public.tasks(assignee_id);
create index tasks_client_id_idx
  on public.tasks(client_id);
create index tasks_created_by_idx
  on public.tasks(created_by);
