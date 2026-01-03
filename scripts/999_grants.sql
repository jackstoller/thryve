-- Tight grants for app tables in public schema.
--
-- Goal: keep DB access behind your Next.js API (server-side) by allowing only
-- the `service_role` JWT to read/write app tables.
--
-- Notes:
-- - docker-entrypoint-initdb.d scripts only run on a fresh DB volume.
-- - Re-run this script manually against an existing DB to apply REVOKEs.

DO $$
BEGIN
  -- Ensure roles can see the schema (service_role only for app access)
  EXECUTE 'GRANT USAGE ON SCHEMA public TO service_role';

  -- Storage API switches into `service_role` for admin operations.
  -- Ensure it can access the Storage schema objects.
  EXECUTE 'GRANT USAGE ON SCHEMA storage TO service_role';

  -- Public object reads (e.g. /storage/v1/object/public/...) commonly run as `anon`.
  -- Without these grants, Storage may respond with 500 "permission denied".
  -- RLS policies (created in scripts/007_create_storage_schema.sql) still limit access
  -- to rows in public buckets.
  EXECUTE 'GRANT USAGE ON SCHEMA storage TO anon, authenticated';

  -- Tighten existing objects
  EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
  EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
  EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated';

  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role';
  EXECUTE 'GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO service_role';
  EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role';

  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA storage TO service_role';
  EXECUTE 'GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA storage TO service_role';
  EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA storage TO service_role';

  -- Allow reading bucket/object metadata for public access paths.
  EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA storage TO anon, authenticated';

  -- Tighten future objects created by migrations (supabase_admin owns most objects)
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated';

  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO service_role';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role';
END
$$;
