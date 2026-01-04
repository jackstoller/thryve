"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Droplets, Leaf, Calendar, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import type { Plant } from "@/lib/types"
import { format, isToday, isTomorrow, isPast, addDays, startOfDay } from "date-fns"

interface ScheduleViewProps {
  plants: Plant[]
  onWater: (id: string) => Promise<void>
  onFertilize: (id: string) => Promise<void>
  onPlantClick: (plant: Plant) => void
}

interface ScheduleItem {
  plant: Plant
  type: "water" | "fertilize"
  date: Date
}

export function ScheduleView({ plants, onWater, onFertilize, onPlantClick }: ScheduleViewProps) {
  const [loadingAction, setLoadingAction] = useState<{ plantId: string; type: "water" | "fertilize" } | null>(null)
  const [daysToShow, setDaysToShow] = useState(7)
  const today = startOfDay(new Date())
  const futureDate = addDays(today, daysToShow)

  const scheduleItems: ScheduleItem[] = []

  const parseDate = (value: string | null): Date | null => {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const getInitialDueDate = (plant: Plant, type: "water" | "fertilize"): Date | null => {
    if (type === "water") {
      return parseDate(plant.next_water_date) ?? parseDate(plant.last_watered)
    }
    return parseDate(plant.next_fertilize_date) ?? parseDate(plant.last_fertilized)
  }

  const getFrequencyDays = (plant: Plant, type: "water" | "fertilize"): number => {
    return type === "water" ? plant.watering_frequency_days : plant.fertilizing_frequency_days
  }

  plants.forEach((plant) => {
    ;(["water", "fertilize"] as const).forEach((type) => {
      const frequencyDays = getFrequencyDays(plant, type)
      if (!Number.isFinite(frequencyDays) || frequencyDays <= 0) return

      const initial = getInitialDueDate(plant, type)
      if (!initial) return

      const initialDueDate = startOfDay(initial)

      // If the initial due date is already overdue, show only that single overdue task.
      // (We intentionally do not generate a chain of future tasks until the overdue one is completed.)
      if (initialDueDate < today) {
        scheduleItems.push({ plant, type, date: initialDueDate })
        return
      }

      let occurrence = initialDueDate
      while (occurrence <= futureDate) {
        scheduleItems.push({ plant, type, date: occurrence })
        occurrence = addDays(occurrence, frequencyDays)
      }
    })
  })

  // Sort by date
  scheduleItems.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Group by date
  const groupedSchedule: Record<string, ScheduleItem[]> = {}

  scheduleItems.forEach((item) => {
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

  const getDayOfMonth = (dateStr: string) => {
    return format(new Date(dateStr), "d")
  }

  const getMonth = (dateStr: string) => {
    return format(new Date(dateStr), "MMM")
  }

  if (Object.keys(groupedSchedule).length === 0) {
    return (
      <div className="space-y-4 pb-4">
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1 text-primary">All caught up!</h3>
                <p className="text-muted-foreground text-sm">No care tasks scheduled for the next {daysToShow} days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Load More Button */}
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="default"
            onClick={() => setDaysToShow(daysToShow + 7)}
            className="group active:border-primary/50 active:bg-primary/5 transition-all duration-200 active:scale-95"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Show more
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      {Object.entries(groupedSchedule).map(([dateStr, items]) => {
        const isOverdue = isPast(new Date(dateStr)) && !isToday(new Date(dateStr))
        const isTodayDate = isToday(new Date(dateStr))
        
        return (
          <div key={dateStr} className="relative">
            <Card className={`
              overflow-hidden transition-all duration-200 active:shadow-xl
              ${isOverdue ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10' : ''}
              ${isTodayDate ? 'border-primary/50 bg-primary/5' : ''}
            `}>
              <CardHeader className="pb-3 pt-4 px-4">
                <div className="flex items-start gap-3">
                  {/* Date Badge */}
                  <div className={`
                    flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center
                    transition-all duration-200 shadow-sm
                    ${isOverdue 
                      ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' 
                      : isTodayDate 
                        ? 'bg-gradient-to-br from-primary to-primary/80 text-white'
                        : 'bg-gradient-to-br from-muted to-muted/60 border border-border'
                    }
                  `}>
                    {isOverdue && <AlertCircle className="w-4 h-4 mb-0.5 opacity-90" />}
                    {!isOverdue && <Calendar className="w-3 h-3 mb-0.5 opacity-70" />}
                    <div className={`text-2xl font-bold leading-none ${!isOverdue && !isTodayDate ? 'text-foreground' : ''}`}>
                      {getDayOfMonth(dateStr)}
                    </div>
                    <div className={`text-[10px] font-medium uppercase tracking-wide mt-0.5 ${!isOverdue && !isTodayDate ? 'text-muted-foreground' : 'opacity-90'}`}>
                      {getMonth(dateStr)}
                    </div>
                  </div>

                  {/* Header Info */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge 
                        variant={getDateBadgeVariant(dateStr)} 
                        className="text-xs px-2 py-0.5 font-semibold"
                      >
                        {getDateLabel(dateStr)}
                      </Badge>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                        <span className="font-medium">
                          {items.length} {items.length === 1 ? "task" : "tasks"}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {format(new Date(dateStr), "EEEE, MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-2 pt-0 px-4 pb-4">
                {items.map((item, idx) => (
                  <div
                    key={`${item.plant.id}-${item.type}-${idx}`}
                    className={`
                      relative group rounded-lg border transition-all duration-200
                      active:shadow-md active:scale-[0.98]
                      ${item.type === "water" 
                        ? 'bg-blue-50/50 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-900/30' 
                        : 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/30'
                      }
                    `}
                  >
                    <button
                      onClick={() => onPlantClick(item.plant)}
                      className="flex items-center gap-3 p-3 w-full text-left active:opacity-70"
                    >
                      {/* Plant Image or Icon */}
                      {item.plant.image_url ? (
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 ring-2 ring-white dark:ring-gray-800 shadow-sm">
                          <img
                            src={item.plant.image_url}
                            alt={item.plant.name}
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          className={`
                            w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm
                            ${item.type === "water" 
                              ? "bg-gradient-to-br from-blue-400 to-blue-600" 
                              : "bg-gradient-to-br from-amber-400 to-amber-600"
                            }
                          `}
                        >
                          {item.type === "water" ? (
                            <Droplets className="w-5 h-5 text-white" />
                          ) : (
                            <Leaf className="w-5 h-5 text-white" />
                          )}
                        </div>
                      )}

                      {/* Plant Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate text-foreground">
                          {item.plant.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] px-1.5 py-0 h-4 ${
                              item.type === "water"
                                ? "border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                                : "border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {item.type === "water" ? "💧 Water" : "🌱 Fertilize"}
                          </Badge>
                          {item.plant.location && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              📍 {item.plant.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Action Button */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Button
                        size="sm"
                        disabled={loadingAction !== null}
                        className={`
                          shadow-sm transition-all duration-200 active:scale-95 h-8 text-xs px-2
                          ${item.type === "water"
                            ? "bg-gradient-to-r from-blue-500 to-blue-600 active:from-blue-600 active:to-blue-700 text-white"
                            : "bg-gradient-to-r from-amber-500 to-amber-600 active:from-amber-600 active:to-amber-700 text-white"
                          }
                        `}
                        onClick={async (e) => {
                          e.stopPropagation()
                          setLoadingAction({ plantId: item.plant.id, type: item.type })
                          try {
                            if (item.type === "water") {
                              await onWater(item.plant.id)
                            } else {
                              await onFertilize(item.plant.id)
                            }
                          } finally {
                            setLoadingAction(null)
                          }
                        }}
                      >
                        {loadingAction?.plantId === item.plant.id && loadingAction?.type === item.type ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : item.type === "water" ? (
                          <Droplets className="w-3 h-3" />
                        ) : (
                          <Leaf className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )
      })}

      {/* Load More Button */}
      <div className="flex justify-center pt-2">
        <Button
          variant="outline"
          size="default"
          onClick={() => setDaysToShow(daysToShow + 7)}
          className="group active:border-primary/50 active:bg-primary/5 transition-all duration-200 active:scale-95"
        >
          <Calendar className="w-4 h-4 mr-2" />
          Show more
        </Button>
      </div>
    </div>
  )
}
