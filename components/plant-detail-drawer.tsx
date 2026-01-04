"use client"

import { useState, useEffect, useRef } from "react"
import useSWR, { mutate } from "swr"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Droplets,
  Leaf,
  Sun,
  MapPin,
  Thermometer,
  Wind,
  Calendar,
  ExternalLink,
  X,
  Edit,
  Trash2,
  History,
} from "lucide-react"
import type { Plant, CareHistoryItem } from "@/lib/types"
import { format, formatDistanceToNow, isPast, isToday, differenceInDays } from "date-fns"

const CONFETTI_VECTORS: Array<{ x: number; y: number; r: number; delay: number }> = [
  { x: -20, y: -26, r: -18, delay: 0 },
  { x: -8, y: -30, r: 10, delay: 20 },
  { x: 6, y: -28, r: 24, delay: 40 },
  { x: 18, y: -24, r: 38, delay: 10 },
  { x: -24, y: -14, r: -34, delay: 60 },
  { x: -14, y: -12, r: -10, delay: 80 },
  { x: 14, y: -12, r: 12, delay: 70 },
  { x: 26, y: -14, r: 30, delay: 50 },
  { x: -18, y: -6, r: -22, delay: 90 },
  { x: 18, y: -6, r: 20, delay: 100 },
]

const fetcher = async (url: string) => {
  const res = await fetch(url)
  return res.json()
}

interface PlantDetailDrawerProps {
  plant: Plant | null
  open: boolean
  onClose: () => void
  onWater: (id: string) => Promise<void>
  onFertilize: (id: string) => Promise<void>
  onEdit: (plant: Plant) => void
  onDelete: (id: string) => void
}

export function PlantDetailDrawer({
  plant,
  open,
  onClose,
  onWater,
  onFertilize,
  onEdit,
  onDelete,
}: PlantDetailDrawerProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [loadingAction, setLoadingAction] = useState<"water" | "fertilize" | null>(null)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const [historyEditMode, setHistoryEditMode] = useState(false)
  const [historySavingId, setHistorySavingId] = useState<string | "new" | null>(null)
  const [historyJustSavedId, setHistoryJustSavedId] = useState<string | "new" | null>(null)
  const [historyDrafts, setHistoryDrafts] = useState<
    Record<string, { care_type: "water" | "fertilize"; performed_at: string; notes: string }>
  >({})
  const [newHistory, setNewHistory] = useState<{ care_type: "water" | "fertilize"; performed_at: string; notes: string }>({
    care_type: "water",
    performed_at: "",
    notes: "",
  })

  const containerRef = useRef<HTMLDivElement | null>(null)
  const containerScrollRaf = useRef<number | null>(null)
  const galleryRef = useRef<HTMLDivElement | null>(null)

  const [waterCelebrateKey, setWaterCelebrateKey] = useState(0)
  const [fertilizeCelebrateKey, setFertilizeCelebrateKey] = useState(0)
  const [waterPopping, setWaterPopping] = useState(false)
  const [fertilizePopping, setFertilizePopping] = useState(false)
  const waterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fertilizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: careHistory } = useSWR<CareHistoryItem[]>(
    plant ? `/api/plants/${plant.id}/history` : null,
    fetcher
  )

  const careHistoryArray = Array.isArray(careHistory) ? careHistory : []

  const isoToLocalInput = (iso: string) => {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const localInputToIso = (value: string) => {
    const d = new Date(value)
    return d.toISOString()
  }

  const flashSaved = (id: string | "new") => {
    setHistoryJustSavedId(id)
    window.setTimeout(() => {
      setHistoryJustSavedId((prev) => (prev === id ? null : prev))
    }, 900)
  }

  useEffect(() => {
    if (!historyEditMode) return
    setHistoryDrafts((prev) => {
      const next = { ...prev }
      for (const entry of careHistoryArray) {
        if (next[entry.id]) continue
        next[entry.id] = {
          care_type: entry.care_type,
          performed_at: isoToLocalInput(entry.performed_at),
          notes: entry.notes ?? "",
        }
      }
      return next
    })

    setNewHistory((prev) => ({
      ...prev,
      performed_at: prev.performed_at || isoToLocalInput(new Date().toISOString()),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyEditMode, plant?.id, careHistoryArray.length])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    return () => {
      if (waterTimeoutRef.current) clearTimeout(waterTimeoutRef.current)
      if (fertilizeTimeoutRef.current) clearTimeout(fertilizeTimeoutRef.current)
    }
  }, [])

  // Reset photo index when plant changes
  useEffect(() => {
    setCurrentPhotoIndex(0)
  }, [plant?.id])

  if (!plant) return null

  const needsWater =
    plant.next_water_date && (isPast(new Date(plant.next_water_date)) || isToday(new Date(plant.next_water_date)))
  const needsFertilizer =
    plant.next_fertilize_date &&
    (isPast(new Date(plant.next_fertilize_date)) || isToday(new Date(plant.next_fertilize_date)))

  const triggerCelebrate = (kind: "water" | "fertilize") => {
    if (kind === "water") {
      setWaterCelebrateKey((k) => k + 1)
      setWaterPopping(true)
      if (waterTimeoutRef.current) clearTimeout(waterTimeoutRef.current)
      waterTimeoutRef.current = setTimeout(() => setWaterPopping(false), 900)
      return
    }

    setFertilizeCelebrateKey((k) => k + 1)
    setFertilizePopping(true)
    if (fertilizeTimeoutRef.current) clearTimeout(fertilizeTimeoutRef.current)
    fertilizeTimeoutRef.current = setTimeout(() => setFertilizePopping(false), 900)
  }
  
  // Get sorted photos or fallback
  const photos = plant.photos && plant.photos.length > 0 
    ? plant.photos.sort((a, b) => a.order - b.order)
    : plant.image_url ? [{ id: 'fallback', url: plant.image_url, order: 0 }] : []
  
  const hasMultiplePhotos = photos.length > 1

  const handleDotClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    setCurrentPhotoIndex(index)

    const el = galleryRef.current
    if (!el) return
    const width = el.clientWidth
    el.scrollTo({ left: width * index, behavior: "smooth" })
  }

  const handleGalleryScroll = () => {
    const el = galleryRef.current
    if (!el) return
    const width = el.clientWidth || 1
    const nextIndex = Math.round(el.scrollLeft / width)
    if (nextIndex !== currentPhotoIndex) {
      setCurrentPhotoIndex(nextIndex)
    }
  }

  const getSunlightLabel = (level: string | null) => {
    switch (level) {
      case "low":
        return "Low Light"
      case "medium":
        return "Medium Light"
      case "bright":
        return "Bright Indirect"
      case "direct":
        return "Direct Sunlight"
      default:
        return "Unknown"
    }
  }

  const getWaterProgress = () => {
    if (!plant.last_watered || !plant.next_water_date) return 0
    const lastWatered = new Date(plant.last_watered)
    const nextWater = new Date(plant.next_water_date)
    const totalDays = plant.watering_frequency_days
    const daysPassed = differenceInDays(new Date(), lastWatered)
    const progress = Math.min((daysPassed / totalDays) * 100, 100)
    return Math.max(0, progress)
  }

  const getFertilizerProgress = () => {
    if (!plant.last_fertilized || !plant.next_fertilize_date) return 0
    const lastFertilized = new Date(plant.last_fertilized)
    const nextFertilize = new Date(plant.next_fertilize_date)
    const totalDays = plant.fertilizing_frequency_days
    const daysPassed = differenceInDays(new Date(), lastFertilized)
    const progress = Math.min((daysPassed / totalDays) * 100, 100)
    return Math.max(0, progress)
  }

  const waterProgress = getWaterProgress()
  const fertilizerProgress = getFertilizerProgress()

  // Shared content component
  const renderContent = (useDialogTitle: boolean = false, fullScreen: boolean = false) => (
    <div
      ref={containerRef}
      className={
        fullScreen
          ? "overflow-y-auto h-full rounded-none"
          : "overflow-y-auto max-h-[90vh] rounded-lg"
      }
      onScroll={(e) => {
        const target = e.currentTarget
        if (containerScrollRaf.current) {
          cancelAnimationFrame(containerScrollRaf.current)
        }
        containerScrollRaf.current = requestAnimationFrame(() => {
          const y = Math.min(40, Math.max(0, target.scrollTop * 0.12))
          containerRef.current?.style.setProperty("--thryve-parallax-y", `${y}px`)
        })
      }}
    >
      {/* Photo Gallery with Carousel */}
      {photos.length > 0 ? (
        <div className="relative h-[28rem] sm:h-[32rem] bg-muted group">
          <div
            ref={galleryRef}
            onScroll={handleGalleryScroll}
            className="h-full flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {photos.map((photo, idx) => (
              <div key={photo.id} className="w-full h-full flex-shrink-0 snap-center">
                <img
                  src={photo.url}
                  alt={`${plant.name} ${idx + 1}`}
                  loading={idx === 0 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={idx === 0 ? "high" : "low"}
                  className="w-full h-full object-cover will-change-transform"
                  style={{ transform: "translate3d(0,var(--thryve-parallax-y,0px),0) scale(1.06)" }}
                />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

          {/* Photo Indicators */}
          {hasMultiplePhotos && (
            <>
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                {photos.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => handleDotClick(e, index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentPhotoIndex 
                        ? 'bg-white w-6' 
                        : 'bg-white/50 hover:bg-white/75'
                    }`}
                    aria-label={`Go to photo ${index + 1}`}
                  />
                ))}
              </div>

              <div className="pointer-events-none absolute top-4 left-4 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium z-20">
                {currentPhotoIndex + 1} / {photos.length}
              </div>
            </>
          )}
          
          {/* Close Button for Mobile */}
          {!useDialogTitle && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm hover:bg-background z-20"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </Button>
          )}

          {/* Plant Name Overlay */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-6 text-white z-10">
            {useDialogTitle ? (
              <DialogTitle className="text-3xl font-bold mb-1">{plant.name}</DialogTitle>
            ) : (
              <h2 className="text-3xl font-bold mb-1">{plant.name}</h2>
            )}
            {plant.species && <p className="text-lg italic opacity-90">{plant.species}</p>}
            {plant.location && (
              <div className="flex items-center gap-1 mt-2 opacity-90">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{plant.location}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="relative h-64 bg-muted">
          <div className="w-full h-full flex items-center justify-center">
            <Leaf className="w-24 h-24 text-primary/30" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          
          {!useDialogTitle && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm hover:bg-background"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </Button>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            {useDialogTitle ? (
              <DialogTitle className="text-3xl font-bold mb-1">{plant.name}</DialogTitle>
            ) : (
              <h2 className="text-3xl font-bold mb-1">{plant.name}</h2>
            )}
            {plant.species && <p className="text-lg italic opacity-90">{plant.species}</p>}
            {plant.location && (
              <div className="flex items-center gap-1 mt-2 opacity-90">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{plant.location}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] space-y-6">
          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="default"
              disabled={loadingAction !== null}
              aria-busy={loadingAction === "water"}
              className={`relative flex-1 transition-transform active:scale-[0.97] text-white bg-gradient-to-r from-blue-500 to-blue-600 active:from-blue-600 active:to-blue-700 ${waterPopping ? "thryve-press-pop" : ""}`}
              onClick={async () => {
                setLoadingAction("water")
                try {
                  await onWater(plant.id)
                  await Promise.all([
                    mutate(`/api/plants/${plant.id}/history`),
                    mutate("/api/plants"),
                  ])
                  triggerCelebrate("water")
                } finally {
                  setLoadingAction(null)
                }
              }}
            >
              {waterPopping && (
                <span
                  key={waterCelebrateKey}
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                  {CONFETTI_VECTORS.map((v, i) => (
                    <span
                      // eslint-disable-next-line react/no-array-index-key
                      key={i}
                      className="thryve-confetti-piece"
                      style={{
                        ["--x" as any]: `${v.x}px`,
                        ["--y" as any]: `${v.y}px`,
                        ["--r" as any]: `${v.r}deg`,
                        ["--delay" as any]: `${v.delay}ms`,
                      }}
                    />
                  ))}
                </span>
              )}
              <Droplets className="w-4 h-4 mr-2" />
              {loadingAction === "water" ? "Watering…" : "Water"}
            </Button>
            <Button
              variant="default"
              disabled={loadingAction !== null}
              aria-busy={loadingAction === "fertilize"}
              className={`relative flex-1 transition-transform active:scale-[0.97] text-white bg-gradient-to-r from-amber-500 to-amber-600 active:from-amber-600 active:to-amber-700 ${fertilizePopping ? "thryve-press-pop" : ""}`}
              onClick={async () => {
                setLoadingAction("fertilize")
                try {
                  await onFertilize(plant.id)
                  await Promise.all([
                    mutate(`/api/plants/${plant.id}/history`),
                    mutate("/api/plants"),
                  ])
                  triggerCelebrate("fertilize")
                } finally {
                  setLoadingAction(null)
                }
              }}
            >
              {fertilizePopping && (
                <span
                  key={fertilizeCelebrateKey}
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                  {CONFETTI_VECTORS.map((v, i) => (
                    <span
                      // eslint-disable-next-line react/no-array-index-key
                      key={i}
                      className="thryve-confetti-piece"
                      style={{
                        ["--x" as any]: `${v.x}px`,
                        ["--y" as any]: `${v.y}px`,
                        ["--r" as any]: `${v.r}deg`,
                        ["--delay" as any]: `${v.delay}ms`,
                      }}
                    />
                  ))}
                </span>
              )}
              <Leaf className="w-4 h-4 mr-2" />
              {loadingAction === "fertilize" ? "Feeding…" : "Feed"}
            </Button>
          </div>

          {/* Care Progress */}
          <Card>
            <CardContent className="p-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-[var(--water-blue)]" />
                    <span className="font-medium">Watering</span>
                  </div>
                  {plant.next_water_date && (
                    <span className="text-sm text-muted-foreground">
                      {isPast(new Date(plant.next_water_date)) && !isToday(new Date(plant.next_water_date))
                        ? "Overdue!"
                        : isToday(new Date(plant.next_water_date))
                          ? "Today"
                          : `In ${formatDistanceToNow(new Date(plant.next_water_date))}`}
                    </span>
                  )}
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      waterProgress >= 100 ? "bg-[var(--water-blue)]" : "bg-[var(--water-blue)]/60"
                    }`}
                    style={{ width: `${waterProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>
                    {plant.last_watered
                      ? `Last: ${format(new Date(plant.last_watered), "MMM d")}`
                      : "Never watered"}
                  </span>
                  <span>Every {plant.watering_frequency_days} days</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Leaf className="w-4 h-4 text-[var(--fertilizer-amber)]" />
                    <span className="font-medium">Fertilizing</span>
                  </div>
                  {plant.next_fertilize_date && (
                    <span className="text-sm text-muted-foreground">
                      {isPast(new Date(plant.next_fertilize_date)) && !isToday(new Date(plant.next_fertilize_date))
                        ? "Overdue!"
                        : isToday(new Date(plant.next_fertilize_date))
                          ? "Today"
                          : `In ${formatDistanceToNow(new Date(plant.next_fertilize_date))}`}
                    </span>
                  )}
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      fertilizerProgress >= 100 ? "bg-[var(--fertilizer-amber)]" : "bg-[var(--fertilizer-amber)]/60"
                    }`}
                    style={{ width: `${fertilizerProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>
                    {plant.last_fertilized
                      ? `Last: ${format(new Date(plant.last_fertilized), "MMM d")}`
                      : "Never fertilized"}
                  </span>
                  <span>Every {plant.fertilizing_frequency_days} days</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Care Requirements */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Care Requirements</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--water-blue)]/10 flex items-center justify-center flex-shrink-0">
                    <Droplets className="w-5 h-5 text-[var(--water-blue)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">Watering</p>
                    <p className="font-medium">Every {plant.watering_frequency_days} days</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Leaf className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">Fertilizing</p>
                    <p className="font-medium">Every {plant.fertilizing_frequency_days} days</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--sun-yellow)]/10 flex items-center justify-center flex-shrink-0">
                    <Sun className="w-5 h-5 text-[var(--sun-yellow)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">Sunlight</p>
                    <p className="font-medium">{getSunlightLabel(plant.sunlight_level)}</p>
                  </div>
                </div>

                {plant.humidity_preference && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Wind className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">Humidity</p>
                      <p className="font-medium">{plant.humidity_preference}</p>
                    </div>
                  </div>
                )}

                {plant.temperature_range && (
                  <div className="flex items-start gap-3 col-span-2">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                      <Thermometer className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">Temperature</p>
                      <p className="font-medium">{plant.temperature_range}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Care Notes */}
          {plant.care_notes && (
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Care Notes</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{plant.care_notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Care History */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-lg">Care History</h3>
                </div>
                <div className="flex items-center gap-2">
                  {careHistoryArray.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {careHistoryArray.length} {careHistoryArray.length === 1 ? 'entry' : 'entries'}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={historySavingId !== null}
                    onClick={() => setHistoryEditMode((v) => !v)}
                  >
                    {historyEditMode ? "Done" : "Edit"}
                  </Button>
                </div>
              </div>

              {historyEditMode ? (
                <div className="space-y-3">
                  <div className="rounded-lg border p-3 bg-muted/20">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Type</div>
                        <Select
                          value={newHistory.care_type}
                          onValueChange={(v: "water" | "fertilize") => setNewHistory((p) => ({ ...p, care_type: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="water">Water</SelectItem>
                            <SelectItem value="fertilize">Feed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <div className="text-xs text-muted-foreground">Date</div>
                        <Input
                          type="datetime-local"
                          value={newHistory.performed_at}
                          onChange={(e) => setNewHistory((p) => ({ ...p, performed_at: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-1 mt-2">
                      <div className="text-xs text-muted-foreground">Notes (optional)</div>
                      <Textarea
                        value={newHistory.notes}
                        onChange={(e) => setNewHistory((p) => ({ ...p, notes: e.target.value }))}
                        rows={2}
                      />
                    </div>

                    <div className="flex justify-end mt-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={historySavingId !== null || !newHistory.performed_at}
                        onClick={async () => {
                          if (!plant) return
                          setHistorySavingId("new")
                          try {
                            const res = await fetch(`/api/plants/${plant.id}/history`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                care_type: newHistory.care_type,
                                performed_at: localInputToIso(newHistory.performed_at),
                                notes: newHistory.notes || null,
                              }),
                            })
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({}))
                              throw new Error(data?.error || "Failed to add history")
                            }

                            await Promise.all([
                              mutate(`/api/plants/${plant.id}/history`),
                              mutate("/api/plants"),
                            ])

                            setNewHistory({
                              care_type: "water",
                              performed_at: isoToLocalInput(new Date().toISOString()),
                              notes: "",
                            })
                            flashSaved("new")
                          } catch (error) {
                            alert(error instanceof Error ? error.message : "Failed to add history")
                          } finally {
                            setHistorySavingId(null)
                          }
                        }}
                      >
                        {historySavingId === "new" ? "Saving…" : historyJustSavedId === "new" ? "Saved" : "Add"}
                      </Button>
                    </div>
                  </div>

                  {careHistoryArray.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      No history yet — add your first record above.
                    </div>
                  )}

                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
                    {careHistoryArray.map((entry) => {
                      const draft = historyDrafts[entry.id]
                      if (!draft) return null

                      const isDirty =
                        draft.care_type !== entry.care_type ||
                        draft.performed_at !== isoToLocalInput(entry.performed_at) ||
                        draft.notes !== (entry.notes ?? "")

                      return (
                        <div key={entry.id} className="rounded-lg border p-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground">Type</div>
                              <Select
                                value={draft.care_type}
                                onValueChange={(v: "water" | "fertilize") =>
                                  setHistoryDrafts((p) => ({ ...p, [entry.id]: { ...p[entry.id], care_type: v } }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="water">Water</SelectItem>
                                  <SelectItem value="fertilize">Feed</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1 sm:col-span-2">
                              <div className="text-xs text-muted-foreground">Date</div>
                              <Input
                                type="datetime-local"
                                value={draft.performed_at}
                                onChange={(e) =>
                                  setHistoryDrafts((p) => ({ ...p, [entry.id]: { ...p[entry.id], performed_at: e.target.value } }))
                                }
                              />
                            </div>
                          </div>

                          <div className="space-y-1 mt-2">
                            <div className="text-xs text-muted-foreground">Notes</div>
                            <Textarea
                              value={draft.notes}
                              onChange={(e) =>
                                setHistoryDrafts((p) => ({ ...p, [entry.id]: { ...p[entry.id], notes: e.target.value } }))
                              }
                              rows={2}
                            />
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(entry.performed_at), { addSuffix: true })}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={historySavingId !== null || !draft.performed_at || !isDirty}
                                onClick={async () => {
                                  if (!plant) return
                                  setHistorySavingId(entry.id)
                                  try {
                                    const res = await fetch(`/api/plants/${plant.id}/history`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        id: entry.id,
                                        care_type: draft.care_type,
                                        performed_at: localInputToIso(draft.performed_at),
                                        notes: draft.notes || null,
                                      }),
                                    })
                                    if (!res.ok) {
                                      const data = await res.json().catch(() => ({}))
                                      throw new Error(data?.error || "Failed to save history")
                                    }

                                    await Promise.all([
                                      mutate(`/api/plants/${plant.id}/history`),
                                      mutate("/api/plants"),
                                    ])
                                    flashSaved(entry.id)
                                  } catch (error) {
                                    alert(error instanceof Error ? error.message : "Failed to save history")
                                  } finally {
                                    setHistorySavingId(null)
                                  }
                                }}
                              >
                                {historySavingId === entry.id ? "Saving…" : historyJustSavedId === entry.id ? "Saved" : "Save"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={historySavingId !== null}
                                onClick={async () => {
                                  if (!plant) return
                                  setHistorySavingId(entry.id)
                                  try {
                                    const res = await fetch(`/api/plants/${plant.id}/history`, {
                                      method: "DELETE",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ id: entry.id }),
                                    })
                                    if (!res.ok) {
                                      const data = await res.json().catch(() => ({}))
                                      throw new Error(data?.error || "Failed to remove history")
                                    }

                                    await Promise.all([
                                      mutate(`/api/plants/${plant.id}/history`),
                                      mutate("/api/plants"),
                                    ])
                                    setHistoryDrafts((p) => {
                                      const next = { ...p }
                                      delete next[entry.id]
                                      return next
                                    })
                                  } catch (error) {
                                    alert(error instanceof Error ? error.message : "Failed to remove history")
                                  } finally {
                                    setHistorySavingId(null)
                                  }
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : careHistoryArray.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                    <History className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No care history yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Start caring for {plant.name} to track your history
                  </p>
                </div>
              ) : (
                <div className="space-y-0 max-h-[400px] overflow-y-auto pr-2">
                  {careHistoryArray.map((entry, index) => (
                    <div 
                      key={entry.id} 
                      className="flex items-start gap-3 group hover:bg-muted/30 rounded-lg transition-colors pl-3"
                    >
                      {/* Timeline connector */}
                      <div className="flex flex-col items-center pt-3">
                        <div className={`p-2 rounded-full shadow-sm transition-all ${
                          entry.care_type === 'water' 
                            ? 'bg-[var(--water-blue)]/10 text-[var(--water-blue)] group-hover:bg-[var(--water-blue)]/20' 
                            : 'bg-[var(--fertilizer-amber)]/10 text-[var(--fertilizer-amber)] group-hover:bg-[var(--fertilizer-amber)]/20'
                        }`}>
                          {entry.care_type === 'water' ? (
                            <Droplets className="w-4 h-4" />
                          ) : (
                            <Leaf className="w-4 h-4" />
                          )}
                        </div>
                        {index < careHistoryArray.length - 1 && (
                          <div className="w-px flex-1 bg-border my-2" />
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0 py-3 pr-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div>
                            <p className="font-medium text-sm group-hover:text-primary transition-colors">
                              {entry.care_type === 'water' ? 'Watered' : 'Fertilized'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(entry.performed_at), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`text-xs whitespace-nowrap ${
                              entry.care_type === 'water'
                                ? 'border-[var(--water-blue)]/30 text-[var(--water-blue)]'
                                : 'border-[var(--fertilizer-amber)]/30 text-[var(--fertilizer-amber)]'
                            }`}
                          >
                            {formatDistanceToNow(new Date(entry.performed_at), { addSuffix: true })}
                          </Badge>
                        </div>
                        {entry.notes && (
                          <p className="text-sm text-muted-foreground mt-2 bg-muted/50 rounded p-2 italic">
                            "{entry.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plant Info */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-3">Plant Information</h3>
              <div className="space-y-2 text-sm">
                {plant.scientific_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Scientific Name</span>
                    <span className="font-medium italic">{plant.scientific_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Added</span>
                  <span className="font-medium">{format(new Date(plant.created_at), "MMM d, yyyy")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Research Sources (moved to end) */}
          {plant.sources && plant.sources.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-3">Research Sources</h3>
                <div className="space-y-2">
                  {plant.sources.map((source, idx) => (
                    <a
                      key={idx}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm group-hover:text-primary transition-colors">
                          {source.name}
                        </p>
                        {source.recommendation && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {source.recommendation}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 ml-2" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => onEdit(plant)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Plant
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>

          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Delete plant?</DialogTitle>
                <DialogDescription>
                  This permanently deletes {plant.name} and its care history.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    onDelete(plant.id)
                    setDeleteConfirmOpen(false)
                    onClose()
                  }}
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    )

  // Desktop modal
  const desktopModal = (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl sm:max-w-6xl max-h-[90vh] p-0 overflow-hidden border-0">
        {renderContent(true, false)}
      </DialogContent>
    </Dialog>
  )

  // Mobile drawer content
  const mobileDrawer = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full bg-background shadow-2xl z-[70] overflow-hidden transform transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {renderContent(false, true)}
      </div>
    </>
  )

  return isMobile ? mobileDrawer : desktopModal
}
