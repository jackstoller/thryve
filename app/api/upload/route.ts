import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

function parseJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null

  try {
    // base64url -> base64
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=")
    const json = Buffer.from(padded, "base64").toString("utf8")
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function sanitizeFilename(filename: string): string {
  return filename
    .trim()
    .replace(/\\/g, "_")
    .replace(/\//g, "_")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 })
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size must be less than 10MB" }, { status: 400 })
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "plant-photos"

    // Fail fast with a clear message if the service-role key is missing or incorrect.
    // (A common cause of "new row violates row-level security policy" during Storage uploads.)
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (server only).")
    }
    const payload = parseJwtPayload(key)
    const role = typeof payload?.role === "string" ? payload.role : null
    if (role && role !== "service_role") {
      throw new Error(`SUPABASE_SERVICE_ROLE_KEY must be a service_role JWT (got role: ${role}).`)
    }

    const supabase = createAdminClient()

    // Ensure bucket exists (idempotent)
    const bucketCheck = await supabase.storage.getBucket(bucket)
    if (bucketCheck.error) {
      const created = await supabase.storage.createBucket(bucket, { public: true })
      if (created.error && !/already exists/i.test(created.error.message)) {
        throw new Error(created.error.message)
      }
    }

    const safeName = sanitizeFilename(file.name)
    const path = `plants/${Date.now()}-${safeName}`
    const bytes = Buffer.from(await file.arrayBuffer())

    const upload = await supabase.storage.from(bucket).upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    })

    if (upload.error) {
      throw new Error(upload.error.message)
    }

    // For server-side calls we use the Docker-internal gateway (SUPABASE_URL=http://kong:8000).
    // But clients need a browser-reachable URL (typically NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321).
    const publicBaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
    if (!publicBaseUrl) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL")
    }

    const publicUrl = new URL(`/storage/v1/object/public/${bucket}/${path}`, publicBaseUrl).toString()

    return NextResponse.json({
      url: publicUrl,
      bucket,
      path,
      filename: file.name,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error("Upload error:", error)
    const errorMessage = error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
