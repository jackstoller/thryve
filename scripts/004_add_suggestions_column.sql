-- Add suggestions column to import_sessions table
ALTER TABLE import_sessions
ADD COLUMN IF NOT EXISTS suggestions JSONB;

-- Add comment
COMMENT ON COLUMN import_sessions.suggestions IS 'Array of plant suggestions when AI confidence is low';

-- Update the status check constraint to include needs_selection
ALTER TABLE import_sessions
DROP CONSTRAINT IF EXISTS import_sessions_status_check;

ALTER TABLE import_sessions
ADD CONSTRAINT import_sessions_status_check
CHECK (status IN ('uploading', 'identifying', 'researching', 'comparing', 'confirming', 'completed', 'failed', 'needs_selection'));
