import { NextResponse } from "next/server"
import { requireUser } from "@/lib/supabase/require-user"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await requireUser()
  if ("response" in result) return result.response

  const { supabase, user } = result
  const body = await req.json()
  const { photoUrl } = body

  if (!photoUrl) {
    return NextResponse.json({ error: "Photo URL is required" }, { status: 400 })
  }

  // Get current plant to access photos array
  const { data: plant, error: fetchError } = await supabase
    .from("plants")
    .select("photos")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  // Add new photo with next order number
  const currentPhotos = plant.photos || []
  const maxOrder = currentPhotos.length > 0 ? Math.max(...currentPhotos.map((p: any) => p.order)) : -1
  const newPhoto = {
    id: crypto.randomUUID(),
    url: photoUrl,
    order: maxOrder + 1,
  }

  const updatedPhotos = [...currentPhotos, newPhoto]

  // Update plant with new photos array
  // If this is the first photo, also update image_url
  const updateData: any = {
    photos: updatedPhotos,
    updated_at: new Date().toISOString(),
  }
  
  if (currentPhotos.length === 0) {
    updateData.image_url = photoUrl
  }

  const { data, error } = await supabase
    .from("plants")
    .update(updateData)
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
  const { searchParams } = new URL(req.url)
  const photoId = searchParams.get("photoId")

  if (!photoId) {
    return NextResponse.json({ error: "Photo ID is required" }, { status: 400 })
  }

  // Get current plant to access photos array
  const { data: plant, error: fetchError } = await supabase
    .from("plants")
    .select("photos")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  // Remove photo and reorder remaining photos
  const currentPhotos = plant.photos || []
  const updatedPhotos = currentPhotos
    .filter((p: any) => p.id !== photoId)
    .map((p: any, index: number) => ({ ...p, order: index }))

  // Update plant with new photos array
  // Update image_url to first photo or null
  const updateData: any = {
    photos: updatedPhotos,
    image_url: updatedPhotos.length > 0 ? updatedPhotos[0].url : null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("plants")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await requireUser()
  if ("response" in result) return result.response

  const { supabase, user } = result
  const body = await req.json()
  const { photos } = body

  if (!photos || !Array.isArray(photos)) {
    return NextResponse.json({ error: "Photos array is required" }, { status: 400 })
  }

  // Normalize order values
  const normalizedPhotos = photos.map((p: any, index: number) => ({
    ...p,
    order: index,
  }))

  // Update plant with reordered photos array
  // Update image_url to first photo
  const updateData: any = {
    photos: normalizedPhotos,
    image_url: normalizedPhotos.length > 0 ? normalizedPhotos[0].url : null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("plants")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
