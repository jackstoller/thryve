-- Create plants table for storing user's plants
CREATE TABLE IF NOT EXISTS plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  species TEXT,
  scientific_name TEXT,
  image_url TEXT,
  location TEXT,
  sunlight_level TEXT CHECK (sunlight_level IN ('low', 'medium', 'bright', 'direct')),
  watering_frequency_days INTEGER DEFAULT 7,
  fertilizing_frequency_days INTEGER DEFAULT 30,
  last_watered TIMESTAMP WITH TIME ZONE,
  last_fertilized TIMESTAMP WITH TIME ZONE,
  next_water_date TIMESTAMP WITH TIME ZONE,
  next_fertilize_date TIMESTAMP WITH TIME ZONE,
  humidity_preference TEXT,
  temperature_range TEXT,
  care_notes TEXT,
  sources JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create import_sessions table for tracking plant identification progress
CREATE TABLE IF NOT EXISTS import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT CHECK (status IN ('uploading', 'identifying', 'researching', 'comparing', 'confirming', 'completed', 'failed')) DEFAULT 'uploading',
  image_url TEXT,
  identified_species TEXT,
  scientific_name TEXT,
  confidence DECIMAL(3, 2),
  research_sources JSONB DEFAULT '[]'::jsonb,
  care_requirements JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_plants_next_water ON plants(next_water_date);
CREATE INDEX IF NOT EXISTS idx_plants_next_fertilize ON plants(next_fertilize_date);
CREATE INDEX IF NOT EXISTS idx_import_sessions_status ON import_sessions(status);
