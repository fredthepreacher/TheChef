-- Phase 3 hosted advisor remediation: cover every revenue-operations foreign
-- key used for referential checks, joins, or operator attribution.
create index if not exists proposal_access_tokens_created_by_idx
  on crm_private.proposal_access_tokens(created_by);
create index if not exists scheduled_actions_rule_idx
  on crm_private.scheduled_actions(automation_rule_id);

create index if not exists agreement_versions_created_by_idx
  on public.agreement_versions(created_by);
create index if not exists agreement_versions_quote_version_idx
  on public.agreement_versions(quote_version_id);
create index if not exists agreements_created_by_idx
  on public.agreements(created_by);
create index if not exists agreements_current_version_idx
  on public.agreements(current_version_id);
create index if not exists agreements_quote_idx
  on public.agreements(quote_id);
create index if not exists ai_generations_created_by_idx
  on public.ai_generations(created_by);
create index if not exists automation_rules_created_by_idx
  on public.automation_rules(created_by);
create index if not exists event_financials_approved_quote_idx
  on public.event_financials(approved_quote_version_id);
create index if not exists payment_requests_created_by_idx
  on public.payment_requests(created_by);
create index if not exists payment_transactions_recorded_by_idx
  on public.payment_transactions(recorded_by);
create index if not exists quote_versions_created_by_idx
  on public.quote_versions(created_by);
create index if not exists quotes_created_by_idx
  on public.quotes(created_by);
create index if not exists quotes_current_version_idx
  on public.quotes(current_version_id);
