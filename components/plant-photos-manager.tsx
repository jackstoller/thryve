"use client"

import type { CSSProperties } from "react"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Camera, Upload, X, GripVertical, Loader2 } from "lucide-react"
import type { PlantPhoto } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface PlantPhotosManagerProps {
  plantId: string
  photos: PlantPhoto[]
  onPhotosChange: () => void
}

function SortablePhotoTile({
  photo,
  index,
  isCover,
  canDelete,
  deleting,
  onDelete,
}: {
  photo: PlantPhoto
  index: number
  isCover: boolean
  canDelete: boolean
  deleting: boolean
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
  })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group rounded-lg overflow-hidden border-2 transition-all",
        isDragging ? "opacity-50" : "opacity-100",
        isCover && "ring-2 ring-primary/50"
      )}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="aspect-square bg-muted">
        <img
          src={photo.url}
          alt={`Plant photo ${index + 1}`}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          style={{ WebkitTouchCallout: "none" }}
          className="w-full h-full object-cover select-none"
        />
      </div>

      {/* Drag Handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className={cn(
          "absolute top-2 left-2 bg-background/80 backdrop-blur-sm rounded p-1",
          "touch-none",
          "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        )}
        onClick={(e) => e.preventDefault()}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Primary Badge */}
      {isCover && (
        <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-medium">
          Cover
        </div>
      )}

      {/* Delete Button */}
      {canDelete && (
        <Button
          size="icon"
          variant="destructive"
          className="absolute bottom-2 right-2 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
        </Button>
      )}
    </div>
  )
}

export function PlantPhotosManager({ plantId, photos, onPhotosChange }: PlantPhotosManagerProps) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDeletePhotoId, setPendingDeletePhotoId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const sortedPhotos = useMemo(() => [...photos].sort((a, b) => a.order - b.order), [photos])
  const [localPhotos, setLocalPhotos] = useState<PlantPhoto[]>(sortedPhotos)

  useEffect(() => {
    setLocalPhotos(sortedPhotos)
  }, [sortedPhotos])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  )

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

  const deletePhotoNow = async (photoId: string) => {
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

  const handleDeletePhoto = (photoId: string) => {
    setPendingDeletePhotoId(photoId)
    setDeleteDialogOpen(true)
  }

  const persistReorder = async (nextPhotos: PlantPhoto[], previousPhotos: PlantPhoto[]) => {
    const reorderedPhotos = nextPhotos.map((photo, index) => ({ ...photo, order: index }))

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
      setLocalPhotos(previousPhotos)
      console.error("Failed to reorder photos:", error)
      alert(error instanceof Error ? error.message : "Failed to reorder photos")
    }
  }

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return

    const oldIndex = localPhotos.findIndex((p) => p.id === active.id)
    const newIndex = localPhotos.findIndex((p) => p.id === over.id)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return

    const previousPhotos = localPhotos
    const nextPhotos = arrayMove(localPhotos, oldIndex, newIndex)
    setLocalPhotos(nextPhotos)
    await persistReorder(nextPhotos, previousPhotos)
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

      {localPhotos.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg text-sm text-muted-foreground">
          No photos yet
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={localPhotos.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {localPhotos.map((photo, index) => (
                <SortablePhotoTile
                  key={photo.id}
                  photo={photo}
                  index={index}
                  isCover={index === 0}
                  canDelete={localPhotos.length > 1}
                  deleting={deleting === photo.id}
                  onDelete={() => handleDeletePhoto(photo.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <p className="text-xs text-muted-foreground">
        {localPhotos.length > 0 ? (
          <>Drag the grip to reorder. The first photo is your cover photo.</>
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

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) setPendingDeletePhotoId(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete photo?</DialogTitle>
            <DialogDescription>This removes the photo from this plant.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting !== null}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting !== null || !pendingDeletePhotoId}
              onClick={async () => {
                if (!pendingDeletePhotoId) return
                await deletePhotoNow(pendingDeletePhotoId)
                setDeleteDialogOpen(false)
                setPendingDeletePhotoId(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
