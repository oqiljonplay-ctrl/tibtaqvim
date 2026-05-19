INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  'manual',
  now(),
  '20260519000001_add_username_to_users',
  NULL,
  NULL,
  now(),
  1
);
