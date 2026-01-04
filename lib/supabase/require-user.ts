import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export type RequireUserResult =
  | { supabase: Awaited<ReturnType<typeof createClient>>; user: NonNullable<Awaited<ReturnType<typeof getUserSafe>>["user"]> }
  | { response: NextResponse }

async function getUserSafe(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.auth.getUser()
  if (error) return { user: null as const }
  return { user: data.user }
}

export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  return { supabase, user }
}
