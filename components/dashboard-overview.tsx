"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Droplets, Leaf, AlertCircle, TrendingUp, ArrowRight, Calendar } from "lucide-react"
import type { Plant } from "@/lib/types"
import { isPast, isToday, isTomorrow, addDays, startOfDay, format } from "date-fns"

interface DashboardOverviewProps {
  plants: Plant[]
  onPlantClick: (plant: Plant) => void
  onViewSchedule: () => void
}

export function DashboardOverview({ plants, onPlantClick, onViewSchedule }: DashboardOverviewProps) {
  const today = startOfDay(new Date())
  const tomorrow = addDays(today, 1)
  const nextWeek = addDays(today, 7)
  const next3Days = addDays(today, 3)

  // Calculate stats
  const needsWaterToday = plants.filter(
    (p) => p.next_water_date && (isPast(new Date(p.next_water_date)) || isToday(new Date(p.next_water_date)))
  )
  const needsFertilizerToday = plants.filter(
    (p) =>
      p.next_fertilize_date && (isPast(new Date(p.next_fertilize_date)) || isToday(new Date(p.next_fertilize_date)))
  )
  const needsWaterTomorrow = plants.filter((p) => p.next_water_date && isTomorrow(new Date(p.next_water_date)))
  const needsWaterThisWeek = plants.filter(
    (p) =>
      p.next_water_date &&
      new Date(p.next_water_date) > tomorrow &&
      new Date(p.next_water_date) <= nextWeek
  )

  // Get upcoming plants for next 3 days (for the fan-out visualization)
  const upcomingPlants = plants
    .filter((p) => {
      const nextDate = p.next_water_date ? new Date(p.next_water_date) : null
      return nextDate && nextDate > today && nextDate <= next3Days
    })
    .sort((a, b) => {
      const dateA = new Date(a.next_water_date!)
      const dateB = new Date(b.next_water_date!)
      return dateA.getTime() - dateB.getTime()
    })
    .slice(0, 5) // Show max 5 plants in fan-out

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Plants</p>
                <p className="text-3xl font-bold">{plants.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Leaf className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Needs Water Today</p>
                <p className="text-3xl font-bold text-[var(--water-blue)]">{needsWaterToday.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-[var(--water-blue)]/10 flex items-center justify-center">
                <Droplets className="w-6 h-6 text-[var(--water-blue)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Needs Fertilizer</p>
                <p className="text-3xl font-bold text-[var(--fertilizer-amber)]">{needsFertilizerToday.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-[var(--fertilizer-amber)]/10 flex items-center justify-center">
                <Leaf className="w-6 h-6 text-[var(--fertilizer-amber)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">This Week</p>
                <p className="text-3xl font-bold">{needsWaterThisWeek.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Tasks */}
      {(needsWaterToday.length > 0 || needsFertilizerToday.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-primary" />
              <CardTitle>Today's Tasks</CardTitle>
              <Badge>{needsWaterToday.length + needsFertilizerToday.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {needsWaterToday.map((plant) => (
              <button
                key={`water-${plant.id}`}
                onClick={() => onPlantClick(plant)}
                className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                {plant.image_url ? (
                  <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                    <img src={plant.image_url} alt={plant.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Leaf className="w-6 h-6 text-primary/30" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{plant.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-[var(--water-blue)] text-white border-0">
                      <Droplets className="w-3 h-3 mr-1" />
                      Water
                    </Badge>
                    {plant.next_fertilize_date &&
                      (isPast(new Date(plant.next_fertilize_date)) || isToday(new Date(plant.next_fertilize_date))) && (
                        <Badge className="bg-[var(--fertilizer-amber)] text-white border-0">
                          <Leaf className="w-3 h-3 mr-1" />
                          Feed
                        </Badge>
                      )}
                  </div>
                </div>
              </button>
            ))}
            {needsFertilizerToday
              .filter((p) => !needsWaterToday.includes(p))
              .map((plant) => (
                <button
                  key={`fertilize-${plant.id}`}
                  onClick={() => onPlantClick(plant)}
                  className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  {plant.image_url ? (
                    <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                      <img src={plant.image_url} alt={plant.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Leaf className="w-6 h-6 text-primary/30" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{plant.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-[var(--fertilizer-amber)] text-white border-0">
                        <Leaf className="w-3 h-3 mr-1" />
                        Feed
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Actions Fan-out */}
      {upcomingPlants.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <CardTitle>Coming Up Next 3 Days</CardTitle>
                <Badge variant="secondary">{upcomingPlants.length}</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={onViewSchedule}>
                View Calendar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-2 py-8">
              {upcomingPlants.map((plant, index) => {
                const totalPlants = upcomingPlants.length
                const centerIndex = Math.floor(totalPlants / 2)
                const offset = index - centerIndex
                const rotation = offset * 8 // 8 degrees per plant
                const translateX = offset * 15 // 15px spacing
                
                return (
                  <button
                    key={plant.id}
                    onClick={() => {
                      onPlantClick(plant)
                    }}
                    className="relative transition-all duration-300 hover:scale-110 hover:z-10 group"
                    style={{
                      transform: `rotate(${rotation}deg) translateX(${translateX}px)`,
                      zIndex: totalPlants - Math.abs(offset),
                    }}
                  >
                    <div className="w-32 h-40 rounded-2xl overflow-hidden shadow-lg border-4 border-background">
                      {plant.image_url ? (
                        <img
                          src={plant.image_url}
                          alt={plant.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Leaf className="w-12 h-12 text-primary/30" />
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Badge className="whitespace-nowrap bg-background border shadow-md">
                        {plant.name}
                      </Badge>
                    </div>
                    <div className="absolute top-2 right-2">
                      <div className="w-8 h-8 rounded-full bg-[var(--water-blue)] flex items-center justify-center shadow-lg">
                        <Droplets className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="text-center mt-8">
              <Button onClick={onViewSchedule} size="lg" variant="outline">
                <Calendar className="w-5 h-5 mr-2" />
                View Full Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tomorrow's Tasks */}
      {needsWaterTomorrow.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Tomorrow</CardTitle>
              <Badge variant="secondary">{needsWaterTomorrow.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {needsWaterTomorrow.map((plant) => (
              <button
                key={plant.id}
                onClick={() => onPlantClick(plant)}
                className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                {plant.image_url ? (
                  <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                    <img src={plant.image_url} alt={plant.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Leaf className="w-6 h-6 text-primary/30" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{plant.name}</p>
                  <p className="text-sm text-muted-foreground">Needs watering</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
