import { streamObject } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const plantIdentificationSchema = z.object({
  identified_species: z.string().describe("Common name of the plant"),
  scientific_name: z.string().describe("Scientific/botanical name"),
  confidence: z.number().min(0).max(1).describe("Confidence level 0-1"),
  care_requirements: z.object({
    watering_frequency_days: z.number().describe("Days between watering"),
    fertilizing_frequency_days: z.number().describe("Days between fertilizing"),
    sunlight_level: z.enum(["low", "medium", "bright", "direct"]).describe("Light requirements"),
    humidity_preference: z.string().describe("Humidity needs like 'moderate', 'high', etc"),
    temperature_range: z.string().describe("Ideal temperature range"),
    care_notes: z.string().describe("Additional care tips"),
  }),
  research_sources: z
    .array(
      z.object({
        name: z.string().describe("Source name like 'Royal Horticultural Society'"),
        recommendation: z.string().describe("Key recommendation from this source"),
      }),
    )
    .min(3)
    .describe("At least 3 authoritative sources that agree on care requirements"),
})

export async function POST(req: Request) {
  const { imageUrl, sessionId } = await req.json()

  const supabase = await createClient()

  // Update session status to identifying
  await supabase.from("import_sessions").update({ status: "identifying", image_url: imageUrl }).eq("id", sessionId)

  try {
    const result = streamObject({
      model: "anthropic/claude-sonnet-4-20250514",
      schema: plantIdentificationSchema,
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
              text: `Identify this plant and provide comprehensive care requirements. 
              
              Research and provide care recommendations that would be agreed upon by at least 3 authoritative sources (like Royal Horticultural Society, Missouri Botanical Garden, University extension services, etc.).
              
              Be specific about:
              - Watering frequency (in days)
              - Fertilizing schedule (in days)
              - Light requirements
              - Humidity preferences
              - Temperature range
              - Any special care notes
              
              Include the sources that would agree on these care requirements.`,
            },
          ],
        },
      ],
    })

    // Update to researching status
    await supabase.from("import_sessions").update({ status: "researching" }).eq("id", sessionId)

    return result.toTextStreamResponse()
  } catch (error) {
    await supabase
      .from("import_sessions")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Identification failed",
      })
      .eq("id", sessionId)

    return Response.json({ error: "Failed to identify plant" }, { status: 500 })
  }
}
