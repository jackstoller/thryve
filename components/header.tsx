"use client"

import { Button } from "@/components/ui/button"
import { Leaf, Plus, Calendar, Grid3X3, Bell } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface HeaderProps {
  view: "grid" | "schedule"
  onViewChange: (view: "grid" | "schedule") => void
  onAddPlant: () => void
  importCount: number
  urgentCount: number
}

export function Header({ view, onViewChange, onAddPlant, importCount, urgentCount }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Leaf className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Plantwise</h1>
              <p className="text-xs text-muted-foreground">Smart Plant Care</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {urgentCount > 0 && (
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-destructive text-destructive-foreground">
                  {urgentCount}
                </Badge>
              </Button>
            )}

            <div className="flex bg-muted rounded-lg p-1">
              <Button variant={view === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => onViewChange("grid")}>
                <Grid3X3 className="w-4 h-4 mr-1" />
                Plants
              </Button>
              <Button
                variant={view === "schedule" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onViewChange("schedule")}
              >
                <Calendar className="w-4 h-4 mr-1" />
                Schedule
              </Button>
            </div>

            <Button onClick={onAddPlant} className="relative">
              <Plus className="w-4 h-4 mr-2" />
              Add Plant
              {importCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-[var(--success-green)] text-white">
                  {importCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
