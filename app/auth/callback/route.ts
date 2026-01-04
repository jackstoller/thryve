import { createServerClient } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"

function getPublicOrigin(request: NextRequest): string {
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL
  if (envOrigin) return new URL(envOrigin).origin

  const url = new URL(request.url)

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const proto = forwardedProto || url.protocol.replace(":", "")

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  const host = forwardedHost || request.headers.get("host") || url.host

  return `${proto}://${host}`
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next") ?? "/"

  const origin = getPublicOrigin(request)

  const redirectUrl = new URL(next, origin)
  const response = NextResponse.redirect(redirectUrl)

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/login?error=missing_supabase_env", origin))
  }

  if (code) {
    const isSecure = origin.startsWith("https://")

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
      cookieOptions: {
        name: "thryve-auth",
        secure: isSecure,
      },
    })

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, origin))
    }
  }

  return response
}
