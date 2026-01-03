import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

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
