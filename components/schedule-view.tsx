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
  const [loadingAction, setLoadingAction] = useState<{ plantId: string; type: "water" | "fertilize" } | null>(null)
  const [daysToShow, setDaysToShow] = useState(7)
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
  const futureDate = addDays(today, daysToShow)

  scheduleItems
    .filter((item) => item.date <= futureDate)
    .forEach((item) => {
      const dateKey = format(item.date, "yyyy-MM-dd")
      if (!groupedSchedule[dateKey]) {
        groupedSchedule[dateKey] = []
      }
      groupedSchedule[dateKey].push(item)
    })

  // Check if there are more items beyond the current view
  const hasMoreItems = scheduleItems.some((item) => item.date > futureDate)

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
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">All caught up!</h3>
              <p className="text-muted-foreground text-sm">No care tasks scheduled for the next 7 days</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedSchedule).map(([dateStr, items]) => {
        const isOverdue = isPast(new Date(dateStr)) && !isToday(new Date(dateStr))
        const isTodayDate = isToday(new Date(dateStr))
        
        return (
          <div key={dateStr} className="relative">
            {/* Timeline connector */}
            <div className="absolute left-[52px] top-20 bottom-0 w-0.5 bg-gradient-to-b from-border to-transparent -z-10" />
            
            <Card className={`
              overflow-hidden transition-all duration-300 hover:shadow-lg
              ${isOverdue ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10' : ''}
              ${isTodayDate ? 'border-primary/50 bg-primary/5' : ''}
            `}>
              <CardHeader className="pb-4 pt-6">
                <div className="flex items-start gap-4">
                  {/* Date Badge */}
                  <div className={`
                    flex-shrink-0 w-[88px] h-[88px] rounded-2xl flex flex-col items-center justify-center
                    transition-all duration-300 shadow-sm
                    ${isOverdue 
                      ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' 
                      : isTodayDate 
                        ? 'bg-gradient-to-br from-primary to-primary/80 text-white'
                        : 'bg-gradient-to-br from-muted to-muted/60 border border-border'
                    }
                  `}>
                    {isOverdue && <AlertCircle className="w-5 h-5 mb-1 opacity-90" />}
                    {!isOverdue && <Calendar className="w-4 h-4 mb-1 opacity-70" />}
                    <div className={`text-3xl font-bold leading-none ${!isOverdue && !isTodayDate ? 'text-foreground' : ''}`}>
                      {getDayOfMonth(dateStr)}
                    </div>
                    <div className={`text-xs font-medium uppercase tracking-wide mt-1 ${!isOverdue && !isTodayDate ? 'text-muted-foreground' : 'opacity-90'}`}>
                      {getMonth(dateStr)}
                    </div>
                  </div>

                  {/* Header Info */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge 
                        variant={getDateBadgeVariant(dateStr)} 
                        className="text-sm px-3 py-1 font-semibold"
                      >
                        {getDateLabel(dateStr)}
                      </Badge>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                        <span className="font-medium">
                          {items.length} {items.length === 1 ? "task" : "tasks"}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {format(new Date(dateStr), "EEEE, MMMM d, yyyy")}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                {items.map((item, idx) => (
                  <div
                    key={`${item.plant.id}-${item.type}-${idx}`}
                    className={`
                      relative group rounded-xl border transition-all duration-300
                      hover:shadow-md hover:scale-[1.02] hover:border-primary/30
                      ${item.type === "water" 
                        ? 'bg-blue-50/50 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-900/30' 
                        : 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/30'
                      }
                    `}
                  >
                    <button
                      onClick={() => onPlantClick(item.plant)}
                      className="flex items-center gap-4 p-4 w-full text-left"
                    >
                      {/* Plant Image or Icon */}
                      {item.plant.image_url ? (
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-white dark:ring-gray-800 shadow-sm">
                          <img
                            src={item.plant.image_url}
                            alt={item.plant.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                        </div>
                      ) : (
                        <div
                          className={`
                            w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm
                            transition-all duration-300 group-hover:scale-110
                            ${item.type === "water" 
                              ? "bg-gradient-to-br from-blue-400 to-blue-600" 
                              : "bg-gradient-to-br from-amber-400 to-amber-600"
                            }
                          `}
                        >
                          {item.type === "water" ? (
                            <Droplets className="w-6 h-6 text-white" />
                          ) : (
                            <Leaf className="w-6 h-6 text-white" />
                          )}
                        </div>
                      )}

                      {/* Plant Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-base truncate text-foreground">
                          {item.plant.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              item.type === "water"
                                ? "border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                                : "border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {item.type === "water" ? "💧 Water" : "🌱 Fertilize"}
                          </Badge>
                          {item.plant.location && (
                            <span className="text-xs text-muted-foreground truncate">
                              📍 {item.plant.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Action Button */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <Button
                        size="sm"
                        disabled={loadingAction !== null}
                        className={`
                          shadow-md transition-all duration-300 hover:scale-105
                          ${item.type === "water"
                            ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                            : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
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
                          <>
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            {item.type === "water" ? "Watering..." : "Feeding..."}
                          </>
                        ) : item.type === "water" ? (
                          <>
                            <Droplets className="w-4 h-4 mr-1.5" />
                            Water Now
                          </>
                        ) : (
                          <>
                            <Leaf className="w-4 h-4 mr-1.5" />
                            Feed Now
                          </>
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
      {hasMoreItems && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setDaysToShow(daysToShow + 7)}
            className="group hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
          >
            <Calendar className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
            Show Next 7 Days
          </Button>
        </div>
      )}
    </div>
  )
}
