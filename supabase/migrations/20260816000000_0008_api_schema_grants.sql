-- 0008_api_schema_grants — make the api schema reachable through the Data API.
-- 0007 created api.get_shared_report / api.resolve_user_id_by_email and granted
-- EXECUTE on each function, but PostgREST also requires USAGE on the schema for
-- RPC dispatch. Without it the calls 404/deny even after the schema is added to
-- the dashboard's Exposed schemas list (Integrations > Data API > Settings).

grant usage on schema api to anon, authenticated;
