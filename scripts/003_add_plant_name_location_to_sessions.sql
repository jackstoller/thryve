-- Add plant_name and plant_location columns to import_sessions table
ALTER TABLE import_sessions
ADD COLUMN IF NOT EXISTS plant_name TEXT,
ADD COLUMN IF NOT EXISTS plant_location TEXT;
