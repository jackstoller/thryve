import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateObject } from "ai"
import { z } from "zod"
import * as cheerio from "cheerio"

const MODELS = ["anthropic/claude-sonnet-4-20250514"]

// Schema for care research from a single source
const careResearchSchema = z.object({
  source_name: z.string().describe("Name of the authoritative source"),
  source_url: z.string().describe("URL of the source"),
  has_watering_info: z.boolean().describe("True if source explicitly mentions watering frequency"),
  watering_frequency_days: z.number().describe("Recommended days between watering from this source"),
  has_fertilizing_info: z.boolean().describe("True if source explicitly mentions fertilizing frequency"),
  fertilizing_frequency_days: z.number().describe("Recommended days between fertilizing from this source"),
  has_light_info: z.boolean().describe("True if source explicitly mentions light requirements"),
  sunlight_level: z.enum(["low", "medium", "bright", "direct"]).describe("Light requirements from this source"),
  has_humidity_info: z.boolean().describe("True if source explicitly mentions humidity needs"),
  humidity_preference: z.string().describe("Humidity needs from this source"),
  has_temperature_info: z.boolean().describe("True if source explicitly mentions temperature range"),
  temperature_range: z.string().describe("Ideal temperature range from this source"),
  care_notes: z.string().describe("Direct quotes or specific care tips from this source"),
  confidence: z.number().min(0).max(1).describe("Your confidence that this information is actually from the source content (0-1). Use 0 if you had to guess or make assumptions."),
})

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
  console.log(`[Research] Starting real web research for: ${species} (${scientificName})`)
  
  const MIN_SOURCES_REQUIRED = 3
  const MIN_CONFIDENCE = 0.5 // Minimum confidence to accept a source
  const researched: z.infer<typeof careResearchSchema>[] = []
  
  // Try progressively broader searches if needed
  const searchStrategies = [
    `${species} ${scientificName} plant care watering fertilizing light requirements`,
    `${scientificName} care guide watering sunlight`,
    `${species} plant care instructions`,
    `how to care for ${species} ${scientificName}`,
  ]
  
  for (let strategyIndex = 0; strategyIndex < searchStrategies.length && researched.length < MIN_SOURCES_REQUIRED; strategyIndex++) {
    const searchQuery = searchStrategies[strategyIndex]
    console.log(`[Research] Search strategy ${strategyIndex + 1}/${searchStrategies.length}: "${searchQuery}"`)
    
    const searchResults = await searchWeb(searchQuery)
    console.log(`[Research] Found ${searchResults.length} search results for strategy ${strategyIndex + 1}`)
  
    // Keep trying sources until we have enough valid ones
    for (let index = 0; index < searchResults.length && researched.length < MIN_SOURCES_REQUIRED; index++) {
      const result = searchResults[index]
      
      // Skip if we already used this URL
      if (researched.some(r => r.source_url === result.url)) {
        console.log(`[Research] Skipping duplicate source: ${result.url}`)
        continue
      }
      
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

CRITICAL INSTRUCTIONS:
1. Extract information ONLY if it is EXPLICITLY stated in the content above
2. For each field, first set the has_*_info boolean to indicate if that information exists
3. If information is NOT in the content, set has_*_info to false and provide a reasonable default value
4. Set your confidence score based on how explicitly the information is stated:
   - 1.0: Explicitly stated with specific numbers/details
   - 0.7-0.9: Clearly implied or described without exact numbers
   - 0.3-0.6: Vague mentions or general statements
   - 0.0-0.2: No information found, you're guessing
5. NEVER make up specific numbers if they aren't in the content
6. If most information is missing, set confidence to 0.0 and we'll try another source

Provide:
1. source_name: "${result.title}"
2. source_url: "${result.url}"
3. has_watering_info: true only if watering frequency is explicitly mentioned
4. watering_frequency_days: Convert phrases like "weekly"=7, "bi-weekly"=14, "twice a week"=3, "monthly"=30. Default to 7 if not mentioned.
5. has_fertilizing_info: true only if fertilizing frequency is explicitly mentioned
6. fertilizing_frequency_days: Same conversion rules. Default to 30 if not mentioned.
7. has_light_info: true only if light requirements are mentioned
8. sunlight_level: MUST be one of: "low", "medium", "bright", "direct" based on content
   - low: shade, low light, indirect light, north-facing
   - medium: partial sun, filtered light, moderate light
   - bright: bright indirect, east/west windows, lots of light
   - direct: full sun, direct sunlight, south-facing, outdoor sun
   Default to "medium" if not mentioned.
9. has_humidity_info: true only if humidity is mentioned
10. humidity_preference: "low" (<40%), "moderate" (40-60%), or "high" (>60%). Default to "moderate" if not mentioned.
11. has_temperature_info: true only if temperature range is mentioned
12. temperature_range: in Fahrenheit (e.g., "60-75°F"). Default to "60-75°F" if not mentioned.
13. care_notes: ONLY direct quotes or paraphrases from the content. If no specific care tips, say "No specific care information available from this source"
14. confidence: Your overall confidence score (0-1) that the information came from the source`

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

        const extractedData = result_obj.object
        
        // Validate the source has sufficient information and confidence
        const infoCount = [
          extractedData.has_watering_info,
          extractedData.has_fertilizing_info,
          extractedData.has_light_info,
          extractedData.has_humidity_info,
          extractedData.has_temperature_info
        ].filter(Boolean).length
        
        console.log(`[Research] Source ${index + 1} - Confidence: ${extractedData.confidence}, Info fields: ${infoCount}/5`)
        
        if (extractedData.confidence < MIN_CONFIDENCE) {
          console.warn(`[Research] Source ${index + 1} rejected - confidence too low (${extractedData.confidence} < ${MIN_CONFIDENCE})`)
          continue
        }
        
        if (infoCount < 2) {
          console.warn(`[Research] Source ${index + 1} rejected - insufficient information (${infoCount}/5 fields)`)
          continue
        }

        console.log(`[Research] Successfully extracted care info from source ${index + 1}`)
        console.log(`[Research] - Source: ${extractedData.source_name}`)
        console.log(`[Research] - Watering: ${extractedData.watering_frequency_days} days (explicit: ${extractedData.has_watering_info})`)
        console.log(`[Research] - Fertilizing: ${extractedData.fertilizing_frequency_days} days (explicit: ${extractedData.has_fertilizing_info})`)
        console.log(`[Research] - Light: ${extractedData.sunlight_level} (explicit: ${extractedData.has_light_info})`)
        
        researched.push(extractedData)
        console.log(`[Research] Successfully added source ${researched.length}/${MIN_SOURCES_REQUIRED}`)
      } catch (error) {
        console.error(`[Research] Error processing source ${index + 1}:`, error)
        // Continue to next source
      }
    }
    
    if (researched.length >= MIN_SOURCES_REQUIRED) {
      console.log(`[Research] Successfully gathered ${researched.length} valid sources`)
      break
    }
    
    if (strategyIndex < searchStrategies.length - 1) {
      console.log(`[Research] Only found ${researched.length}/${MIN_SOURCES_REQUIRED} sources, trying next search strategy...`)
    }
  }
  
  // Check if we met minimum requirements
  if (researched.length < MIN_SOURCES_REQUIRED) {
    const errorMsg = `Unable to find sufficient reliable care information. Found ${researched.length} valid source(s) out of ${MIN_SOURCES_REQUIRED} required. The available sources either lacked specific care details or the information couldn't be verified with sufficient confidence. Please add this plant manually with care instructions from a trusted source.`
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

    console.log(`[Continue] Starting REAL web research for: ${species} (${scientific_name})`)

    // Research from multiple sources - REAL WEB SEARCH
    const researchedSources = await researchCareSources(species, scientific_name)
    
    console.log(`[Continue] Completed real web research with ${researchedSources.length} sources`)

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

    // Consolidate care requirements
    console.log(`[Continue] Consolidating care requirements for ${species}`)
    const careRequirements = consolidateCareRequirements(researchedSources)
    
    // Update session with care requirements and set to confirming status
    // User will review and manually confirm to create the plant
    await supabase
      .from("import_sessions")
      .update({
        status: "confirming",
        care_requirements: careRequirements,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)

    console.log(`[Continue] Research complete. Session ready for user confirmation.`)
    return NextResponse.json({ success: true, careRequirements })
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
