-- Best-effort setup for local self-hosted Supabase-style roles.
-- This is intentionally permissive and intended for local development.

-- NOTE: This script runs during DB initialization (fresh volume).
-- It must be plain SQL (no psql meta-commands like \set), because not all
-- entrypoints run init scripts through psql.
--
-- If you change POSTGRES_PASSWORD in `.env.docker`, either:
-- - keep it as `postgres` (recommended for local dev), OR
-- - update the hardcoded password here and recreate the DB volume.

DO $$
BEGIN
  -- Some Supabase services/migrations assume a `postgres` superuser exists.
  -- The `supabase/postgres` image uses `supabase_admin` as the main superuser,
  -- so we create a compatible `postgres` role for local development.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    EXECUTE 'CREATE ROLE postgres LOGIN SUPERUSER';
  END IF;

  -- Core API roles (JWT roles)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'CREATE ROLE anon NOLOGIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'CREATE ROLE authenticated NOLOGIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'CREATE ROLE service_role NOLOGIN BYPASSRLS';
  END IF;

  -- If the role already exists (e.g. from the base image), ensure it still bypasses RLS.
  -- This is required for server-side/admin flows (like Storage) that should not be blocked by RLS.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'ALTER ROLE service_role BYPASSRLS';
  END IF;

  -- PostgREST connection role
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    EXECUTE 'CREATE ROLE authenticator LOGIN NOINHERIT';
  END IF;

  -- Service-specific admin roles (used by GoTrue & Storage)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    EXECUTE 'CREATE ROLE supabase_auth_admin LOGIN NOINHERIT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    EXECUTE 'CREATE ROLE supabase_storage_admin LOGIN NOINHERIT';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    EXECUTE 'ALTER ROLE supabase_auth_admin WITH PASSWORD ''postgres''';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    EXECUTE 'ALTER ROLE supabase_storage_admin WITH PASSWORD ''postgres''';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    EXECUTE 'ALTER ROLE authenticator WITH PASSWORD ''postgres''';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    EXECUTE 'ALTER ROLE supabase_admin WITH PASSWORD ''postgres''';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    EXECUTE 'ALTER ROLE postgres WITH PASSWORD ''postgres''';
  END IF;

  -- Allow admin roles to create schemas/tables during migrations.
  -- (We keep this permissive for local dev.)
  EXECUTE 'GRANT CREATE ON DATABASE postgres TO supabase_auth_admin';
  EXECUTE 'GRANT CREATE ON DATABASE postgres TO supabase_storage_admin';

  -- GoTrue writes its schema_migrations table to `public` by default.
  -- Allow it to create objects there.
  EXECUTE 'GRANT USAGE, CREATE ON SCHEMA public TO supabase_auth_admin';

  -- Ensure PostgREST can switch roles if roles exist.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'GRANT anon TO authenticator';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT authenticated TO authenticator';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT service_role TO authenticator';
  END IF;

  -- Storage API connects as `supabase_storage_admin` but needs to be able to
  -- switch into the JWT roles (especially `service_role`) via GUCs.
  -- Without membership, supautils blocks setting `role` and Storage requests fail.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_auth_members m
      JOIN pg_roles r_member ON r_member.oid = m.member
      JOIN pg_roles r_role ON r_role.oid = m.roleid
      WHERE r_member.rolname = 'supabase_storage_admin'
        AND r_role.rolname = 'service_role'
    ) THEN
      EXECUTE 'GRANT service_role TO supabase_storage_admin';
    END IF;
  END IF;

  -- Realtime can set its search_path to _realtime; ensure schemas exist.
  EXECUTE 'CREATE SCHEMA IF NOT EXISTS _realtime';
  EXECUTE 'CREATE SCHEMA IF NOT EXISTS realtime';

  -- GoTrue expects an `auth` schema to exist.
  -- Make supabase_auth_admin the owner so it can run migrations.
  EXECUTE 'CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin';

  -- GoTrue migrations include a backfill that assumes auth.identities.id is TEXT.
  -- Pre-create the table in a compatible shape so GoTrue can safely apply migrations.
  EXECUTE '
    CREATE TABLE IF NOT EXISTS auth.identities (
      provider_id     text        NOT NULL,
      user_id         uuid        NOT NULL,
      identity_data   jsonb       NOT NULL,
      provider        text        NOT NULL,
      last_sign_in_at timestamptz NULL,
      created_at      timestamptz NULL,
      updated_at      timestamptz NULL,
      email           text GENERATED ALWAYS AS (lower(identity_data ->> ''email'')) STORED,
      id              text        NOT NULL DEFAULT (gen_random_uuid()::text),
      CONSTRAINT identities_pkey PRIMARY KEY (id)
    )';
  EXECUTE 'ALTER TABLE auth.identities OWNER TO supabase_auth_admin';
  EXECUTE 'CREATE INDEX IF NOT EXISTS identities_user_id_idx ON auth.identities USING btree (user_id)';

  -- Ensure GoTrue creates unqualified types/tables in the `auth` schema.
  EXECUTE 'ALTER ROLE supabase_auth_admin SET search_path = auth, public';

  -- Ensure the Storage API resolves unqualified tables in the `storage` schema.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    EXECUTE 'ALTER ROLE supabase_storage_admin SET search_path = storage, public';
  END IF;

  -- Storage also switches into the `service_role` JWT role for admin operations.
  -- Ensure that role can resolve the storage tables.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'ALTER ROLE service_role SET search_path = storage, public';
  END IF;

  -- If any MFA enum types were created in `public` (due to a search_path mismatch),
  -- move them into `auth` so later migrations (that reference auth.*) succeed.
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'factor_type'
  ) THEN
    EXECUTE 'ALTER TYPE public.factor_type SET SCHEMA auth';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'factor_status'
  ) THEN
    EXECUTE 'ALTER TYPE public.factor_status SET SCHEMA auth';
  END IF;
END
$$;
