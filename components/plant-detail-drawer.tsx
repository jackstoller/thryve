"use client"

import { useState, useEffect } from "react"
import useSWR, { mutate } from "swr"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import type { Plant, CareHistoryItem } from "@/lib/types"
import { format, formatDistanceToNow, isPast, isToday, differenceInDays } from "date-fns"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  return res.json()
}

interface PlantDetailDrawerProps {
  plant: Plant | null
  open: boolean
  onClose: () => void
  onWater: (id: string) => void
  onFertilize: (id: string) => void
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

  const { data: careHistory } = useSWR<CareHistoryItem[]>(
    plant ? `/api/plants/${plant.id}/history` : null,
    fetcher
  )

  const careHistoryArray = Array.isArray(careHistory) ? careHistory : []

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
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
  
  // Get sorted photos or fallback
  const photos = plant.photos && plant.photos.length > 0 
    ? plant.photos.sort((a, b) => a.order - b.order)
    : plant.image_url ? [{ id: 'fallback', url: plant.image_url, order: 0 }] : []
  
  const hasMultiplePhotos = photos.length > 1

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1))
  }

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentPhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1))
  }

  const handleDotClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    setCurrentPhotoIndex(index)
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
  const renderContent = (useDialogTitle: boolean = false) => (
    <div className="overflow-y-auto max-h-[90vh] rounded-lg">
      {/* Photo Gallery with Carousel */}
      {photos.length > 0 ? (
        <div className="relative h-64 bg-muted group">
          <img 
            src={photos[currentPhotoIndex].url} 
            alt={`${plant.name} ${currentPhotoIndex + 1}`} 
            className="w-full h-full object-cover transition-opacity duration-300" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Carousel Navigation */}
          {hasMultiplePhotos && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background h-10 w-10 z-20"
                onClick={handlePrevPhoto}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background h-10 w-10 z-20"
                onClick={handleNextPhoto}
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
              
              {/* Photo Dots Indicator */}
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

              {/* Photo Counter */}
              <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium z-20">
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
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white z-10">
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
      <div className="p-6 space-y-6">
          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              className={`flex-1 ${
                needsWater
                  ? "bg-[var(--water-blue)] hover:bg-[var(--water-blue)]/90"
                  : "bg-[var(--water-blue)]/20 text-[var(--water-blue)] hover:bg-[var(--water-blue)]/30"
              }`}
              onClick={async () => {
                await onWater(plant.id)
                mutate(`/api/plants/${plant.id}/history`)
              }}
            >
              <Droplets className="w-4 h-4 mr-2" />
              {needsWater ? "Water Now" : "Mark Watered"}
            </Button>
            <Button
              className={`flex-1 ${
                needsFertilizer
                  ? "bg-[var(--fertilizer-amber)] hover:bg-[var(--fertilizer-amber)]/90"
                  : "bg-[var(--fertilizer-amber)]/20 text-[var(--fertilizer-amber)] hover:bg-[var(--fertilizer-amber)]/30"
              }`}
              onClick={async () => {
                await onFertilize(plant.id)
                mutate(`/api/plants/${plant.id}/history`)
              }}
            >
              <Leaf className="w-4 h-4 mr-2" />
              {needsFertilizer ? "Feed Now" : "Mark Fed"}
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

          {/* Research Sources */}
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

          {/* Care History */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-lg">Care History</h3>
                </div>
                {careHistoryArray.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {careHistoryArray.length} {careHistoryArray.length === 1 ? 'entry' : 'entries'}
                  </Badge>
                )}
              </div>
              
              {careHistoryArray.length === 0 ? (
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

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => onEdit(plant)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Plant
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => {
                if (confirm(`Are you sure you want to delete ${plant.name}?`)) {
                  onDelete(plant.id)
                  onClose()
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    )

  // Desktop modal
  const desktopModal = (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl sm:max-w-6xl max-h-[90vh] p-0 overflow-hidden border-0">
        {renderContent(true)}
      </DialogContent>
    </Dialog>
  )

  // Mobile drawer content
  const mobileDrawer = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full bg-background shadow-2xl z-50 overflow-y-auto transform transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {renderContent(false)}
      </div>
    </>
  )

  return isMobile ? mobileDrawer : desktopModal
}
