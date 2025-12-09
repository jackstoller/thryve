"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Droplets, Leaf } from "lucide-react"
import type { Plant } from "@/lib/types"
import { format, isToday, isTomorrow, isPast, addDays, startOfDay } from "date-fns"

interface ScheduleViewProps {
  plants: Plant[]
  onWater: (id: string) => void
  onFertilize: (id: string) => void
}

interface ScheduleItem {
  plant: Plant
  type: "water" | "fertilize"
  date: Date
}

export function ScheduleView({ plants, onWater, onFertilize }: ScheduleViewProps) {
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

  const getDateBadgeVariant = (dateStr: string) => {
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
            <div className="flex items-center gap-2">
              <Badge variant={getDateBadgeVariant(dateStr)}>{getDateLabel(dateStr)}</Badge>
              <span className="text-sm text-muted-foreground">
                {items.length} {items.length === 1 ? "task" : "tasks"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, idx) => (
              <button
                key={`${item.plant.id}-${item.type}-${idx}`}
                onClick={() => (item.type === "water" ? onWater(item.plant.id) : onFertilize(item.plant.id))}
                className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div
                  className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${item.type === "water" ? "bg-[var(--water-blue)]/10" : "bg-[var(--fertilizer-amber)]/10"}
                `}
                >
                  {item.type === "water" ? (
                    <Droplets className="w-5 h-5 text-[var(--water-blue)]" />
                  ) : (
                    <Leaf className="w-5 h-5 text-[var(--fertilizer-amber)]" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{item.plant.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.type === "water" ? "Needs watering" : "Needs fertilizing"}
                  </p>
                </div>
                {item.plant.image_url && (
                  <div className="w-10 h-10 rounded-full overflow-hidden">
                    <img
                      src={item.plant.image_url || "/placeholder.svg"}
                      alt={item.plant.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
