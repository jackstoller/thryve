"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Plant } from "@/lib/types"

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
    sunlight_level: "" as Plant["sunlight_level"],
    watering_frequency_days: 7,
    fertilizing_frequency_days: 30,
    care_notes: "",
  })

  useEffect(() => {
    if (plant) {
      setFormData({
        name: plant.name,
        species: plant.species || "",
        location: plant.location || "",
        sunlight_level: plant.sunlight_level,
        watering_frequency_days: plant.watering_frequency_days,
        fertilizing_frequency_days: plant.fertilizing_frequency_days,
        care_notes: plant.care_notes || "",
      })
    }
  }, [plant])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (plant) {
      onSave({ id: plant.id, ...formData })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Plant</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                <SelectTrigger>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="watering">Water every (days)</Label>
              <Input
                id="watering"
                type="number"
                min="1"
                value={formData.watering_frequency_days}
                onChange={(e) =>
                  setFormData({ ...formData, watering_frequency_days: Number.parseInt(e.target.value) || 7 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fertilizing">Fertilize every (days)</Label>
              <Input
                id="fertilizing"
                type="number"
                min="1"
                value={formData.fertilizing_frequency_days}
                onChange={(e) =>
                  setFormData({ ...formData, fertilizing_frequency_days: Number.parseInt(e.target.value) || 30 })
                }
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
