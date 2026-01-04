import { NextResponse } from "next/server"
import { requireUser } from "@/lib/supabase/require-user"

export async function GET() {
  const result = await requireUser()
  if ("response" in result) return result.response

  const { supabase, user } = result

  console.log("[v0] Fetching plants from database")

  const { data, error } = await supabase
    .from("plants")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.log("[v0] Error fetching plants:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log("[v0] Plants fetched:", data?.length, "plants")
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const result = await requireUser()
  if ("response" in result) return result.response

  const { supabase, user } = result
  const body = await req.json()

  console.log("[v0] Creating plant with body:", body)

  const now = new Date()
  const nextWaterDate = new Date(now)
  nextWaterDate.setDate(nextWaterDate.getDate() + (body.watering_frequency_days || 7))

  const nextFertilizeDate = new Date(now)
  nextFertilizeDate.setDate(nextFertilizeDate.getDate() + (body.fertilizing_frequency_days || 30))

  const insertData = {
    ...body,
    user_id: user.id,
    last_watered: now.toISOString(),
    last_fertilized: now.toISOString(),
    next_water_date: nextWaterDate.toISOString(),
    next_fertilize_date: nextFertilizeDate.toISOString(),
  }

  console.log("[v0] Insert data:", insertData)

  const { data, error } = await supabase.from("plants").insert(insertData).select().single()

  if (error) {
    console.log("[v0] Error creating plant:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log("[v0] Plant created successfully:", data)
  return NextResponse.json(data)
}
