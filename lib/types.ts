export interface PlantPhoto {
  id: string
  url: string
  order: number
}

export interface Plant {
  id: string
  name: string
  species: string | null
  scientific_name: string | null
  image_url: string | null
  photos: PlantPhoto[]
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
  watering_frequency_days?: number
  fertilizing_frequency_days?: number
  sunlight_level?: "low" | "medium" | "bright" | "direct"
  humidity_preference?: string
  temperature_range?: string
}

export interface PlantSuggestion {
  common_name: string
  scientific_name: string
  confidence: number
  votes: number
}

export interface ImportSession {
  id: string
  status: "uploading" | "identifying" | "researching" | "comparing" | "confirming" | "completed" | "failed" | "needs_selection"
  image_url: string | null
  plant_name: string | null
  plant_location: string | null
  identified_species: string | null
  scientific_name: string | null
  confidence: number | null
  suggestions: PlantSuggestion[] | null
  research_sources: ResearchSource[]
  care_requirements: CareRequirements | null
  error_message: string | null
  plant_id: string | null
  created_at: string
  updated_at: string
}

export interface CareRequirements {
  watering_frequency_days: number
  fertilizing_frequency_days: number
  sunlight_level: "low" | "medium" | "bright" | "direct"
  humidity_preference: string
  temperature_range: string
  care_notes: string
}

export interface CareHistoryItem {
  id: string
  plant_id: string
  care_type: "water" | "fertilize"
  performed_at: string
  notes: string | null
  created_at: string
}
