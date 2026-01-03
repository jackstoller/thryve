-- Minimal Supabase Storage schema for self-hosted installs.
--
-- This repo uses supabase/storage-api, which expects the `storage` schema
-- and core tables (notably `storage.buckets`) to exist.
--
-- The goal here is:
-- - enable bucket creation + object uploads via service_role
-- - allow public (unauthenticated) reads for buckets marked `public = true`
--
-- This script is idempotent and safe to run repeatedly.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  -- Create schema owned by the storage admin role if present.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    EXECUTE 'CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin';
  ELSE
    EXECUTE 'CREATE SCHEMA IF NOT EXISTS storage';
  END IF;
END
$$;

-- Buckets
CREATE TABLE IF NOT EXISTS storage.buckets (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  owner             uuid,
  owner_id          text,
  public            boolean NOT NULL DEFAULT false,
  allowed_mime_types text[],
  file_size_limit   bigint,
  type              text NOT NULL DEFAULT 'file',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Objects
CREATE TABLE IF NOT EXISTS storage.objects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id   text NOT NULL REFERENCES storage.buckets(id) ON DELETE CASCADE,
  name        text NOT NULL,
  owner       uuid,
  owner_id    text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS objects_bucket_id_name_key
  ON storage.objects(bucket_id, name);

CREATE INDEX IF NOT EXISTS objects_bucket_id_idx
  ON storage.objects(bucket_id);

-- updated_at helper
CREATE OR REPLACE FUNCTION storage.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'buckets_set_updated_at'
  ) THEN
    EXECUTE '
      CREATE TRIGGER buckets_set_updated_at
      BEFORE UPDATE ON storage.buckets
      FOR EACH ROW
      EXECUTE FUNCTION storage.set_updated_at();
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'objects_set_updated_at'
  ) THEN
    EXECUTE '
      CREATE TRIGGER objects_set_updated_at
      BEFORE UPDATE ON storage.objects
      FOR EACH ROW
      EXECUTE FUNCTION storage.set_updated_at();
    ';
  END IF;
END
$$;

-- RLS for public access patterns
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Public bucket metadata is readable
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'buckets'
      AND policyname = 'public buckets are readable'
  ) THEN
    EXECUTE '
      CREATE POLICY "public buckets are readable"
      ON storage.buckets
      FOR SELECT
      USING (public = true);
    ';
  END IF;
END
$$;

-- Public objects are readable if their bucket is public
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'public objects are readable'
  ) THEN
    EXECUTE '
      CREATE POLICY "public objects are readable"
      ON storage.objects
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM storage.buckets b
          WHERE b.id = bucket_id
            AND b.public = true
        )
      );
    ';
  END IF;
END
$$;
