-- Every minute the database calls the muna-push function, which sends the reminders that are due.
-- It uses the project's public (anon) key, which is public by design. Running "run" more often does no harm: every reminder is only sent once (push_log).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'muna-push-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://vlatdcjwxbflicomkbnr.supabase.co/functions/v1/muna-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsYXRkY2p3eGJmbGljb21rYm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NzUzNDcsImV4cCI6MjEwNjQ1MTM0N30.nzt_uK0X_ZbaBcaRlY6AtcLoWhA58LNfpd48IWosHCk'),
    body := '{"action":"run"}'::jsonb
  );
  $$
);
