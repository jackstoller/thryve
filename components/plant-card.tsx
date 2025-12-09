"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Droplets, Sun, Leaf, MapPin, MoreHorizontal } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Plant } from "@/lib/types"
import { formatDistanceToNow, isPast, isToday, differenceInDays } from "date-fns"

interface PlantCardProps {
  plant: Plant
  onWater: (id: string) => void
  onFertilize: (id: string) => void
  onEdit: (plant: Plant) => void
  onDelete: (id: string) => void
  onClick: (plant: Plant) => void
}

export function PlantCard({ plant, onWater, onFertilize, onEdit, onDelete, onClick }: PlantCardProps) {
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

  const getWaterStatus = () => {
    if (!plant.next_water_date) return { text: "Not scheduled", urgent: false }
    const date = new Date(plant.next_water_date)
    if (isPast(date) && !isToday(date)) return { text: "Overdue!", urgent: true }
    if (isToday(date)) return { text: "Water today", urgent: true }
    return { text: `In ${formatDistanceToNow(date)}`, urgent: false }
  }

  const getWaterProgress = () => {
    if (!plant.last_watered || !plant.next_water_date) return 0
    const lastWatered = new Date(plant.last_watered)
    const totalDays = plant.watering_frequency_days
    const daysPassed = differenceInDays(new Date(), lastWatered)
    const progress = Math.min((daysPassed / totalDays) * 100, 100)
    return Math.max(0, progress)
  }

  const waterStatus = getWaterStatus()
  const waterProgress = getWaterProgress()

  return (
    <Card 
      className="overflow-hidden hover:shadow-lg transition-shadow duration-300 group cursor-pointer"
      onClick={() => onClick(plant)}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {plant.image_url ? (
          <img
            src={plant.image_url || "/placeholder.svg"}
            alt={plant.name}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Leaf className="w-16 h-16 text-primary/30" />
          </div>
        )}

        {(needsWater || needsFertilizer) && (
          <div className="absolute top-3 left-3 flex gap-2">
            {needsWater && (
              <Badge className="bg-[var(--water-blue)] text-white border-0">
                <Droplets className="w-3 h-3 mr-1" />
                Water
              </Badge>
            )}
            {needsFertilizer && (
              <Badge className="bg-[var(--fertilizer-amber)] text-white border-0">
                <Leaf className="w-3 h-3 mr-1" />
                Feed
              </Badge>
            )}
          </div>
        )}

        {/* Progress Ring */}
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative w-12 h-12">
            <svg className="transform -rotate-90 w-12 h-12">
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-white/20"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - waterProgress / 100)}`}
                className="text-[var(--water-blue)] transition-all duration-500"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Droplets className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 bg-card/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(plant); }}>
              Edit plant
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete(plant.id); }} 
              className="text-destructive"
            >
              Delete plant
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight truncate">{plant.name}</h3>
            {plant.species && <p className="text-sm text-muted-foreground italic truncate">{plant.species}</p>}
          </div>
          <Sun className={`w-5 h-5 flex-shrink-0 ml-2 ${getSunlightIcon(plant.sunlight_level)}`} />
        </div>

        {plant.location && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{plant.location}</span>
          </div>
        )}

        {/* Water Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Next watering</span>
            <span className="text-xs font-medium">
              {plant.next_water_date && (
                isPast(new Date(plant.next_water_date)) && !isToday(new Date(plant.next_water_date))
                  ? "Overdue!"
                  : isToday(new Date(plant.next_water_date))
                    ? "Today"
                    : formatDistanceToNow(new Date(plant.next_water_date), { addSuffix: true })
              )}
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                waterProgress >= 100 ? "bg-[var(--water-blue)]" : "bg-[var(--water-blue)]/60"
              }`}
              style={{ width: `${waterProgress}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          {needsWater ? (
            <Button
              size="sm"
              className="bg-[var(--water-blue)] hover:bg-[var(--water-blue)]/90 text-white flex-1"
              onClick={(e) => {
                e.stopPropagation()
                onWater(plant.id)
              }}
            >
              <Droplets className="w-4 h-4 mr-1" />
              Water Now
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
              disabled
            >
              <Droplets className="w-4 h-4 mr-1" />
              {waterStatus.text}
            </Button>
          )}
          
          <Button
            size="sm"
            variant={needsFertilizer ? "default" : "ghost"}
            className={
              needsFertilizer 
                ? "bg-[var(--fertilizer-amber)] hover:bg-[var(--fertilizer-amber)]/90 text-white" 
                : "text-muted-foreground"
            }
            onClick={(e) => {
              e.stopPropagation()
              onFertilize(plant.id)
            }}
            title={needsFertilizer ? "Feed Now" : "Not due yet"}
          >
            <Leaf className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
