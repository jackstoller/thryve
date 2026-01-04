"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Droplets, Sun, Leaf, MapPin, ChevronLeft, ChevronRight } from "lucide-react"
import type { Plant } from "@/lib/types"
import { formatDistanceToNow, isPast, isToday, differenceInDays } from "date-fns"

interface PlantCardProps {
  plant: Plant
  onWater: (id: string) => Promise<void>
  onFertilize: (id: string) => Promise<void>
  onEdit: (plant: Plant) => void
  onDelete: (id: string) => void
  onClick: (plant: Plant) => void
}

export function PlantCard({ plant, onWater, onFertilize, onEdit, onDelete, onClick }: PlantCardProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  
  const needsWater =
    plant.next_water_date && (isPast(new Date(plant.next_water_date)) || isToday(new Date(plant.next_water_date)))
  const needsFertilizer =
    plant.next_fertilize_date &&
    (isPast(new Date(plant.next_fertilize_date)) || isToday(new Date(plant.next_fertilize_date)))

  const getSunlightIcon = (level: string | null) => {
    switch (level) {
      case "low":
        return "text-muted-foreground"
      case "medium":
        return "text-[var(--sun-yellow)]/70"
      case "bright":
        return "text-[var(--sun-yellow)]"
      case "direct":
        return "text-[var(--fertilizer-amber)]"
      default:
        return "text-muted-foreground"
    }
  }

  const getWaterProgress = () => {
    if (!plant.last_watered || !plant.next_water_date) return 0
    const lastWatered = new Date(plant.last_watered)
    const totalDays = plant.watering_frequency_days
    const daysPassed = differenceInDays(new Date(), lastWatered)
    const progress = Math.min((daysPassed / totalDays) * 100, 100)
    return Math.max(0, progress)
  }

  const waterProgress = getWaterProgress()
  
  // Get sorted photos or fallback to image_url
  const photos = plant.photos && plant.photos.length > 0 
    ? plant.photos.sort((a, b) => a.order - b.order).map(p => p.url)
    : plant.image_url ? [plant.image_url] : []
  
  const hasMultiplePhotos = photos.length > 1
  const currentPhoto = photos[currentPhotoIndex] || null

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1))
  }

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentPhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1))
  }

  return (
    <Card 
      className="overflow-hidden active:shadow-xl transition-all duration-200 group cursor-pointer touch-manipulation"
      onClick={() => onClick(plant)}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {currentPhoto ? (
          <img
            src={currentPhoto}
            alt={plant.name}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            className="object-cover w-full h-full group-active:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Leaf className="w-12 h-12 text-primary/30" />
          </div>
        )}

        {/* Carousel Navigation */}
        {hasMultiplePhotos && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handlePrevPhoto}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleNextPhoto}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            
            {/* Photo Counter */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-medium">
              {currentPhotoIndex + 1} / {photos.length}
            </div>
          </>
        )}

        {(needsWater || needsFertilizer) && (
          <div className="absolute top-2 left-2 flex gap-1.5">
            {needsWater && (
              <Badge className="bg-[var(--water-blue)] text-white border-0 text-xs px-1.5 py-0.5">
                <Droplets className="w-3 h-3 mr-1" />
                Water
              </Badge>
            )}
            {needsFertilizer && (
              <Badge className="bg-[var(--fertilizer-amber)] text-white border-0 text-xs px-1.5 py-0.5">
                <Leaf className="w-3 h-3 mr-1" />
                Feed
              </Badge>
            )}
          </div>
        )}

      </div>

      <CardContent className="p-2.5">
        <div className="flex items-start justify-between mb-1">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base leading-tight truncate">{plant.name}</h3>
            {plant.species && <p className="text-xs text-muted-foreground italic truncate">{plant.species}</p>}
          </div>
          <Sun className={`w-4 h-4 flex-shrink-0 ml-2 ${getSunlightIcon(plant.sunlight_level)}`} />
        </div>

        {plant.location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{plant.location}</span>
          </div>
        )}

        {/* Water Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-muted-foreground">Next watering</span>
            <span className="text-[10px] font-medium">
              {plant.next_water_date && (
                isPast(new Date(plant.next_water_date)) && !isToday(new Date(plant.next_water_date))
                  ? "Overdue!"
                  : isToday(new Date(plant.next_water_date))
                    ? "Today"
                    : formatDistanceToNow(new Date(plant.next_water_date), { addSuffix: true })
              )}
            </span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                waterProgress >= 100 ? "bg-[var(--water-blue)]" : "bg-[var(--water-blue)]/60"
              }`}
              style={{ width: `${waterProgress}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
