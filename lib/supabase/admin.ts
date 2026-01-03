import { createClient } from "@supabase/supabase-js"

export function createAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error(
      "Missing Supabase URL. Set SUPABASE_URL (server) or NEXT_PUBLIC_SUPABASE_URL (browser)."
    )
  }
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing Supabase service role key. Set SUPABASE_SERVICE_ROLE_KEY (server only).")
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
