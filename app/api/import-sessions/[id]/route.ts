import { NextResponse } from "next/server"
import { requireUser } from "@/lib/supabase/require-user"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await requireUser()
  if ("response" in result) return result.response

  const { supabase, user } = result
  const body = await req.json()

  const { data, error } = await supabase
    .from("import_sessions")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await requireUser()
  if ("response" in result) return result.response

  const { supabase, user } = result

  const { error } = await supabase.from("import_sessions").delete().eq("id", id).eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
