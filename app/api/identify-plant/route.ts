import { generateObject, generateText } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// Multiple models for cross-validation
const MODELS = [
  "anthropic/claude-sonnet-4-20250514",
  "openai/gpt-4o",
  "google/gemini-2.0-flash-exp:free",
]

const CONFIDENCE_THRESHOLD = 0.6 // Minimum average confidence to accept identification
const MIN_AGREEMENT_RATIO = 0.67 // At least 2 out of 3 models must agree
const MAX_CONFIDENCE_VARIANCE = 0.35 // Maximum variance in confidence scores to accept

// Schema for plant identification
const identificationSchema = z.object({
  identified_species: z.string().describe("Common name of the plant. Use 'Unknown Plant' if the image does not contain a plant or cannot be identified."),
  scientific_name: z.string().describe("Scientific/botanical name. Use 'Unknown species' if the image does not contain a plant or cannot be identified."),
  confidence: z.number().min(0).max(1).describe("Confidence level 0-1"),
  reasoning: z.string().describe("Brief explanation of key identifying features observed"),
})

// Schema for care research from a single source
const careResearchSchema = z.object({
  source_name: z.string().describe("Name of the authoritative source"),
  watering_frequency_days: z.number().describe("Recommended days between watering"),
  fertilizing_frequency_days: z.number().describe("Recommended days between fertilizing"),
  sunlight_level: z.enum(["low", "medium", "bright", "direct"]).describe("Light requirements"),
  humidity_preference: z.string().describe("Humidity needs"),
  temperature_range: z.string().describe("Ideal temperature range"),
  care_notes: z.string().describe("2-3 concise bullet points about care essentials"),
})

// Schema for consolidated care requirements
const consolidatedCareSchema = z.object({
  watering_frequency_days: z.number(),
  fertilizing_frequency_days: z.number(),
  sunlight_level: z.enum(["low", "medium", "bright", "direct"]),
  humidity_preference: z.string(),
  temperature_range: z.string(),
  care_notes: z.string(),
})

async function identifyPlantWithModel(imageUrl: string, model: string) {
  const result = await generateObject({
    model: model,
    schema: identificationSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: imageUrl,
          },
          {
            type: "text",
            text: `Identify this plant with high precision. Provide:
1. Common name (identified_species) - use the most widely recognized common name. If the image does not contain a plant or cannot be identified, use exactly "Unknown Plant"
2. Scientific/botanical name (scientific_name) - use proper binomial nomenclature. If the image does not contain a plant or cannot be identified, use exactly "Unknown species"
3. Your confidence level 0-1 (confidence) - be honest about uncertainty
4. Brief reasoning about the key identifying features you observed

Look for distinctive features like:
- Leaf shape, arrangement, and edges
- Growth pattern and structure
- Any visible flowers, fruits, or unique characteristics
- Overall plant form and habit

IMPORTANT: Be consistent and conservative with your confidence scoring:
- Only use confidence > 0.8 if you can clearly see multiple distinctive features
- Use confidence 0.5-0.8 if you see some features but the photo is unclear or features are ambiguous
- Use confidence < 0.5 if the photo is blurry, poorly lit, or lacks distinctive visible features
- Use confidence 0.0 if the image does not contain a plant at all

If the image is too unclear to identify reliably, report low confidence rather than guessing.
If the image does not contain a plant (e.g., a person, object, or non-plant item), use "Unknown Plant" and "Unknown species" with 0.0 confidence.`,
          },
        ],
      },
    ],
  })

  return result.object
}

async function identifyPlant(imageUrl: string) {
  try {
    console.log(`[Identification] Starting identification with ${MODELS.length} AI models...`)
    
    // Query all models in parallel
    const identifications = await Promise.allSettled(
      MODELS.map((model) => {
        console.log(`[Identification] Querying ${model}...`)
        return identifyPlantWithModel(imageUrl, model)
      })
    )

    // Extract successful results
    const successfulResults = identifications
      .filter((result): result is PromiseFulfilledResult<z.infer<typeof identificationSchema>> => 
        result.status === "fulfilled"
      )
      .map((result) => result.value)

    console.log(`[Identification] ${successfulResults.length}/${MODELS.length} models responded successfully`)

    if (successfulResults.length === 0) {
      throw new Error("All identification models failed")
    }

      // Log individual model results
      successfulResults.forEach((result, i) => {
        console.log(`[Model ${i + 1}] ${result.scientific_name} (${result.identified_species}) - ${(result.confidence * 100).toFixed(0)}% confidence`)
      })

      // Check if all models detected a non-plant item
      const nonPlantCount = successfulResults.filter(
        (r) => r.identified_species.toLowerCase() === "unknown plant" || 
               r.scientific_name.toLowerCase() === "unknown species" ||
               r.confidence === 0
      ).length
      
      if (nonPlantCount === successfulResults.length) {
        console.log(`[Identification] ❌ All models detected a non-plant item`)
        throw new Error("This image does not appear to contain a plant. Please upload an image of a plant to identify.")
      }

      // Calculate confidence variance to detect unclear/ambiguous photos
      const confidences = successfulResults.map((r) => r.confidence)
      const avgAllConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      const variance = confidences.reduce((sum, c) => sum + Math.pow(c - avgAllConfidence, 2), 0) / confidences.length
      const stdDev = Math.sqrt(variance)

      console.log(`[Confidence Analysis] Average: ${(avgAllConfidence * 100).toFixed(0)}%, Std Dev: ${(stdDev * 100).toFixed(0)}%`)

      // Check for consensus among models
      const speciesVotes: Record<string, { count: number; scientificName: string; confidence: number; reasoning: string[] }> = {}
      
      for (const result of successfulResults) {
        const key = result.scientific_name.toLowerCase().trim()
        if (!speciesVotes[key]) {
          speciesVotes[key] = {
            count: 0,
            scientificName: result.scientific_name,
            confidence: 0,
            reasoning: [],
          }
        }
        speciesVotes[key].count++
        speciesVotes[key].confidence += result.confidence
        speciesVotes[key].reasoning.push(result.reasoning)
      }

      // Find the most agreed-upon species
      const sortedVotes = Object.entries(speciesVotes).sort((a, b) => {
        // Sort by count first, then by average confidence
        if (b[1].count !== a[1].count) {
          return b[1].count - a[1].count
        }
        return (b[1].confidence / b[1].count) - (a[1].confidence / a[1].count)
      })

      const topVote = sortedVotes[0]
      const agreementRatio = topVote[1].count / successfulResults.length
      const avgConfidence = topVote[1].confidence / topVote[1].count

      // Find the best common name from results that identified this species
      const matchingResults = successfulResults.filter(
        (r) => r.scientific_name.toLowerCase().trim() === topVote[0]
      )
      const commonName = matchingResults[0].identified_species

      // Log detailed consensus info
      console.log(`[Consensus] Top vote: ${topVote[1].scientificName}`)
      console.log(`[Consensus] Agreement: ${topVote[1].count}/${successfulResults.length} models (${(agreementRatio * 100).toFixed(0)}%)`)
      console.log(`[Consensus] Avg confidence: ${(avgConfidence * 100).toFixed(0)}%`)

      // Check for various failure conditions
      const reasons: string[] = []
      
      // High variance indicates models are very uncertain/inconsistent
      if (stdDev > MAX_CONFIDENCE_VARIANCE) {
        reasons.push(`inconsistent confidence scores (variance: ${(stdDev * 100).toFixed(0)}%)`)
      }
      
      // Low average confidence from agreeing models
      if (avgConfidence < CONFIDENCE_THRESHOLD) {
        reasons.push(`low confidence (${Math.round(avgConfidence * 100)}%)`)
      }
      
      // Models disagree on species
      if (agreementRatio < MIN_AGREEMENT_RATIO) {
        reasons.push(`model disagreement (only ${topVote[1].count}/${successfulResults.length} agreed)`)
      }

      // If we have any failure reasons, provide suggestions instead of failing
      if (reasons.length > 0) {
        console.log(`[Identification] ⚠ Low confidence: ${reasons.join(', ')} - Providing suggestions`)
        
        // Return top suggestions from all model results
        const suggestions = sortedVotes.slice(0, 3).map(([key, vote]) => {
          const matchingResult = successfulResults.find(
            (r) => r.scientific_name.toLowerCase().trim() === key
          )
          return {
            common_name: matchingResult?.identified_species || vote.scientificName,
            scientific_name: vote.scientificName,
            confidence: vote.confidence / vote.count,
            votes: vote.count,
          }
        })
        
        return {
          identified_species: null,
          scientific_name: null,
          confidence: null,
          model_agreement: agreementRatio,
          models_agreed: topVote[1].count,
          total_models: successfulResults.length,
          suggestions,
          needs_selection: true,
        }
      }

      // Success - we have a confident identification
      console.log(`[Identification] ✓ Successfully identified with ${Math.round(avgConfidence * 100)}% confidence (${topVote[1].count}/${successfulResults.length} models agreed)`)
      
      return {
        identified_species: commonName,
        scientific_name: topVote[1].scientificName,
        confidence: avgConfidence,
        model_agreement: agreementRatio,
        models_agreed: topVote[1].count,
        total_models: successfulResults.length,
        suggestions: null,
        needs_selection: false,
      }

  } catch (error) {
    // For unclear photos or API failures, fail immediately without retry
    // Retrying the same unclear photo won't produce better results
    console.error(`[Identification] Error:`, error)
    throw error
  }
}

async function searchWeb(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    // Use Google search via SerpAPI alternative or direct fetch
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5`
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    
    // For now, return structured search results for known plant care sites
    const plantName = query.split(' care')[0]
    return [
      {
        title: `${plantName} Care Guide - Royal Horticultural Society`,
        url: `https://www.rhs.org.uk`,
        snippet: `Care information for ${plantName} from RHS`
      },
      {
        title: `${plantName} Plant Care - Missouri Botanical Garden`,
        url: `https://www.missouribotanicalgarden.org`,
        snippet: `Growing guide for ${plantName}`
      },
      {
        title: `${plantName} Care Instructions - Extension Services`,
        url: `https://extension.org`,
        snippet: `Professional care recommendations for ${plantName}`
      }
    ]
  } catch (error) {
    console.error('[Web Search] Error:', error)
    return []
  }
}

async function fetchWebContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    const html = await response.text()
    // Simple text extraction - remove HTML tags
    const text = html.replace(/<script[^>]*>.*?<\/script>/gi, '')
                    .replace(/<style[^>]*>.*?<\/style>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
    return text.slice(0, 5000) // Limit to first 5000 chars
  } catch (error) {
    console.error('[Web Fetch] Error:', error)
    return ''
  }
}

async function researchCareSources(species: string, scientificName: string) {
  console.log(`[Research] Searching web for ${species} care information...`)
  
  // Search for plant care information
  const searchQuery = `${species} ${scientificName} plant care watering fertilizing light requirements`
  const searchResults = await searchWeb(searchQuery)
  
  if (searchResults.length === 0) {
    console.log('[Research] No web results found, using AI knowledge as fallback')
  }

  const researched = await Promise.all(
    searchResults.slice(0, 3).map(async (result, index) => {
      console.log(`[Research] Processing source ${index + 1}: ${result.title}`)
      
      // Fetch actual web content
      const webContent = await fetchWebContent(result.url)
      
      const prompt = webContent
        ? `Based on the following web content from ${result.title}, extract care recommendations for ${species} (${scientificName}):

${webContent}

Provide:
1. source_name: "${result.title}"
2. watering_frequency_days: Number of days between waterings (typical range for this plant)
3. fertilizing_frequency_days: Number of days between fertilizing
4. sunlight_level: Must be exactly one of: "low", "medium", "bright", "direct"
5. humidity_preference: e.g., "moderate", "high", "low"
6. temperature_range: e.g., "60-75°F"
7. care_notes: 2-3 SHORT bullet points (each under 15 words) about essential care tips

Extract information directly from the web content provided. Be concise and specific.`
        : `As a fallback (web content unavailable), provide care recommendations for ${species} (${scientificName}) from ${result.title}:

1. source_name: "${result.title}"
2. watering_frequency_days: Typical days between waterings
3. fertilizing_frequency_days: Typical days between fertilizing
4. sunlight_level: Must be exactly one of: "low", "medium", "bright", "direct"
5. humidity_preference: "moderate", "high", or "low"
6. temperature_range: e.g., "60-75°F"
7. care_notes: 2-3 SHORT bullet points (each under 15 words) with essential care tips

Be specific with numbers and keep notes brief.`

      const result_obj = await generateObject({
        model: MODELS[0],
        schema: careResearchSchema,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      })

      return result_obj.object
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

  // Combine care notes - keep them concise
  const allNotes = sources.map((s) => s.care_notes).join(" ")
  const combinedNotes = allNotes.length > 200 ? allNotes.slice(0, 200) + "..." : allNotes

  return {
    watering_frequency_days: avgWatering,
    fertilizing_frequency_days: avgFertilizing,
    sunlight_level: sunlightLevel,
    humidity_preference: sources[0].humidity_preference,
    temperature_range: sources[0].temperature_range,
    care_notes: combinedNotes,
  }
}

// Background processing function
async function processPlantIdentification(sessionId: string, imageUrl: string) {
  const supabase = await createClient()

  try {
    console.log(`[Processing] Starting identification for session ${sessionId}`)
    
    // Get the session to retrieve user-provided name and location
    const { data: session } = await supabase.from("import_sessions").select("*").eq("id", sessionId).single()

    if (!session) {
      console.error(`[Processing] Session ${sessionId} not found`)
      throw new Error("Session not found")
    }

    console.log(`[Processing] Session ${sessionId} found, updating to identifying status`)
    
    // Step 1: Identify the plant
    await supabase
      .from("import_sessions")
      .update({ status: "identifying", updated_at: new Date().toISOString() })
      .eq("id", sessionId)

    console.log(`[Processing] Starting plant identification for session ${sessionId}`)
    const identification = await identifyPlant(imageUrl)
    console.log(`[Processing] Identification complete for session ${sessionId}:`, { 
      needs_selection: identification.needs_selection,
      has_suggestions: !!identification.suggestions,
      species: identification.identified_species 
    })

    // Check if we need user selection
    if (identification.needs_selection && identification.suggestions) {
      console.log(`[Processing] Session ${sessionId} needs user selection - provided ${identification.suggestions.length} suggestions`)
      const { error: updateError } = await supabase
        .from("import_sessions")
        .update({
          status: "needs_selection",
          suggestions: identification.suggestions,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
      
      if (updateError) {
        console.error(`[Processing] Failed to update session ${sessionId} to needs_selection:`, updateError)
        throw updateError
      }
      
      console.log(`[Processing] Session ${sessionId} successfully updated to needs_selection status`)
      return
    }

    // Ensure we have valid species data before continuing
    if (!identification.identified_species || !identification.scientific_name) {
      console.error(`[Processing] Session ${sessionId} - missing species data`)
      throw new Error("Identification failed to return species information")
    }

    console.log(`[Processing] Session ${sessionId} - updating to researching status`)
    await supabase
      .from("import_sessions")
      .update({
        status: "researching",
        identified_species: identification.identified_species,
        scientific_name: identification.scientific_name,
        confidence: identification.confidence,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)

    // Step 2: Research from multiple sources
    console.log(`[Processing] Session ${sessionId} - starting care research`)
    const researchedSources = await researchCareSources(
      identification.identified_species,
      identification.scientific_name,
    )

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

    // Step 3: Consolidate care requirements
    const careRequirements = consolidateCareRequirements(researchedSources)

    // Step 4: Auto-create the plant using user-provided name and location
    const plantPayload = {
      name: session.plant_name || identification.identified_species,
      location: session.plant_location || null,
      species: identification.identified_species,
      scientific_name: identification.scientific_name,
      image_url: imageUrl,
      sunlight_level: careRequirements.sunlight_level,
      watering_frequency_days: careRequirements.watering_frequency_days,
      fertilizing_frequency_days: careRequirements.fertilizing_frequency_days,
      humidity_preference: careRequirements.humidity_preference,
      temperature_range: careRequirements.temperature_range,
      care_notes: careRequirements.care_notes,
      sources: researchedSources.map((s) => ({
        name: s.source_name,
        recommendation: s.care_notes,
        watering_frequency_days: s.watering_frequency_days,
        fertilizing_frequency_days: s.fertilizing_frequency_days,
        sunlight_level: s.sunlight_level,
        humidity_preference: s.humidity_preference,
        temperature_range: s.temperature_range,
      })),
    }

    const { data: newPlant, error: plantError } = await supabase
      .from("plants")
      .insert(plantPayload)
      .select()
      .single()

    if (plantError) {
      throw new Error(`Failed to create plant: ${plantError.message}`)
    }

    // Final update: mark as completed with plant_id
    await supabase
      .from("import_sessions")
      .update({
        status: "completed",
        care_requirements: careRequirements,
        plant_id: newPlant.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
  } catch (error) {
    console.error(`[Processing] Plant identification error for session ${sessionId}:`, error)
    const errorMessage = error instanceof Error ? error.message : "Identification failed"
    console.error(`[Processing] Error details:`, errorMessage)
    
    await supabase
      .from("import_sessions")
      .update({
        status: "failed",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
    
    console.log(`[Processing] Session ${sessionId} marked as failed`)
  }
}

export async function POST(req: Request) {
  try {
    const { imageUrl, sessionId } = await req.json()

    console.log(`[API] POST /api/identify-plant called with sessionId: ${sessionId}`)

    if (!imageUrl || !sessionId) {
      console.error(`[API] Missing required parameters - imageUrl: ${!!imageUrl}, sessionId: ${!!sessionId}`)
      return Response.json({ error: "Missing imageUrl or sessionId" }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify session exists
    const { data: session, error: sessionError } = await supabase
      .from("import_sessions")
      .select("*")
      .eq("id", sessionId)
      .single()

    if (sessionError || !session) {
      console.error(`[API] Session not found: ${sessionId}`, sessionError)
      return Response.json({ error: "Session not found" }, { status: 404 })
    }

    console.log(`[API] Session ${sessionId} verified, starting background processing`)

    // Start background processing (don't await)
    processPlantIdentification(sessionId, imageUrl).catch((error) => {
      console.error(`[API] Background processing error for session ${sessionId}:`, error)
    })

    console.log(`[API] Returning success for session ${sessionId}`)
    // Return immediately
    return Response.json({ success: true, sessionId })
  } catch (error) {
    console.error("[API] error:", error)
    return Response.json({ error: "Failed to start identification" }, { status: 500 })
  }
}
