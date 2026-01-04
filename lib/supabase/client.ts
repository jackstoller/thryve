import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }

  // In Docker, Next runs in production mode even on http://localhost.
  // If cookies are marked `Secure`, browsers won't set them on http, which breaks PKCE OAuth.
  const secure = typeof window !== "undefined" ? window.location.protocol === "https:" : false

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      // IMPORTANT: The cookie name determines the storage key used for PKCE verifier and session.
      // This MUST be the same between browser and server clients, even if they use different Supabase URLs.
      name: "thryve-auth",
      secure,
    },
  })
}
