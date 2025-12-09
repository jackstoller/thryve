"use client"

import { useState, useMemo } from "react"
import useSWR, { mutate } from "swr"
import { Header } from "@/components/header"
import { PlantCard } from "@/components/plant-card"
import { AddPlantModal } from "@/components/add-plant-modal"
import { EditPlantModal } from "@/components/edit-plant-modal"
import { ImportSidebar } from "@/components/import-sidebar"
import { ScheduleView } from "@/components/schedule-view"
import { Button } from "@/components/ui/button"
import { Leaf, Plus, Loader2 } from "lucide-react"
import type { Plant, ImportSession } from "@/lib/types"
import { isPast, isToday } from "date-fns"
import { experimental_useObject as useObject } from "@ai-sdk/react"
import { z } from "zod"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json()
  if (data?.error || !Array.isArray(data)) {
    return []
  }
  return data
}

function getStreamingStatus(object: any): { status: ImportSession["status"]; currentAction: string } {
  if (!object) {
    return { status: "uploading", currentAction: "Preparing image..." }
  }

  const hasSpecies = !!object.identified_species
  const hasScientificName = !!object.scientific_name
  const hasCareRequirements = !!object.care_requirements
  const hasSources = object.research_sources?.length > 0
  const hasAllSources = object.research_sources?.length >= 3

  if (!hasSpecies) {
    return { status: "identifying", currentAction: "Analyzing plant features..." }
  }

  if (hasSpecies && !hasCareRequirements?.watering_frequency_days) {
    return { status: "identifying", currentAction: `Identified as ${object.identified_species}, gathering details...` }
  }

  if (hasCareRequirements && !hasSources) {
    return { status: "researching", currentAction: "Searching botanical databases..." }
  }

  if (hasSources && !hasAllSources) {
    return {
      status: "comparing",
      currentAction: `Found ${object.research_sources.length} source${object.research_sources.length > 1 ? "s" : ""}, verifying care requirements...`,
    }
  }

  if (hasAllSources) {
    return { status: "comparing", currentAction: "Cross-referencing sources for accuracy..." }
  }

  return { status: "researching", currentAction: "Gathering care information..." }
}

export default function Home() {
  const [view, setView] = useState<"grid" | "schedule">("grid")
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null)
  const [importSidebarOpen, setImportSidebarOpen] = useState(false)
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  const { data: plants = [], isLoading: plantsLoading } = useSWR<Plant[]>("/api/plants", fetcher)
  const { data: sessions = [], isLoading: sessionsLoading } = useSWR<ImportSession[]>("/api/import-sessions", fetcher)

  const {
    object,
    submit,
    isLoading: isIdentifying,
  } = useObject({
    api: "/api/identify-plant",
    schema: plantIdentificationSchema,
    onFinish: async ({ object }) => {
      if (object && currentSessionId) {
        await fetch(`/api/import-sessions/${currentSessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "confirming",
            identified_species: object.identified_species,
            scientific_name: object.scientific_name,
            confidence: object.confidence,
            care_requirements: object.care_requirements,
            research_sources: object.research_sources,
          }),
        })
        mutate("/api/import-sessions")
        setExpandedSessionId(currentSessionId)
      }
    },
  })

  const streamingInfo = useMemo(() => getStreamingStatus(object), [object])

  const enhancedSessions = useMemo(() => {
    return sessions.map((session) => {
      if (session.id === currentSessionId && isIdentifying && object) {
        return {
          ...session,
          status: streamingInfo.status,
          current_action: streamingInfo.currentAction,
          partial_data: {
            identified_species: object.identified_species,
            scientific_name: object.scientific_name,
            confidence: object.confidence,
            care_requirements: object.care_requirements,
            research_sources: object.research_sources || [],
          },
        }
      }
      return session
    })
  }, [sessions, currentSessionId, isIdentifying, object, streamingInfo])

  const activeSessions = enhancedSessions.filter((s) => s.status !== "completed")
  const urgentCount = plants.filter((p) => {
    const needsWater =
      p.next_water_date && (isPast(new Date(p.next_water_date)) || isToday(new Date(p.next_water_date)))
    const needsFertilizer =
      p.next_fertilize_date && (isPast(new Date(p.next_fertilize_date)) || isToday(new Date(p.next_fertilize_date)))
    return needsWater || needsFertilizer
  }).length

  const handleImageSelected = async (file: File) => {
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
      const { url } = await uploadRes.json()

      const sessionRes = await fetch("/api/import-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "uploading", image_url: url }),
      })
      const session = await sessionRes.json()

      setCurrentSessionId(session.id)
      setExpandedSessionId(session.id)
      setAddModalOpen(false)
      setImportSidebarOpen(true)

      mutate("/api/import-sessions")

      submit({ imageUrl: url, sessionId: session.id })
    } catch (error) {
      console.error("Failed to process image:", error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleWater = async (id: string) => {
    await fetch(`/api/plants/${id}/water`, { method: "POST" })
    mutate("/api/plants")
  }

  const handleFertilize = async (id: string) => {
    await fetch(`/api/plants/${id}/fertilize`, { method: "POST" })
    mutate("/api/plants")
  }

  const handleEdit = (plant: Plant) => {
    setEditingPlant(plant)
    setEditModalOpen(true)
  }

  const handleSaveEdit = async (updates: Partial<Plant> & { id: string }) => {
    await fetch(`/api/plants/${updates.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    mutate("/api/plants")
    setEditModalOpen(false)
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/plants/${id}`, { method: "DELETE" })
    mutate("/api/plants")
  }

  const handleConfirmImport = async (session: ImportSession) => {
    const careReqs = session.care_requirements || session.partial_data?.care_requirements
    const species = session.identified_species || session.partial_data?.identified_species
    const scientificName = session.scientific_name || session.partial_data?.scientific_name
    const sources = session.research_sources?.length ? session.research_sources : session.partial_data?.research_sources

    if (!careReqs) return

    const plantPayload = {
      name: species,
      species: species,
      scientific_name: scientificName,
      image_url: session.image_url,
      sunlight_level: careReqs.sunlight_level,
      watering_frequency_days: careReqs.watering_frequency_days,
      fertilizing_frequency_days: careReqs.fertilizing_frequency_days,
      humidity_preference: careReqs.humidity_preference,
      temperature_range: careReqs.temperature_range,
      care_notes: careReqs.care_notes,
      sources: sources || [],
    }

    const plantRes = await fetch("/api/plants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plantPayload),
    })

    await fetch(`/api/import-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    })

    mutate("/api/plants")
    mutate("/api/import-sessions")
    setExpandedSessionId(null)
  }

  const handleCancelImport = async (id: string) => {
    await fetch(`/api/import-sessions/${id}`, { method: "DELETE" })
    mutate("/api/import-sessions")
  }

  if (plantsLoading || sessionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        view={view}
        onViewChange={setView}
        onAddPlant={() => setAddModalOpen(true)}
        importCount={activeSessions.length}
        urgentCount={urgentCount}
      />

      {activeSessions.length > 0 && (
        <div className="bg-primary/5 border-b">
          <div className="container mx-auto px-4 py-3">
            <button
              onClick={() => setImportSidebarOpen(true)}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              {activeSessions.length} plant{activeSessions.length > 1 ? "s" : ""} importing...
            </button>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
        {plants.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Leaf className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">No plants yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start building your plant collection by taking a photo. Our AI will identify the plant and find its care
              requirements.
            </p>
            <Button size="lg" onClick={() => setAddModalOpen(true)}>
              <Plus className="w-5 h-5 mr-2" />
              Add Your First Plant
            </Button>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {plants.map((plant) => (
              <PlantCard
                key={plant.id}
                plant={plant}
                onWater={handleWater}
                onFertilize={handleFertilize}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <ScheduleView plants={plants} onWater={handleWater} onFertilize={handleFertilize} />
          </div>
        )}
      </main>

      <AddPlantModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onImageSelected={handleImageSelected}
        isUploading={isUploading}
      />

      <EditPlantModal
        plant={editingPlant}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSave={handleSaveEdit}
      />

      <ImportSidebar
        sessions={enhancedSessions}
        open={importSidebarOpen}
        onClose={() => setImportSidebarOpen(false)}
        onConfirm={handleConfirmImport}
        onCancel={handleCancelImport}
        expandedId={expandedSessionId}
        onToggleExpand={(id) => setExpandedSessionId(expandedSessionId === id ? null : id)}
      />
    </div>
  )
}

const plantIdentificationSchema = z.object({
  identified_species: z.string(),
  scientific_name: z.string(),
  confidence: z.number(),
  care_requirements: z.object({
    watering_frequency_days: z.number(),
    fertilizing_frequency_days: z.number(),
    sunlight_level: z.enum(["low", "medium", "bright", "direct"]),
    humidity_preference: z.string(),
    temperature_range: z.string(),
    care_notes: z.string(),
  }),
  research_sources: z.array(
    z.object({
      name: z.string(),
      recommendation: z.string(),
    }),
  ),
})
