"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR, { mutate } from "swr"
import { Header } from "@/components/header"
import { MobileNav } from "@/components/mobile-nav"
import { PlantCard } from "@/components/plant-card"
import { AddPlantModal } from "@/components/add-plant-modal"
import { EditPlantModal } from "@/components/edit-plant-modal"
import { ManualPlantForm, type ManualPlantData } from "@/components/manual-plant-form"
import { ImportSidebar } from "@/components/import-sidebar"
import { ScheduleView } from "@/components/schedule-view"
import { PlantDetailDrawer } from "@/components/plant-detail-drawer"
import { PlantGalleryFilters } from "@/components/plant-gallery-filters"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { Leaf, Plus, Loader2 } from "lucide-react"
import type { Plant, ImportSession } from "@/lib/types"
import { isPast, isToday } from "date-fns"
import { useRouter } from "next/navigation"

function BrandedLoadingScreen() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="h-14 w-14 rounded-2xl flex items-center justify-center overflow-hidden">
          <Image
            src="/logo-square-transparent.png"
            alt="Thryve"
            width={48}
            height={48}
            priority
          />
        </div>

        <div className="text-lg font-title tracking-tight">Thryve</div>

        <div
          className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin"
          aria-label="Loading"
        />
      </div>
    </div>
  )
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json()
  if (data?.error || !Array.isArray(data)) {
    return []
  }
  return data
}

const jsonFetcher = async (url: string) => {
  const res = await fetch(url)
  return res.json()
}

export default function Home() {
  const router = useRouter()
  const { data: me, isLoading: meLoading } = useSWR("/api/me", jsonFetcher)
  const isAuthenticated = !!me?.user

  const [view, setView] = useState<"grid" | "schedule">("grid")
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [manualFormOpen, setManualFormOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null)
  const [importSidebarOpen, setImportSidebarOpen] = useState(false)
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [correctingSession, setCorrectingSession] = useState<ImportSession | null>(null)
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null)
  const [plantDetailOpen, setPlantDetailOpen] = useState(false)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([])

  const { data: plants = [], isLoading: plantsLoading } = useSWR<Plant[]>(isAuthenticated ? "/api/plants" : null, fetcher)
  const { data: sessions = [], isLoading: sessionsLoading } = useSWR<ImportSession[]>(isAuthenticated ? "/api/import-sessions" : null, fetcher, {
    refreshInterval: 2000, // Poll every 2 seconds for active sessions
    onSuccess: (data) => {
      // Refresh plants list when a session completes
      const hasCompleted = data.some((s) => s.status === "completed")
      if (hasCompleted) {
        mutate("/api/plants")
      }
    },
  })

  const activeSessions = sessions.filter((s) => s.status !== "completed")
  const urgentCount = plants.filter((p) => {
    const needsWater =
      p.next_water_date && (isPast(new Date(p.next_water_date)) || isToday(new Date(p.next_water_date)))
    const needsFertilizer =
      p.next_fertilize_date && (isPast(new Date(p.next_fertilize_date)) || isToday(new Date(p.next_fertilize_date)))
    return needsWater || needsFertilizer
  }).length

  // Filter plants based on search and filters
  const filteredPlants = useMemo(() => {
    return plants.filter((plant) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = plant.name.toLowerCase().includes(query)
        const matchesSpecies = plant.species?.toLowerCase().includes(query)
        const matchesLocation = plant.location?.toLowerCase().includes(query)
        if (!matchesName && !matchesSpecies && !matchesLocation) {
          return false
        }
      }

      // Location filter
      if (selectedLocations.length > 0 && plant.location) {
        if (!selectedLocations.includes(plant.location)) {
          return false
        }
      }

      // Species filter
      if (selectedSpecies.length > 0 && plant.species) {
        if (!selectedSpecies.includes(plant.species)) {
          return false
        }
      }

      return true
    })
  }, [plants, searchQuery, selectedLocations, selectedSpecies])

  useEffect(() => {
    if (!meLoading && !isAuthenticated) {
      router.replace("/login")
    }
  }, [meLoading, isAuthenticated, router])

  if (meLoading) {
    return <BrandedLoadingScreen />
  }

  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const handleImageSelected = async (files: File[], name: string, location: string) => {
    try {
      // Upload all images
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData()
        formData.append("file", file)
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
        
        if (!uploadRes.ok) {
          const error = await uploadRes.json()
          throw new Error(error.error || "Upload failed")
        }
        
        const { url } = await uploadRes.json()
        return url
      })

      const imageUrls = await Promise.all(uploadPromises)

      // Create import session with name, location, and first image
      const sessionRes = await fetch("/api/import-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: "uploading", 
          image_url: imageUrls[0], // Primary image
          plant_name: name,
          plant_location: location
        }),
      })

      if (!sessionRes.ok) {
        const error = await sessionRes.json()
        throw new Error(error.error || "Failed to create import session")
      }

      const session = await sessionRes.json()

      setExpandedSessionId(session.id)
      setImportSidebarOpen(true)

      mutate("/api/import-sessions")

      // Start the identification process with the first image
      const identifyRes = await fetch("/api/identify-plant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: imageUrls[0], sessionId: session.id, additionalPhotos: imageUrls.slice(1) }),
      })

      if (!identifyRes.ok) {
        const error = await identifyRes.json()
        // Update session with error
        await fetch(`/api/import-sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "failed",
            error_message: error.error || "Failed to start identification",
          }),
        })
      }

      // Trigger immediate refresh
      mutate("/api/import-sessions")
    } catch (error) {
      console.error("Failed to process image:", error)
      alert(error instanceof Error ? error.message : "Failed to process image")
      throw error
    }
  }

  const handleManualAdd = async (plantData: ManualPlantData) => {
    try {
      const now = new Date().toISOString()
      const nextWaterDate = new Date()
      nextWaterDate.setDate(nextWaterDate.getDate() + plantData.watering_frequency_days)
      const nextFertilizeDate = new Date()
      nextFertilizeDate.setDate(nextFertilizeDate.getDate() + plantData.fertilizing_frequency_days)

      const response = await fetch("/api/plants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: plantData.name,
          species: plantData.species || null,
          scientific_name: correctingSession?.scientific_name || null,
          image_url: correctingSession?.image_url || null,
          location: plantData.location,
          sunlight_level: plantData.sunlight_level,
          watering_frequency_days: plantData.watering_frequency_days,
          fertilizing_frequency_days: plantData.fertilizing_frequency_days,
          last_watered: now,
          last_fertilized: now,
          next_water_date: nextWaterDate.toISOString(),
          next_fertilize_date: nextFertilizeDate.toISOString(),
          humidity_preference: plantData.humidity_preference,
          temperature_range: plantData.temperature_range,
          care_notes: plantData.care_notes,
          sources: correctingSession?.research_sources || [],
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to add plant")
      }

      // If this was a correction, delete the failed session
      if (correctingSession) {
        await fetch(`/api/import-sessions/${correctingSession.id}`, { method: "DELETE" })
        setCorrectingSession(null)
      }

      mutate("/api/plants")
      mutate("/api/import-sessions")
    } catch (error) {
      console.error("Failed to add plant:", error)
      alert(error instanceof Error ? error.message : "Failed to add plant")
      throw error
    }
  }

  const handleWater = async (id: string) => {
    await fetch(`/api/plants/${id}/water`, { method: "POST" })
    mutate("/api/plants")
    mutate(`/api/plants/${id}/history`)
  }

  const handleFertilize = async (id: string) => {
    await fetch(`/api/plants/${id}/fertilize`, { method: "POST" })
    mutate("/api/plants")
    mutate(`/api/plants/${id}/history`)
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

  const handleCancelImport = async (id: string) => {
    await fetch(`/api/import-sessions/${id}`, { method: "DELETE" })
    mutate("/api/import-sessions")
  }

  const handleCorrectImport = (session: ImportSession) => {
    setCorrectingSession(session)
    setManualFormOpen(true)
  }

  const handlePlantClick = (plant: Plant) => {
    setSelectedPlant(plant)
    setPlantDetailOpen(true)
  }

  const handleViewChange = (nextView: "grid" | "schedule") => {
    setView(nextView)
    setPlantDetailOpen(false)
    setSelectedPlant(null)
  }

  if (plantsLoading || sessionsLoading) {
    return <BrandedLoadingScreen />
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <Header
        view={view}
        onViewChange={handleViewChange}
        urgentCount={urgentCount}
      />

      {activeSessions.length > 0 && (
        <div className="bg-primary/5 border-b flex-shrink-0">
          <div className="px-4 py-2.5">
            <button
              onClick={() => setImportSidebarOpen(true)}
              className="flex items-center gap-2 text-xs font-medium text-primary active:opacity-70"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {activeSessions.length} plant{activeSessions.length > 1 ? "s" : ""} importing...
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto overscroll-contain pt-4 pb-20">
        {plants.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Leaf className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No plants yet</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Start building your plant collection by taking a photo. Our AI will identify the plant and find its care
              requirements.
            </p>
            <Button size="lg" onClick={() => setAddModalOpen(true)} className="active:scale-95">
              <Plus className="w-5 h-5 mr-2" />
              Add Your First Plant
            </Button>
          </div>
        ) : view === "grid" ? (
          <div className="px-4">
            <PlantGalleryFilters
              plants={plants}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedLocations={selectedLocations}
              onLocationsChange={setSelectedLocations}
              selectedSpecies={selectedSpecies}
              onSpeciesChange={setSelectedSpecies}
            />
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4 pb-4">
              {filteredPlants.map((plant) => (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                  onWater={handleWater}
                  onFertilize={handleFertilize}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onClick={handlePlantClick}
                />
              ))}
            </div>
            {filteredPlants.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">No plants match your filters</p>
                <Button
                  variant="link"
                  onClick={() => {
                    setSearchQuery("")
                    setSelectedLocations([])
                    setSelectedSpecies([])
                  }}
                  className="mt-2 active:scale-95"
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="px-4">
            <ScheduleView 
              plants={plants} 
              onWater={handleWater} 
              onFertilize={handleFertilize}
              onPlantClick={handlePlantClick}
            />
          </div>
        )}
      </main>

      <AddPlantModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onImageSelected={handleImageSelected}
        onManualAdd={() => {
          setCorrectingSession(null)
          setManualFormOpen(true)
        }}
      />

      <ManualPlantForm
        open={manualFormOpen}
        onOpenChange={(open) => {
          setManualFormOpen(open)
          if (!open) {
            setCorrectingSession(null)
          }
        }}
        onSubmit={handleManualAdd}
        initialData={correctingSession ? {
          name: correctingSession.plant_name || "",
          species: correctingSession.identified_species || "",
          location: correctingSession.plant_location || "",
          watering_frequency_days: correctingSession.care_requirements?.watering_frequency_days,
          fertilizing_frequency_days: correctingSession.care_requirements?.fertilizing_frequency_days,
          sunlight_level: correctingSession.care_requirements?.sunlight_level,
          humidity_preference: correctingSession.care_requirements?.humidity_preference,
          temperature_range: correctingSession.care_requirements?.temperature_range,
          care_notes: correctingSession.care_requirements?.care_notes,
        } : undefined}
        sessionToComplete={correctingSession?.id || null}
        researchSources={correctingSession?.research_sources || []}
      />

      <EditPlantModal
        plant={editingPlant}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSave={handleSaveEdit}
      />

      <ImportSidebar
        sessions={sessions}
        open={importSidebarOpen}
        onClose={() => setImportSidebarOpen(false)}
        onConfirm={() => {}} 
        onCancel={handleCancelImport}
        onCorrect={handleCorrectImport}
        expandedId={expandedSessionId}
        onToggleExpand={(id) => setExpandedSessionId(expandedSessionId === id ? null : id)}
      />

      <PlantDetailDrawer
        plant={selectedPlant}
        open={plantDetailOpen}
        onClose={() => setPlantDetailOpen(false)}
        onWater={handleWater}
        onFertilize={handleFertilize}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <MobileNav
        view={view}
        onViewChange={handleViewChange}
        onAddPlant={() => setAddModalOpen(true)}
        urgentCount={urgentCount}
      />
    </div>
  )
}
