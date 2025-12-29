-- Add photos array column to plants table
-- This replaces the single image_url with an array of photo objects containing url and order
ALTER TABLE plants
ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- Migrate existing image_url data to photos array
UPDATE plants
SET photos = jsonb_build_array(
  jsonb_build_object(
    'url', image_url,
    'order', 0,
    'id', gen_random_uuid()::text
  )
)
WHERE image_url IS NOT NULL AND (photos IS NULL OR photos = '[]'::jsonb);

-- Note: We keep image_url for backwards compatibility and as the primary/cover photo
-- The image_url will be synced with photos[0].url
