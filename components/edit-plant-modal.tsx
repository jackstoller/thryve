"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlantPhotosManager } from "@/components/plant-photos-manager"
import useSWR, { mutate } from "swr"
import type { Plant } from "@/lib/types"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  return res.json()
}

interface EditPlantModalProps {
  plant: Plant | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (plant: Partial<Plant> & { id: string }) => void
}

export function EditPlantModal({ plant, open, onOpenChange, onSave }: EditPlantModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    species: "",
    location: "",
    sunlight_level: "" as Plant["sunlight_level"] | "",
    watering_frequency_days: "",
    fertilizing_frequency_days: "",
    care_notes: "",
  })

  // Fetch fresh plant data when modal is open
  const { data: freshPlant } = useSWR<Plant>(
    plant && open ? `/api/plants/${plant.id}` : null,
    fetcher,
    { refreshInterval: 0 }
  )

  // Use fresh plant data if available, otherwise use prop
  const currentPlant = freshPlant || plant

  useEffect(() => {
    if (currentPlant) {
      setFormData({
        name: currentPlant.name,
        species: currentPlant.species || "",
        location: currentPlant.location || "",
        sunlight_level: currentPlant.sunlight_level,
        watering_frequency_days:
          typeof currentPlant.watering_frequency_days === "number"
            ? String(currentPlant.watering_frequency_days)
            : "",
        fertilizing_frequency_days:
          typeof currentPlant.fertilizing_frequency_days === "number"
            ? String(currentPlant.fertilizing_frequency_days)
            : "",
        care_notes: currentPlant.care_notes || "",
      })
    }
  }, [currentPlant])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (currentPlant) {
      const watering = Number.parseInt(formData.watering_frequency_days, 10)
      const fertilizing = Number.parseInt(formData.fertilizing_frequency_days, 10)

      if (!formData.sunlight_level) {
        alert("Please select a sunlight level")
        return
      }
      if (!Number.isFinite(watering) || watering < 1) {
        alert("Please enter a valid watering frequency (days)")
        return
      }
      if (!Number.isFinite(fertilizing) || fertilizing < 1) {
        alert("Please enter a valid fertilizing frequency (days)")
        return
      }

      onSave({
        id: currentPlant.id,
        name: formData.name,
        species: formData.species,
        location: formData.location,
        sunlight_level: formData.sunlight_level as Plant["sunlight_level"],
        watering_frequency_days: watering,
        fertilizing_frequency_days: fertilizing,
        care_notes: formData.care_notes,
      })
    }
  }

  const handleDialogInteractOutside = (e: Event) => {
    const target = e.target as HTMLElement | null
    if (!target) return

    // Prevent the dialog from closing when interacting with portaled Radix Select content.
    // Without this, clicking a Select option can count as an "outside" click for the dialog.
    if (target.closest('[data-slot="select-content"]')) {
      e.preventDefault()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onInteractOutside={handleDialogInteractOutside}>
        <DialogHeader>
          <DialogTitle>Edit Plant</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plant Details</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="species">Species</Label>
              <Input
                id="species"
                value={formData.species}
                onChange={(e) => setFormData({ ...formData, species: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g., Living room window"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sunlight">Sunlight Level</Label>
              <Select
                value={formData.sunlight_level || ""}
                onValueChange={(value) =>
                  setFormData({ ...formData, sunlight_level: value as Plant["sunlight_level"] })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (shade)</SelectItem>
                  <SelectItem value="medium">Medium (indirect)</SelectItem>
                  <SelectItem value="bright">Bright (filtered)</SelectItem>
                  <SelectItem value="direct">Direct sunlight</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Care</div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="watering">Water every (days)</Label>
                <Input
                  id="watering"
                  type="number"
                  min="1"
                  value={formData.watering_frequency_days}
                  onChange={(e) => setFormData({ ...formData, watering_frequency_days: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fertilizing">Fertilize every (days)</Label>
                <Input
                  id="fertilizing"
                  type="number"
                  min="1"
                  value={formData.fertilizing_frequency_days}
                  onChange={(e) => setFormData({ ...formData, fertilizing_frequency_days: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Care Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any special care instructions..."
                value={formData.care_notes}
                onChange={(e) => setFormData({ ...formData, care_notes: e.target.value })}
              />
            </div>
          </div>

          {currentPlant && (
            <PlantPhotosManager
              plantId={currentPlant.id}
              photos={currentPlant.photos || []}
              onPhotosChange={() => {
                mutate(`/api/plants/${currentPlant.id}`)
                mutate("/api/plants")
              }}
            />
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
