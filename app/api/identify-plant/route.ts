import { generateObject, generateText } from "ai"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import * as cheerio from "cheerio"
import { getModelEntries } from "@/lib/ai-provider"
import { requireUser } from "@/lib/supabase/require-user"

export const runtime = "nodejs"

const MODEL_ENTRIES = getModelEntries({
  // These IDs are OpenRouter model IDs.
  // If OPENROUTER_API_KEY is not set, we fall back to OpenAI directly.
  openRouterModelIds: [
    "anthropic/claude-sonnet-4-20250514",
    "openai/gpt-4o",
    "google/gemini-2.0-flash-exp:free",
  ],
  fallbackOpenAIModelId: "gpt-4o",
})

const CONFIDENCE_THRESHOLD = 0.6 // Minimum average confidence to accept identification
const MIN_AGREEMENT_RATIO = 0.67 // At least 2 out of 3 models must agree
const MAX_CONFIDENCE_VARIANCE = 0.35 // Maximum variance in confidence scores to accept

function isPrivateOrLocalhost(hostname: string) {
  const host = hostname.toLowerCase()

  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") return true

  // Very small guardrail: common RFC1918 ranges
  if (host.startsWith("10.")) return true
  if (host.startsWith("192.168.")) return true
  if (host.startsWith("172.")) {
    const parts = host.split(".")
    const secondOctet = Number(parts[1])
    if (Number.isFinite(secondOctet) && secondOctet >= 16 && secondOctet <= 31) return true
  }

  // Link-local (often not reachable from hosted environments)
  if (host.startsWith("169.254.")) return true

  return false
}

async function getModelImageInput(imageUrl: string): Promise<string> {
  // If it's already a data URL, just pass through.
  if (imageUrl.startsWith("data:")) return imageUrl

  // `blob:` URLs are browser-only and cannot be fetched server-side.
  if (imageUrl.startsWith("blob:")) {
    throw new Error(
      "Invalid imageUrl for server-side AI analysis: received a 'blob:' URL. Upload the image first and pass a public HTTP(S) URL or a data: URL."
    )
  }

  // Relative URLs also won't work without a request origin to resolve against.
  if (imageUrl.startsWith("/")) {
    throw new Error(
      "Invalid imageUrl for server-side AI analysis: received a relative URL. Pass an absolute http(s) URL (e.g. from Supabase Storage) or a data: URL."
    )
  }

  // If the URL is public, most providers can fetch it directly.
  // If it's localhost/private, we must fetch it server-side and inline it as base64.
  let parsed: URL | null = null
  try {
    parsed = new URL(imageUrl)
  } catch {
    parsed = null
  }

  const shouldInline = parsed ? isPrivateOrLocalhost(parsed.hostname) : true
  if (!shouldInline) return imageUrl

  // In Docker, `localhost` inside the container is NOT your host.
  // Our docker-compose sets `SUPABASE_URL=http://kong:8000` for server-side calls.
  // If the client stored a public URL like `http://localhost:54321/...`, rewrite it
  // to the Docker-internal gateway so we can fetch and inline the bytes.
  let fetchUrl = imageUrl
  if (parsed && isPrivateOrLocalhost(parsed.hostname)) {
    const internalSupabaseUrl = process.env.SUPABASE_URL
    if (internalSupabaseUrl && !internalSupabaseUrl.includes("localhost")) {
      try {
        const rewritten = new URL(parsed.pathname + parsed.search, internalSupabaseUrl)
        fetchUrl = rewritten.toString()
      } catch {
        // Ignore rewrite failures and fall back to the original URL.
      }
    }
  }

  let res: Response
  try {
    res = await fetch(fetchUrl, { signal: AbortSignal.timeout(10_000) })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Failed to fetch imageUrl for AI analysis. This is usually a network/DNS issue, a non-public URL, or a localhost URL from inside Docker. url=${imageUrl} fetchUrl=${fetchUrl} error=${message}`
    )
  }
  if (!res.ok) {
    throw new Error(`Failed to download image for AI analysis (HTTP ${res.status})`)
  }

  const contentType = res.headers.get("content-type") || "image/jpeg"
  const arrayBuffer = await res.arrayBuffer()

  // Avoid sending extremely large payloads to the model provider.
  const maxBytes = 8 * 1024 * 1024
  if (arrayBuffer.byteLength > maxBytes) {
    throw new Error(
      `Image is too large to inline for AI analysis (${Math.round(arrayBuffer.byteLength / 1024 / 1024)}MB). Please upload a smaller image.`
    )
  }

  const base64 = Buffer.from(arrayBuffer).toString("base64")
  return `data:${contentType};base64,${base64}`
}

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

// Schema for consolidated care requirements
const consolidatedCareSchema = z.object({
  watering_frequency_days: z.number(),
  fertilizing_frequency_days: z.number(),
  sunlight_level: z.enum(["low", "medium", "bright", "direct"]),
  humidity_preference: z.string(),
  temperature_range: z.string(),
  care_notes: z.string(),
})

async function identifyPlantWithModel(imageUrl: string, modelEntry: { id: string; model: unknown }) {
  const modelImage = await getModelImageInput(imageUrl)

  const result = await generateObject({
    // `generateObject` expects a model instance, not a string.
    model: modelEntry.model as any,
    schema: identificationSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: modelImage,
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
    if (MODEL_ENTRIES.length === 0) {
      throw new Error(
        "No AI provider configured. Set OPENROUTER_API_KEY for OpenRouter (recommended) or OPENAI_API_KEY for OpenAI."
      )
    }

    console.log(`[Identification] Starting identification with ${MODEL_ENTRIES.length} AI models...`)
    
    // Query all models in parallel
    const identifications = await Promise.allSettled(
      MODEL_ENTRIES.map((entry) => {
        console.log(`[Identification] Querying ${entry.id}...`)
        return identifyPlantWithModel(imageUrl, entry)
      })
    )

    // Extract successful results
    const successfulResults = identifications
      .filter((result): result is PromiseFulfilledResult<z.infer<typeof identificationSchema>> => 
        result.status === "fulfilled"
      )
      .map((result) => result.value)

    console.log(`[Identification] ${successfulResults.length}/${MODEL_ENTRIES.length} models responded successfully`)

    if (successfulResults.length === 0) {
      const failureSummaries = identifications
        .map((r, i) => {
          if (r.status === "fulfilled") return null
          const modelId = MODEL_ENTRIES[i]?.id ?? `model_${i + 1}`
          const message = r.reason instanceof Error ? r.reason.message : String(r.reason)
          return `${modelId}: ${message}`
        })
        .filter(Boolean)
        .join(" | ")

      throw new Error(
        `All identification models failed${failureSummaries ? ` (${failureSummaries})` : ""}`
      )
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

        if (MODEL_ENTRIES.length === 0) {
          throw new Error(
            "No AI provider configured. Set OPENROUTER_API_KEY for OpenRouter (recommended) or OPENAI_API_KEY for OpenAI."
          )
        }

        const result_obj = await generateObject({
          model: MODEL_ENTRIES[0].model as any,
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

  console.log(`[Research] Successfully processed ${researched.length} sources with verified data`)
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
async function processPlantIdentification(userId: string, sessionId: string, imageUrl: string, additionalPhotos: string[] = []) {
  const supabase = createAdminClient()

  try {
    console.log(`[Processing] Starting identification for session ${sessionId}`)
    
    // Get the session to retrieve user-provided name and location
    const { data: session } = await supabase
      .from("import_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single()

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
      .eq("user_id", userId)

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
        .eq("user_id", userId)
      
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
      .eq("user_id", userId)

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
      .eq("user_id", userId)

    // Step 3: Consolidate care requirements
    console.log(`[Processing] Session ${sessionId} - consolidating care requirements`)
    await supabase
      .from("import_sessions")
      .update({
        status: "confirming",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", userId)
    
    const careRequirements = consolidateCareRequirements(researchedSources)

    // Build photos array from primary image and additional photos
    const allPhotoUrls = [imageUrl, ...additionalPhotos]
    const photos = allPhotoUrls.map((url, index) => ({
      id: crypto.randomUUID(),
      url,
      order: index,
    }))

    // Step 4: Auto-create the plant using user-provided name and location
    console.log(`[Processing] Session ${sessionId} - creating plant with ${photos.length} photo(s)`)
    const plantPayload = {
      user_id: userId,
      name: session.plant_name || identification.identified_species,
      location: session.plant_location || null,
      species: identification.identified_species,
      scientific_name: identification.scientific_name,
      image_url: imageUrl,
      photos: photos,
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
      .eq("user_id", userId)
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
      .eq("user_id", userId)
    
    console.log(`[Processing] Session ${sessionId} marked as failed`)
  }
}

export async function POST(req: Request) {
  try {
    const { imageUrl, sessionId, additionalPhotos } = await req.json()

    console.log(`[API] POST /api/identify-plant called with sessionId: ${sessionId}`)

    if (!imageUrl || !sessionId) {
      console.error(`[API] Missing required parameters - imageUrl: ${!!imageUrl}, sessionId: ${!!sessionId}`)
      return Response.json({ error: "Missing imageUrl or sessionId" }, { status: 400 })
    }

    const auth = await requireUser()
    if ("response" in auth) return auth.response

    const { user } = auth

    const supabase = createAdminClient()

    // Verify session exists
    const { data: session, error: sessionError } = await supabase
      .from("import_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single()

    if (sessionError || !session) {
      console.error(`[API] Session not found: ${sessionId}`, sessionError)
      return Response.json({ error: "Session not found" }, { status: 404 })
    }

    console.log(`[API] Session ${sessionId} verified, starting background processing`)

    // Start background processing (don't await)
    processPlantIdentification(user.id, sessionId, imageUrl, additionalPhotos || []).catch((error) => {
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
