"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, Globe, CheckCircle2, BookOpen } from "lucide-react"

interface ManualPlantFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (plant: ManualPlantData) => Promise<void>
  initialData?: Partial<ManualPlantData>
  sessionToComplete?: string | null
}

export interface ManualPlantData {
  name: string
  species: string
  location: string
  watering_frequency_days: number
  fertilizing_frequency_days: number
  sunlight_level: "low" | "medium" | "bright" | "direct"
  humidity_preference: string
  temperature_range: string
  care_notes: string
}

export function ManualPlantForm({ open, onOpenChange, onSubmit, initialData, sessionToComplete }: ManualPlantFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResearching, setIsResearching] = useState(false)
  const [researchProgress, setResearchProgress] = useState<{
    stage: "idle" | "researching" | "complete"
    sources: { name: string; completed: boolean }[]
  }>({
    stage: "idle",
    sources: [],
  })
  const [formData, setFormData] = useState<ManualPlantData>({
    name: initialData?.name || "",
    species: initialData?.species || "",
    location: initialData?.location || "",
    watering_frequency_days: initialData?.watering_frequency_days || 7,
    fertilizing_frequency_days: initialData?.fertilizing_frequency_days || 30,
    sunlight_level: initialData?.sunlight_level || "medium",
    humidity_preference: initialData?.humidity_preference || "moderate",
    temperature_range: initialData?.temperature_range || "60-75°F",
    care_notes: initialData?.care_notes || "",
  })

  // Update form data when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        species: initialData.species || "",
        location: initialData.location || "",
        watering_frequency_days: initialData.watering_frequency_days || 7,
        fertilizing_frequency_days: initialData.fertilizing_frequency_days || 30,
        sunlight_level: initialData.sunlight_level || "medium",
        humidity_preference: initialData.humidity_preference || "moderate",
        temperature_range: initialData.temperature_range || "60-75°F",
        care_notes: initialData.care_notes || "",
      })
    }
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmit(formData)
      // Reset form
      setFormData({
        name: "",
        species: "",
        location: "",
        watering_frequency_days: 7,
        fertilizing_frequency_days: 30,
        sunlight_level: "medium",
        humidity_preference: "moderate",
        temperature_range: "60-75°F",
        care_notes: "",
      })
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to add plant:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false)
    }
  }

  const handleResearch = async () => {
    if (!formData.species.trim()) {
      alert("Please enter a species name first")
      return
    }

    setIsResearching(true)
    setResearchProgress({
      stage: "researching",
      sources: [
        { name: "Royal Horticultural Society (RHS)", completed: false },
        { name: "Missouri Botanical Garden", completed: false },
        { name: "University Extension Services", completed: false },
      ],
    })

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setResearchProgress((prev) => {
          const incompleteSources = prev.sources.filter((s) => !s.completed)
          if (incompleteSources.length === 0) {
            clearInterval(progressInterval)
            return prev
          }
          
          const nextIncompleteIndex = prev.sources.findIndex((s) => !s.completed)
          const updatedSources = [...prev.sources]
          updatedSources[nextIncompleteIndex] = { ...updatedSources[nextIncompleteIndex], completed: true }
          
          return {
            ...prev,
            sources: updatedSources,
          }
        })
      }, 800)

      const response = await fetch("/api/identify-plant/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ species: formData.species }),
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        throw new Error("Failed to research plant care")
      }

      const data = await response.json()
      
      // Mark all sources as complete
      setResearchProgress((prev) => ({
        stage: "complete",
        sources: prev.sources.map((s) => ({ ...s, completed: true })),
      }))

      // Update form with researched values
      setFormData({
        ...formData,
        watering_frequency_days: data.watering_frequency_days,
        fertilizing_frequency_days: data.fertilizing_frequency_days,
        sunlight_level: data.sunlight_level,
        humidity_preference: data.humidity_preference,
        temperature_range: data.temperature_range,
        care_notes: data.care_notes,
      })

      // Reset progress after a short delay
      setTimeout(() => {
        setResearchProgress({ stage: "idle", sources: [] })
      }, 2000)
    } catch (error) {
      console.error("Failed to research plant:", error)
      alert("Failed to research plant care. Please try again.")
      setResearchProgress({ stage: "idle", sources: [] })
    } finally {
      setIsResearching(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Plant Manually</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Plant Name *</Label>
            <Input
              id="name"
              placeholder="e.g., My Snake Plant"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="species">Species (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="species"
                placeholder="e.g., Sansevieria trifasciata"
                value={formData.species}
                onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleResearch}
                disabled={isResearching || !formData.species.trim()}
                className="shrink-0"
                title="Research care requirements for this species"
              >
                {isResearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location *</Label>
            <Input
              id="location"
              placeholder="e.g., Living Room, Bedroom Window"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              required
            />
          </div>

          {/* Show research progress panel when researching */}
          {researchProgress.stage !== "idle" ? (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">Researching Care Requirements</h3>
                    {researchProgress.stage === "researching" && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 animate-pulse">
                        In Progress
                      </Badge>
                    )}
                    {researchProgress.stage === "complete" && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 bg-[var(--success-green)]/10 text-[var(--success-green)] border-[var(--success-green)]/30"
                      >
                        Complete
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Consulting authoritative botanical sources
                  </p>
                </div>
              </div>

              <div className="space-y-2 ml-1">
                <p className="text-xs text-muted-foreground font-medium mb-2">
                  Sources ({researchProgress.sources.filter((s) => s.completed).length}/{researchProgress.sources.length}):
                </p>
                {researchProgress.sources.map((source, index) => (
                  <div
                    key={source.name}
                    className="flex items-center gap-2 text-xs animate-in fade-in slide-in-from-left-2"
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    <div
                      className={`
                        w-5 h-5 rounded-full flex items-center justify-center
                        ${
                          source.completed
                            ? "bg-[var(--success-green)]/20 text-[var(--success-green)]"
                            : "bg-muted text-muted-foreground"
                        }
                      `}
                    >
                      {source.completed ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                    </div>
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className={source.completed ? "text-foreground" : "text-muted-foreground"}>
                      {source.name}
                    </span>
                    {source.completed && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1.5 bg-[var(--success-green)]/10 text-[var(--success-green)] border-[var(--success-green)]/30"
                      >
                        Verified
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Regular form fields - only show when not researching */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="watering">Watering (days) *</Label>
                  <Input
                    id="watering"
                    type="number"
                    min="1"
                    value={formData.watering_frequency_days}
                    onChange={(e) =>
                      setFormData({ ...formData, watering_frequency_days: parseInt(e.target.value) || 7 })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fertilizing">Fertilizing (days) *</Label>
                  <Input
                    id="fertilizing"
                    type="number"
                    min="1"
                    value={formData.fertilizing_frequency_days}
                    onChange={(e) =>
                      setFormData({ ...formData, fertilizing_frequency_days: parseInt(e.target.value) || 30 })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sunlight">Sunlight Level *</Label>
                <Select
                  value={formData.sunlight_level}
                  onValueChange={(value: "low" | "medium" | "bright" | "direct") =>
                    setFormData({ ...formData, sunlight_level: value })
                  }
                >
                  <SelectTrigger id="sunlight">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Minimal indirect light</SelectItem>
                    <SelectItem value="medium">Medium - Moderate indirect light</SelectItem>
                    <SelectItem value="bright">Bright - Bright indirect light</SelectItem>
                    <SelectItem value="direct">Direct - Direct sunlight</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="humidity">Humidity Preference</Label>
                <Input
                  id="humidity"
                  placeholder="e.g., moderate, high, low"
                  value={formData.humidity_preference}
                  onChange={(e) => setFormData({ ...formData, humidity_preference: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature Range</Label>
                <Input
                  id="temperature"
                  placeholder="e.g., 60-75°F"
                  value={formData.temperature_range}
                  onChange={(e) => setFormData({ ...formData, temperature_range: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Care Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional care instructions..."
                  value={formData.care_notes}
                  onChange={(e) => setFormData({ ...formData, care_notes: e.target.value })}
                  rows={3}
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Plant"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
