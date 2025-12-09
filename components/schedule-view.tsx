"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Droplets, Leaf } from "lucide-react"
import type { Plant } from "@/lib/types"
import { format, isToday, isTomorrow, isPast, addDays, startOfDay } from "date-fns"

interface ScheduleViewProps {
  plants: Plant[]
  onWater: (id: string) => void
  onFertilize: (id: string) => void
  onPlantClick: (plant: Plant) => void
}

interface ScheduleItem {
  plant: Plant
  type: "water" | "fertilize"
  date: Date
}

export function ScheduleView({ plants, onWater, onFertilize, onPlantClick }: ScheduleViewProps) {
  const scheduleItems: ScheduleItem[] = []

  plants.forEach((plant) => {
    if (plant.next_water_date) {
      scheduleItems.push({
        plant,
        type: "water",
        date: new Date(plant.next_water_date),
      })
    }
    if (plant.next_fertilize_date) {
      scheduleItems.push({
        plant,
        type: "fertilize",
        date: new Date(plant.next_fertilize_date),
      })
    }
  })

  // Sort by date
  scheduleItems.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Group by date
  const groupedSchedule: Record<string, ScheduleItem[]> = {}
  const today = startOfDay(new Date())
  const nextWeek = addDays(today, 7)

  scheduleItems
    .filter((item) => item.date <= nextWeek)
    .forEach((item) => {
      const dateKey = format(item.date, "yyyy-MM-dd")
      if (!groupedSchedule[dateKey]) {
        groupedSchedule[dateKey] = []
      }
      groupedSchedule[dateKey].push(item)
    })

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr)
    if (isPast(date) && !isToday(date)) return "Overdue"
    if (isToday(date)) return "Today"
    if (isTomorrow(date)) return "Tomorrow"
    return format(date, "EEEE, MMM d")
  }

  const getDateBadgeVariant = (dateStr: string): "destructive" | "default" | "secondary" => {
    const date = new Date(dateStr)
    if (isPast(date) && !isToday(date)) return "destructive"
    if (isToday(date)) return "default"
    return "secondary"
  }

  if (Object.keys(groupedSchedule).length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No upcoming care tasks this week</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedSchedule).map(([dateStr, items]) => (
        <Card key={dateStr}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant={getDateBadgeVariant(dateStr)} className="text-sm px-3 py-1">
                  {getDateLabel(dateStr)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {items.length} {items.length === 1 ? "task" : "tasks"}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">{format(new Date(dateStr), "MMM d, yyyy")}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={`${item.plant.id}-${item.type}-${idx}`}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <button
                  onClick={() => onPlantClick(item.plant)}
                  className="flex items-center gap-4 flex-1 min-w-0 text-left"
                >
                  <div
                    className={`
                    w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                    ${item.type === "water" ? "bg-[var(--water-blue)]/10" : "bg-[var(--fertilizer-amber)]/10"}
                  `}
                  >
                    {item.type === "water" ? (
                      <Droplets className="w-5 h-5 text-[var(--water-blue)]" />
                    ) : (
                      <Leaf className="w-5 h-5 text-[var(--fertilizer-amber)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.plant.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.type === "water" ? "Needs watering" : "Needs fertilizing"}
                      {item.plant.location && ` • ${item.plant.location}`}
                    </p>
                  </div>
                  {item.plant.image_url && (
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                      <img
                        src={item.plant.image_url}
                        alt={item.plant.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </button>
                <Button
                  size="sm"
                  className={
                    item.type === "water"
                      ? "bg-[var(--water-blue)] hover:bg-[var(--water-blue)]/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      : "bg-[var(--fertilizer-amber)] hover:bg-[var(--fertilizer-amber)]/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  }
                  onClick={() => (item.type === "water" ? onWater(item.plant.id) : onFertilize(item.plant.id))}
                >
                  {item.type === "water" ? (
                    <>
                      <Droplets className="w-4 h-4 mr-1" />
                      Water
                    </>
                  ) : (
                    <>
                      <Leaf className="w-4 h-4 mr-1" />
                      Feed
                    </>
                  )}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
