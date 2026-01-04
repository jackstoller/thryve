import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (!data.user) {
    return NextResponse.json({ user: null, profile: null })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,full_name,avatar_url,updated_at")
    .eq("id", data.user.id)
    .maybeSingle()

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    profile: profile ?? null,
  })
}
