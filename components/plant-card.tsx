"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Droplets, Sun, Leaf, MapPin, MoreHorizontal } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Plant } from "@/lib/types"
import { formatDistanceToNow, isPast, isToday } from "date-fns"

interface PlantCardProps {
  plant: Plant
  onWater: (id: string) => void
  onFertilize: (id: string) => void
  onEdit: (plant: Plant) => void
  onDelete: (id: string) => void
}

export function PlantCard({ plant, onWater, onFertilize, onEdit, onDelete }: PlantCardProps) {
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

  const waterStatus = getWaterStatus()

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 group">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 bg-card/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(plant)}>Edit plant</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(plant.id)} className="text-destructive">
              Delete plant
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-lg leading-tight">{plant.name}</h3>
            {plant.species && <p className="text-sm text-muted-foreground italic">{plant.species}</p>}
          </div>
          <Sun className={`w-5 h-5 ${getSunlightIcon(plant.sunlight_level)}`} />
        </div>

        {plant.location && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
            <MapPin className="w-3 h-3" />
            {plant.location}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            variant={needsWater ? "default" : "outline"}
            className={
              needsWater ? "bg-[var(--water-blue)] hover:bg-[var(--water-blue)]/90 text-white flex-1" : "flex-1"
            }
            onClick={() => onWater(plant.id)}
          >
            <Droplets className="w-4 h-4 mr-1" />
            {waterStatus.text}
          </Button>
          <Button
            size="sm"
            variant={needsFertilizer ? "default" : "outline"}
            className={
              needsFertilizer ? "bg-[var(--fertilizer-amber)] hover:bg-[var(--fertilizer-amber)]/90 text-white" : ""
            }
            onClick={() => onFertilize(plant.id)}
          >
            <Leaf className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
