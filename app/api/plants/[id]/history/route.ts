import { NextResponse } from "next/server"
import { requireUser } from "@/lib/supabase/require-user"

async function assertPlantOwnership(supabase: any, userId: string, plantId: string) {
  const { data: plant, error } = await supabase
    .from("plants")
    .select("id, user_id, watering_frequency_days, fertilizing_frequency_days")
    .eq("id", plantId)
    .eq("user_id", userId)
    .single()

  if (error || !plant) {
    return { error: NextResponse.json({ error: "Plant not found" }, { status: 404 }) }
  }

  return { plant }
}

async function recomputePlantCareDates(supabase: any, plantId: string) {
  const { data: plant } = await supabase
    .from("plants")
    .select("watering_frequency_days, fertilizing_frequency_days")
    .eq("id", plantId)
    .single()

  const wateringFrequencyDays = Number(plant?.watering_frequency_days)
  const fertilizingFrequencyDays = Number(plant?.fertilizing_frequency_days)

  const { data: waterRows } = await supabase
    .from("care_history")
    .select("performed_at")
    .eq("plant_id", plantId)
    .eq("care_type", "water")
    .order("performed_at", { ascending: false })
    .limit(1)

  const { data: fertilizeRows } = await supabase
    .from("care_history")
    .select("performed_at")
    .eq("plant_id", plantId)
    .eq("care_type", "fertilize")
    .order("performed_at", { ascending: false })
    .limit(1)

  const lastWatered = waterRows?.[0]?.performed_at ?? null
  const lastFertilized = fertilizeRows?.[0]?.performed_at ?? null

  const nextWaterDate =
    lastWatered && Number.isFinite(wateringFrequencyDays) && wateringFrequencyDays > 0
      ? new Date(new Date(lastWatered).getTime() + wateringFrequencyDays * 24 * 60 * 60 * 1000).toISOString()
      : null

  const nextFertilizeDate =
    lastFertilized && Number.isFinite(fertilizingFrequencyDays) && fertilizingFrequencyDays > 0
      ? new Date(new Date(lastFertilized).getTime() + fertilizingFrequencyDays * 24 * 60 * 60 * 1000).toISOString()
      : null

  await supabase
    .from("plants")
    .update({
      last_watered: lastWatered,
      last_fertilized: lastFertilized,
      next_water_date: nextWaterDate,
      next_fertilize_date: nextFertilizeDate,
    })
    .eq("id", plantId)
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await requireUser()
    if ("response" in result) return result.response

    const { supabase, user } = result

    const ownership = await assertPlantOwnership(supabase, user.id, id)
    if ("error" in ownership) return ownership.error

    const { data: history, error } = await supabase
      .from("care_history")
      .select("*")
      .eq("plant_id", id)
      .order("performed_at", { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(history || [])
  } catch (error) {
    console.error("Failed to fetch care history:", error)
    return NextResponse.json({ error: "Failed to fetch care history" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await requireUser()
    if ("response" in result) return result.response

    const { supabase, user } = result
    const ownership = await assertPlantOwnership(supabase, user.id, id)
    if ("error" in ownership) return ownership.error

    const body = await request.json().catch(() => null)
    const care_type = body?.care_type as "water" | "fertilize" | undefined
    const performed_at = body?.performed_at as string | undefined
    const notes = (body?.notes as string | null | undefined) ?? null

    if (care_type !== "water" && care_type !== "fertilize") {
      return NextResponse.json({ error: "Invalid care_type" }, { status: 400 })
    }
    if (!performed_at || Number.isNaN(new Date(performed_at).getTime())) {
      return NextResponse.json({ error: "Invalid performed_at" }, { status: 400 })
    }

    const { data: created, error } = await supabase
      .from("care_history")
      .insert({ plant_id: id, care_type, performed_at, notes })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await recomputePlantCareDates(supabase, id)
    return NextResponse.json(created)
  } catch (error) {
    console.error("Failed to create care history:", error)
    return NextResponse.json({ error: "Failed to create care history" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await requireUser()
    if ("response" in result) return result.response

    const { supabase, user } = result
    const ownership = await assertPlantOwnership(supabase, user.id, id)
    if ("error" in ownership) return ownership.error

    const body = await request.json().catch(() => null)
    const historyId = body?.id as string | undefined
    const care_type = body?.care_type as "water" | "fertilize" | undefined
    const performed_at = body?.performed_at as string | undefined
    const notes = (body?.notes as string | null | undefined) ?? null

    if (!historyId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }
    if (care_type !== "water" && care_type !== "fertilize") {
      return NextResponse.json({ error: "Invalid care_type" }, { status: 400 })
    }
    if (!performed_at || Number.isNaN(new Date(performed_at).getTime())) {
      return NextResponse.json({ error: "Invalid performed_at" }, { status: 400 })
    }

    const { data: updatedRows, error } = await supabase
      .from("care_history")
      .update({ care_type, performed_at, notes })
      .eq("id", historyId)
      .eq("plant_id", id)
      .select("*")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const updated = Array.isArray(updatedRows) ? updatedRows[0] : null
    if (!updated) {
      return NextResponse.json(
        { error: "Unable to update care history (missing permission or record not found)" },
        { status: 403 },
      )
    }

    await recomputePlantCareDates(supabase, id)
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to update care history:", error)
    return NextResponse.json({ error: "Failed to update care history" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await requireUser()
    if ("response" in result) return result.response

    const { supabase, user } = result
    const ownership = await assertPlantOwnership(supabase, user.id, id)
    if ("error" in ownership) return ownership.error

    const body = await request.json().catch(() => null)
    const historyId = body?.id as string | undefined

    if (!historyId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    const { error } = await supabase.from("care_history").delete().eq("id", historyId).eq("plant_id", id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await recomputePlantCareDates(supabase, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to delete care history:", error)
    return NextResponse.json({ error: "Failed to delete care history" }, { status: 500 })
  }
}
