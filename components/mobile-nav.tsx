"use client"

import { Button } from "@/components/ui/button"
import { Grid3X3, Calendar, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface MobileNavProps {
  view: "grid" | "schedule"
  onViewChange: (view: "grid" | "schedule") => void
  onAddPlant: () => void
  urgentCount: number
}

export function MobileNav({ view, onViewChange, onAddPlant, urgentCount }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[80] bg-background/95 backdrop-blur-md border-t safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        <Button
          variant={view === "grid" ? "default" : "ghost"}
          className="flex-col h-14 flex-1 max-w-[120px] gap-1 active:scale-95"
          onClick={() => onViewChange("grid")}
        >
          <Grid3X3 className="w-5 h-5" />
          <span className="text-xs">Plants</span>
        </Button>

        <Button
          onClick={onAddPlant}
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg active:scale-95 -mt-6"
        >
          <Plus className="w-6 h-6" />
        </Button>

        <Button
          variant={view === "schedule" ? "default" : "ghost"}
          className="flex-col h-14 flex-1 max-w-[120px] gap-1 relative active:scale-95"
          onClick={() => onViewChange("schedule")}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-xs">Schedule</span>
          {urgentCount > 0 && (
            <Badge className="absolute top-1.5 right-6 h-4 w-4 p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] border-2 border-background">
              {urgentCount}
            </Badge>
          )}
        </Button>
      </div>
    </nav>
  )
}
