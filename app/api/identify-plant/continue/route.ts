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
  watering_frequency_days: z.number().describe("Recommended days between watering"),
  fertilizing_frequency_days: z.number().describe("Recommended days between fertilizing"),
  sunlight_level: z.enum(["low", "medium", "bright", "direct"]).describe("Light requirements"),
  humidity_preference: z.string().describe("Humidity needs"),
  temperature_range: z.string().describe("Ideal temperature range"),
  care_notes: z.string().describe("Key care recommendations from this source"),
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
    await supabase
      .from("import_sessions")
      .update({
        status: "confirming",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
    
    const careRequirements = consolidateCareRequirements(researchedSources)

    // Auto-create the plant
    console.log(`[Continue] Creating plant: ${session.plant_name || species}`)
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
        url: s.source_url,
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
