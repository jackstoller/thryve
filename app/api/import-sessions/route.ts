import { NextResponse } from "next/server"
import { requireUser } from "@/lib/supabase/require-user"

export async function GET() {
  const result = await requireUser()
  if ("response" in result) return result.response

  const { supabase, user } = result

  const { data, error } = await supabase
    .from("import_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const result = await requireUser()
  if ("response" in result) return result.response

  const { supabase, user } = result
  const body = await req.json()

  const { data, error } = await supabase
    .from("import_sessions")
    .insert({ ...body, user_id: user.id })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
