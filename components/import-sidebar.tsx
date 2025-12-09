"use client"

import { Button } from "@/components/ui/button"
import { X, Leaf } from "lucide-react"
import { ImportSessionCard } from "./import-session-card"
import type { ImportSession } from "@/lib/types"

interface ImportSidebarProps {
  sessions: ImportSession[]
  open: boolean
  onClose: () => void
  onConfirm: (session: ImportSession) => void
  onCancel: (id: string) => void
  onCorrect?: (session: ImportSession) => void
  expandedId: string | null
  onToggleExpand: (id: string) => void
}

export function ImportSidebar({
  sessions,
  open,
  onClose,
  onConfirm,
  onCancel,
  onCorrect,
  expandedId,
  onToggleExpand,
}: ImportSidebarProps) {
  if (!open) return null

  const activeSessions = sessions.filter((s) => s.status !== "completed")

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-card border-l shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Importing Plants</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/30 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
        {activeSessions.length === 0 ? (
          <div className="text-center py-12">
            <Leaf className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No plants being imported</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeSessions.map((session) => (
              <ImportSessionCard
                key={session.id}
                session={session}
                onConfirm={onConfirm}
                onCancel={onCancel}
                onCorrect={onCorrect}
                isExpanded={expandedId === session.id}
                onToggleExpand={() => onToggleExpand(session.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
