import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  // First get the plant to know its watering frequency
  const { data: plant, error: fetchError } = await supabase
    .from("plants")
    .select("watering_frequency_days")
    .eq("id", id)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const now = new Date()
  const nextWaterDate = new Date(now)
  nextWaterDate.setDate(nextWaterDate.getDate() + (plant.watering_frequency_days || 7))

  // Record the watering event in care history
  const { error: historyError } = await supabase
    .from("care_history")
    .insert({
      plant_id: id,
      care_type: "water",
      performed_at: now.toISOString(),
    })

  if (historyError) {
    console.error("Failed to record care history:", historyError)
    // Don't fail the whole operation if history recording fails
  }

  const { data, error } = await supabase
    .from("plants")
    .update({
      last_watered: now.toISOString(),
      next_water_date: nextWaterDate.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
