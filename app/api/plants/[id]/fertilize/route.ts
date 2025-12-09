import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // First get the plant to know its fertilizing frequency
  const { data: plant, error: fetchError } = await supabase
    .from("plants")
    .select("fertilizing_frequency_days")
    .eq("id", id)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const now = new Date()
  const nextFertilizeDate = new Date(now)
  nextFertilizeDate.setDate(nextFertilizeDate.getDate() + (plant.fertilizing_frequency_days || 30))

  // Record the fertilizing event in care history
  const { error: historyError } = await supabase
    .from("care_history")
    .insert({
      plant_id: id,
      care_type: "fertilize",
      performed_at: now.toISOString(),
    })

  if (historyError) {
    console.error("Failed to record care history:", historyError)
    // Don't fail the whole operation if history recording fails
  }

  const { data, error } = await supabase
    .from("plants")
    .update({
      last_fertilized: now.toISOString(),
      next_fertilize_date: nextFertilizeDate.toISOString(),
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
