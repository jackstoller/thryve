"use client"

import { Button } from "@/components/ui/button"
import { Leaf, Bell } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { UserMenu } from "@/components/user-menu"

interface HeaderProps {
  view: "grid" | "schedule"
  onViewChange: (view: "grid" | "schedule") => void
  urgentCount: number
}

export function Header({ view, onViewChange, urgentCount }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b safe-top">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => onViewChange("grid")}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity active:scale-95"
          >
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <Leaf className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="text-start">
              <h1 className="text-lg font-bold tracking-tight">Thryve</h1>
              <p className="text-[10px] text-muted-foreground leading-none">Smart Plant Care</p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <UserMenu />

            {urgentCount > 0 && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative h-9 w-9 active:scale-95"
                onClick={() => onViewChange("schedule")}
              >
                <Bell className="w-5 h-5" />
                <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] border-2 border-background">
                  {urgentCount}
                </Badge>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
