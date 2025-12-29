"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Camera, Upload, X, GripVertical, Loader2 } from "lucide-react"
import type { PlantPhoto } from "@/lib/types"
import { cn } from "@/lib/utils"

interface PlantPhotosManagerProps {
  plantId: string
  photos: PlantPhoto[]
  onPhotosChange: () => void
}

export function PlantPhotosManager({ plantId, photos, onPhotosChange }: PlantPhotosManagerProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const sortedPhotos = [...photos].sort((a, b) => a.order - b.order)

  const handleFileSelect = async (file: File) => {
    if (!file || !file.type.startsWith("image/")) return

    setUploading(true)
    try {
      // Upload image
      const formData = new FormData()
      formData.append("file", file)
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
      
      if (!uploadRes.ok) {
        const error = await uploadRes.json()
        throw new Error(error.error || "Upload failed")
      }
      
      const { url } = await uploadRes.json()

      // Add photo to plant
      const addRes = await fetch(`/api/plants/${plantId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: url }),
      })

      if (!addRes.ok) {
        const error = await addRes.json()
        throw new Error(error.error || "Failed to add photo")
      }

      onPhotosChange()
    } catch (error) {
      console.error("Failed to upload photo:", error)
      alert(error instanceof Error ? error.message : "Failed to upload photo")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
      if (cameraInputRef.current) cameraInputRef.current.value = ""
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("Delete this photo?")) return

    setDeleting(photoId)
    try {
      const res = await fetch(`/api/plants/${plantId}/photos?photoId=${photoId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete photo")
      }

      onPhotosChange()
    } catch (error) {
      console.error("Failed to delete photo:", error)
      alert(error instanceof Error ? error.message : "Failed to delete photo")
    } finally {
      setDeleting(null)
    }
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    // Reorder photos
    const newPhotos = [...sortedPhotos]
    const [draggedPhoto] = newPhotos.splice(draggedIndex, 1)
    newPhotos.splice(dropIndex, 0, draggedPhoto)

    // Update order values
    const reorderedPhotos = newPhotos.map((photo, index) => ({
      ...photo,
      order: index,
    }))

    try {
      const res = await fetch(`/api/plants/${plantId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: reorderedPhotos }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to reorder photos")
      }

      onPhotosChange()
    } catch (error) {
      console.error("Failed to reorder photos:", error)
      alert(error instanceof Error ? error.message : "Failed to reorder photos")
    } finally {
      setDraggedIndex(null)
      setDragOverIndex(null)
    }
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Photos</h3>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="w-4 h-4 mr-1.5" />
            Take
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-1.5" />
            )}
            Upload
          </Button>
        </div>
      </div>

      {sortedPhotos.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg text-sm text-muted-foreground">
          No photos yet
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {sortedPhotos.map((photo, index) => (
            <div
              key={photo.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "relative group rounded-lg overflow-hidden border-2 transition-all cursor-move",
                draggedIndex === index && "opacity-50",
                dragOverIndex === index && "border-primary scale-105",
                index === 0 && "ring-2 ring-primary/50"
              )}
            >
              <div className="aspect-square bg-muted">
                <img
                  src={photo.url}
                  alt={`Plant photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Drag Handle */}
              <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
              </div>

              {/* Primary Badge */}
              {index === 0 && (
                <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                  Cover
                </div>
              )}

              {/* Delete Button */}
              {sortedPhotos.length > 1 && (
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute bottom-2 right-2 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDeletePhoto(photo.id)}
                  disabled={deleting === photo.id}
                >
                  {deleting === photo.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {sortedPhotos.length > 0 ? (
          <>Drag photos to reorder. The first photo is your cover photo.</>
        ) : (
          <>Add photos to document your plant's growth and progress.</>
        )}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
      />
    </div>
  )
}
