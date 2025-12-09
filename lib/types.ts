export interface Plant {
  id: string
  name: string
  species: string | null
  scientific_name: string | null
  image_url: string | null
  location: string | null
  sunlight_level: "low" | "medium" | "bright" | "direct" | null
  watering_frequency_days: number
  fertilizing_frequency_days: number
  last_watered: string | null
  last_fertilized: string | null
  next_water_date: string | null
  next_fertilize_date: string | null
  humidity_preference: string | null
  temperature_range: string | null
  care_notes: string | null
  sources: ResearchSource[]
  created_at: string
  updated_at: string
}

export interface ResearchSource {
  name: string
  url?: string
  recommendation: string
}

export interface ImportSession {
  id: string
  status: "uploading" | "identifying" | "researching" | "comparing" | "confirming" | "completed" | "failed"
  image_url: string | null
  identified_species: string | null
  scientific_name: string | null
  confidence: number | null
  research_sources: ResearchSource[]
  care_requirements: CareRequirements | null
  error_message: string | null
  plant_id: string | null
  created_at: string
  updated_at: string
  current_action?: string
  partial_data?: Partial<{
    identified_species: string
    scientific_name: string
    confidence: number
    care_requirements: Partial<CareRequirements>
    research_sources: ResearchSource[]
  }>
}

export interface CareRequirements {
  watering_frequency_days: number
  fertilizing_frequency_days: number
  sunlight_level: "low" | "medium" | "bright" | "direct"
  humidity_preference: string
  temperature_range: string
  care_notes: string
}
