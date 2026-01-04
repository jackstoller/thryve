import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) throw new Error("Missing Supabase URL. Set SUPABASE_URL (server) or NEXT_PUBLIC_SUPABASE_URL (browser).")
  if (!supabaseAnonKey) throw new Error("Missing Supabase anon key. Set SUPABASE_ANON_KEY (server) or NEXT_PUBLIC_SUPABASE_ANON_KEY (browser).")

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      name: "thryve-auth",
      // Safer default for local Docker (http://localhost). In production behind HTTPS, you can set this to true by adjusting the logic.
      secure: false,
    },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Ignored in Server Components
        }
      },
    },
  })
}
