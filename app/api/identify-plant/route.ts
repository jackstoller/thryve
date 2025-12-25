import { generateObject, generateText } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import * as cheerio from "cheerio"

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
  source_url: z.string().describe("URL of the source"),
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

async function searchWithTavily(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    console.log('[Tavily] API key not found')
    return []
  }

  try {
    console.log(`[Tavily] Searching for: ${query}`)
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        include_domains: ['rhs.org.uk', 'missouribotanicalgarden.org', 'extension.org', '.edu', '.gov'],
        max_results: 5
      })
    })

    if (!response.ok) {
      throw new Error(`Tavily search failed: ${response.status}`)
    }

    const data = await response.json()
    console.log(`[Tavily] Found ${data.results?.length || 0} results`)
    
    return data.results?.map((r: any) => ({
      title: r.title,
      url: r.url,
      snippet: r.content
    })) || []
  } catch (error) {
    console.error('[Tavily] Error:', error)
    return []
  }
}

async function searchWeb(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  // Try Tavily API first (best for research)
  const tavilyResults = await searchWithTavily(query)
  if (tavilyResults.length > 0) {
    return tavilyResults
  }

  try {
    console.log(`[Web Search] Searching DuckDuckGo for: ${query}`)
    
    // Use DuckDuckGo HTML search (no API key required)
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(5000)
    })
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`)
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    const results: { title: string; url: string; snippet: string }[] = []
    
    // Parse DuckDuckGo results
    $('.result').each((i, elem) => {
      if (results.length >= 5) return false
      
      const titleElem = $(elem).find('.result__a')
      const snippetElem = $(elem).find('.result__snippet')
      const urlElem = $(elem).find('.result__url')
      
      const title = titleElem.text().trim()
      let url = titleElem.attr('href') || ''
      const snippet = snippetElem.text().trim()
      
      // Extract actual URL from DuckDuckGo redirect
      if (url.includes('uddg=')) {
        const urlMatch = url.match(/uddg=([^&]+)/)
        if (urlMatch) {
          url = decodeURIComponent(urlMatch[1])
        }
      }
      
      if (title && url && snippet) {
        results.push({ title, url, snippet })
      }
    })
    
    console.log(`[Web Search] Found ${results.length} DuckDuckGo results`)
    
    if (results.length === 0) {
      throw new Error('No search results found')
    }
    
    return results
  } catch (error) {
    console.error('[Web Search] Error:', error)
    
    // Fallback to direct database URLs
    const plantName = query.split(' care')[0].trim()
    console.log(`[Web Search] Using direct database URLs for: ${plantName}`)
    
    const PLANT_DATABASES = [
      {
        name: "Royal Horticultural Society",
        searchUrl: (plant: string) => `https://www.rhs.org.uk/search?query=${encodeURIComponent(plant)}`,
      },
      {
        name: "Missouri Botanical Garden",
        searchUrl: (plant: string) => `https://www.missouribotanicalgarden.org/PlantFinder/FullQuery.aspx?searchterm=${encodeURIComponent(plant)}`,
      },
      {
        name: "University Extension Services",
        searchUrl: (plant: string) => `https://extension.org/?s=${encodeURIComponent(plant + " care")}`,
      }
    ]
    
    return PLANT_DATABASES.map(db => ({
      title: `${plantName} - ${db.name}`,
      url: db.searchUrl(plantName),
      snippet: `Plant care information from ${db.name}`
    }))
  }
}

async function fetchWebContent(url: string): Promise<string> {
  try {
    console.log(`[Web Fetch] Fetching: ${url}`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.warn(`[Web Fetch] HTTP ${response.status} from ${url}`)
      return ''
    }
    
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) {
      console.warn(`[Web Fetch] Non-HTML content type: ${contentType}`)
      return ''
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    // Remove unwanted elements
    $('script, style, nav, footer, header, iframe, noscript, .advertisement, .ad, #comments, .cookie-banner, .popup').remove()
    
    // Try to find main content area
    let content = ''
    const contentSelectors = [
      '[role="main"]',
      'main',
      'article',
      '.main-content',
      '.article-content',
      '#main-content',
      '.content',
      '#content',
      '.article-body',
      '.post-content',
      '.entry-content'
    ]
    
    for (const selector of contentSelectors) {
      const elem = $(selector).first()
      if (elem.length > 0) {
        content = elem.text()
        console.log(`[Web Fetch] Found content using selector: ${selector}`)
        break
      }
    }
    
    // Fallback to body if no main content found
    if (!content || content.length < 100) {
      console.log('[Web Fetch] Using body content as fallback')
      content = $('body').text()
    }
    
    // Clean up the text
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\t+/g, ' ')
      .trim()
    
    // Look for plant care-specific content
    const careKeywords = ['water', 'fertiliz', 'light', 'sun', 'temperature', 'humidity', 'soil', 'care', 'growing', 'plant']
    const sentences = content.split(/[.!?]+\s+/)
    const relevantSentences = sentences.filter(sentence => 
      sentence.length > 20 &&
      careKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
    )
    
    // Prefer relevant content if we found enough
    let finalContent = content
    if (relevantSentences.length > 5) {
      finalContent = relevantSentences.join('. ') + '.'
      console.log(`[Web Fetch] Filtered to ${relevantSentences.length} relevant sentences`)
    }
    
    const charCount = Math.min(finalContent.length, 10000)
    console.log(`[Web Fetch] Extracted ${charCount} characters`)
    return finalContent.slice(0, 10000)
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[Web Fetch] Timeout after 8 seconds')
    } else {
      console.error('[Web Fetch] Error:', error.message)
    }
    return ''
  }
}

async function researchCareSources(species: string, scientificName: string) {
  console.log(`[Research] Starting REAL web research for: ${species} (${scientificName})`)
  
  // Search for plant care information
  const searchQuery = `${species} ${scientificName} plant care watering fertilizing light requirements`
  const searchResults = await searchWeb(searchQuery)
  
  console.log(`[Research] Found ${searchResults.length} search results`)

  const researched: z.infer<typeof careResearchSchema>[] = []
  const MIN_SOURCES_REQUIRED = 3
  
  // Keep trying until we have 3 sources or run out of search results
  for (let index = 0; index < searchResults.length && researched.length < MIN_SOURCES_REQUIRED; index++) {
    const result = searchResults[index]
    console.log(`[Research] Processing source ${index + 1}/${searchResults.length} (have ${researched.length}/${MIN_SOURCES_REQUIRED}): ${result.title}`)
    
    try {
      // Fetch actual web content
      const webContent = await fetchWebContent(result.url)
      
      // Use snippet if web content fetch failed
      const contentToAnalyze = webContent && webContent.length >= 100 
        ? webContent 
        : result.snippet
      
      if (!contentToAnalyze || contentToAnalyze.length < 20) {
        console.warn(`[Research] Insufficient content from source ${index + 1}, skipping and trying next`)
        continue
      }
      
      console.log(`[Research] Analyzing ${contentToAnalyze.length} characters from source ${index + 1}`)
      
      const prompt = `You are analyzing plant care information for ${species} (${scientificName}) from ${result.title}.

Content to analyze:
${contentToAnalyze}

Extract specific care recommendations from this content. Provide:

1. source_name: "${result.title}"
2. source_url: "${result.url}"
3. watering_frequency_days: Number of days between waterings (look for phrases like "weekly", "every X days", "twice a week", etc. Convert to days: weekly=7, bi-weekly=14, monthly=30)
4. fertilizing_frequency_days: Days between fertilizing (monthly=30, bi-weekly=14, etc.)
5. sunlight_level: MUST be one of: "low", "medium", "bright", "direct"
   - low: shade, indirect light, north-facing
   - medium: partial sun, filtered light
   - bright: bright indirect, east/west windows
   - direct: full sun, south-facing, outdoor sun
6. humidity_preference: "low" (<40%), "moderate" (40-60%), or "high" (>60%)
7. temperature_range: in Fahrenheit (e.g., "60-75°F")
8. care_notes: 2-3 bullet points (max 15 words each) with the MOST important care tips from this source

Extract information ONLY from the content provided. Be specific with numbers.`

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

      console.log(`[Research] Successfully extracted care info from source ${index + 1}`)
      console.log(`[Research] - Source: ${result_obj.object.source_name}`)
      console.log(`[Research] - Watering: ${result_obj.object.watering_frequency_days} days`)
      console.log(`[Research] - Fertilizing: ${result_obj.object.fertilizing_frequency_days} days`)
      console.log(`[Research] - Light: ${result_obj.object.sunlight_level}`)
      
      researched.push(result_obj.object)
      console.log(`[Research] Successfully added source ${researched.length}/${MIN_SOURCES_REQUIRED}`)
    } catch (error) {
      console.error(`[Research] Error processing source ${index + 1}:`, error)
      // Continue to next source
    }
  }
  
  // Check if we met minimum requirements
  if (researched.length < MIN_SOURCES_REQUIRED) {
    const errorMsg = `Failed to gather sufficient research data. Only found ${researched.length} valid source(s) out of ${MIN_SOURCES_REQUIRED} required. Unable to provide reliable care recommendations.`
    console.error(`[Research] ${errorMsg}`)
    throw new Error(errorMsg)
  }

  console.log(`[Research] Successfully processed ${researched.length} sources with real web data`)
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
          url: s.source_url,
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
    console.log(`[Processing] Session ${sessionId} - consolidating care requirements`)
    await supabase
      .from("import_sessions")
      .update({
        status: "confirming",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
    
    const careRequirements = consolidateCareRequirements(researchedSources)

    // Step 4: Auto-create the plant using user-provided name and location
    console.log(`[Processing] Session ${sessionId} - creating plant`)
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
        url: s.source_url,
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
