import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/supabase/require-user"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { species, scientific_name } = await request.json()

    if (!species || !scientific_name) {
      return NextResponse.json({ error: "Species and scientific name are required" }, { status: 400 })
    }

    const result = await requireUser()
    if ("response" in result) return result.response

    const { supabase, user } = result

    // Get the session
    const { data: session } = await supabase
      .from("import_sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (session.status !== "needs_selection") {
      return NextResponse.json({ error: "Session is not awaiting selection" }, { status: 400 })
    }

    // Update session with user's selection and start research
    await supabase
      .from("import_sessions")
      .update({
        status: "researching",
        identified_species: species,
        scientific_name: scientific_name,
        confidence: 0.7, // User-confirmed selection
        suggestions: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)

    // Continue the identification process
    const continueRes = await fetch(`${request.nextUrl.origin}/api/identify-plant/continue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({ 
        sessionId: id,
        species,
        scientific_name,
      }),
    })

    if (!continueRes.ok) {
      throw new Error("Failed to continue identification")
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Select] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process selection" },
      { status: 500 }
    )
  }
}
