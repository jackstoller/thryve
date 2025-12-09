-- Add 'comparing' status to import_sessions table
-- This migration adds the comparing status between researching and confirming

-- Drop the existing constraint
ALTER TABLE import_sessions 
DROP CONSTRAINT IF EXISTS import_sessions_status_check;

-- Add the new constraint with 'comparing' included
ALTER TABLE import_sessions 
ADD CONSTRAINT import_sessions_status_check 
CHECK (status IN ('uploading', 'identifying', 'researching', 'comparing', 'confirming', 'completed', 'failed'));
