import { NextResponse } from "next/server"
import { requireUser } from "@/lib/supabase/require-user"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await requireUser()
    if ("response" in result) return result.response

    const { supabase, user } = result

    // Ensure the plant belongs to the current user
    const { error: plantError } = await supabase.from("plants").select("id").eq("id", id).eq("user_id", user.id).single()
    if (plantError) {
      return NextResponse.json({ error: "Plant not found" }, { status: 404 })
    }

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
