import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateObject } from "ai"
import { z } from "zod"

const MODELS = ["anthropic/claude-sonnet-4-20250514"]

// Schema for care research from a single source
const careResearchSchema = z.object({
  source_name: z.string().describe("Name of the authoritative source"),
  watering_frequency_days: z.number().describe("Recommended days between watering"),
  fertilizing_frequency_days: z.number().describe("Recommended days between fertilizing"),
  sunlight_level: z.enum(["low", "medium", "bright", "direct"]).describe("Light requirements"),
  humidity_preference: z.string().describe("Humidity needs"),
  temperature_range: z.string().describe("Ideal temperature range"),
  care_notes: z.string().describe("Key care recommendations from this source"),
})

async function researchCareSources(species: string, scientificName: string) {
  const sources = [
    "Royal Horticultural Society (RHS)",
    "Missouri Botanical Garden",
    "University Extension Services",
  ]

  const researched = await Promise.all(
    sources.map(async (sourceName) => {
      const result = await generateObject({
        model: MODELS[0],
        schema: careResearchSchema,
        messages: [
          {
            role: "user",
            content: `You are a plant care expert with deep knowledge of ${sourceName} recommendations.

For ${species} (${scientificName}), provide care recommendations based on ${sourceName} guidelines:

1. source_name: "${sourceName}"
2. watering_frequency_days: Number of days between waterings
3. fertilizing_frequency_days: Number of days between fertilizing applications
4. sunlight_level: Must be exactly one of: "low", "medium", "bright", "direct"
5. humidity_preference: e.g., "moderate", "high", "low"
6. temperature_range: e.g., "60-75°F" or "15-24°C"
7. care_notes: Key care recommendations specific to this plant from this source

Be specific with numbers and provide accurate recommendations this source would give.`,
          },
        ],
      })

      return result.object
    }),
  )

  return researched
}

function consolidateCareRequirements(sources: z.infer<typeof careResearchSchema>[]) {
  // Average numerical values
  const avgWatering = Math.round(
    sources.reduce((sum, s) => sum + s.watering_frequency_days, 0) / sources.length,
  )
  const avgFertilizing = Math.round(
    sources.reduce((sum, s) => sum + s.fertilizing_frequency_days, 0) / sources.length,
  )

  // Most common sunlight level
  const sunlightVotes = sources.map((s) => s.sunlight_level)
  const sunlightCounts: Record<string, number> = {}
  sunlightVotes.forEach((level) => {
    sunlightCounts[level] = (sunlightCounts[level] || 0) + 1
  })
  const sunlightLevel = Object.entries(sunlightCounts).reduce((a, b) => (a[1] > b[1] ? a : b))[0] as
    | "low"
    | "medium"
    | "bright"
    | "direct"

  // Combine care notes
  const combinedNotes = sources.map((s) => s.care_notes).join(" ")

  return {
    watering_frequency_days: avgWatering,
    fertilizing_frequency_days: avgFertilizing,
    sunlight_level: sunlightLevel,
    humidity_preference: sources[0].humidity_preference,
    temperature_range: sources[0].temperature_range,
    care_notes: combinedNotes,
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, species, scientific_name } = await request.json()

    if (!sessionId || !species || !scientific_name) {
      return NextResponse.json(
        { error: "Session ID, species, and scientific name are required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get the session
    const { data: session } = await supabase
      .from("import_sessions")
      .select("*")
      .eq("id", sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Research from multiple sources
    const researchedSources = await researchCareSources(species, scientific_name)

    await supabase
      .from("import_sessions")
      .update({
        status: "comparing",
        research_sources: researchedSources.map((s) => ({
          name: s.source_name,
          recommendation: s.care_notes,
          watering_frequency_days: s.watering_frequency_days,
          fertilizing_frequency_days: s.fertilizing_frequency_days,
          sunlight_level: s.sunlight_level,
          humidity_preference: s.humidity_preference,
          temperature_range: s.temperature_range,
        })),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)

    // Consolidate care requirements
    const careRequirements = consolidateCareRequirements(researchedSources)

    // Auto-create the plant
    const plantPayload = {
      name: session.plant_name || species,
      location: session.plant_location || null,
      species: species,
      scientific_name: scientific_name,
      image_url: session.image_url,
      sunlight_level: careRequirements.sunlight_level,
      watering_frequency_days: careRequirements.watering_frequency_days,
      fertilizing_frequency_days: careRequirements.fertilizing_frequency_days,
      humidity_preference: careRequirements.humidity_preference,
      temperature_range: careRequirements.temperature_range,
      care_notes: careRequirements.care_notes,
      sources: researchedSources.map((s) => ({
        name: s.source_name,
        recommendation: s.care_notes,
      })),
    }

    const createPlantRes = await fetch(`${request.nextUrl.origin}/api/plants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plantPayload),
    })

    if (!createPlantRes.ok) {
      throw new Error("Failed to create plant")
    }

    const plant = await createPlantRes.json()

    // Mark session as complete
    await supabase
      .from("import_sessions")
      .update({
        status: "completed",
        care_requirements: careRequirements,
        plant_id: plant.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)

    return NextResponse.json({ success: true, plant })
  } catch (error) {
    console.error("[Continue] Error:", error)
    
    const { sessionId } = await request.json()
    if (sessionId) {
      const supabase = await createClient()
      await supabase
        .from("import_sessions")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Failed to continue identification",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to continue identification" },
      { status: 500 }
    )
  }
}
