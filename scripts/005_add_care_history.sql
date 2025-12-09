-- Add care history table to track all watering and fertilizing events
CREATE TABLE IF NOT EXISTS care_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  care_type TEXT NOT NULL CHECK (care_type IN ('water', 'fertilize')),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_care_history_plant_id ON care_history(plant_id);
CREATE INDEX IF NOT EXISTS idx_care_history_performed_at ON care_history(performed_at);
CREATE INDEX IF NOT EXISTS idx_care_history_care_type ON care_history(care_type);
