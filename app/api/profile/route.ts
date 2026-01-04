import { NextResponse } from "next/server"
import { requireUser } from "@/lib/supabase/require-user"

export async function GET() {
  const result = await requireUser()
  if ("response" in result) return result.response

  const { supabase, user } = result

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,avatar_url,updated_at")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? { id: user.id, email: user.email ?? null, full_name: null, avatar_url: null, updated_at: null })
}

export async function PATCH(req: Request) {
  const result = await requireUser()
  if ("response" in result) return result.response

  const { supabase, user } = result
  const body = await req.json().catch(() => ({}))

  const payload = {
    id: user.id,
    email: user.email ?? null,
    full_name: typeof body.full_name === "string" ? body.full_name : null,
    avatar_url: typeof body.avatar_url === "string" ? body.avatar_url : null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("id,email,full_name,avatar_url,updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
