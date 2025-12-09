"use client"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  BookOpen,
  Scale,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ExternalLink,
  Droplets,
  Sun,
  Thermometer,
  Wind,
  Sparkles,
  X,
  Globe,
  FileText,
  Database,
} from "lucide-react"
import type { ImportSession, ResearchSource } from "@/lib/types"

interface ImportSessionCardProps {
  session: ImportSession
  onConfirm: (session: ImportSession) => void
  onCancel: (id: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
}

const researchSources = [
  { name: "Royal Horticultural Society", icon: Globe, status: "pending" as const },
  { name: "Missouri Botanical Garden", icon: Database, status: "pending" as const },
  { name: "USDA Plant Database", icon: FileText, status: "pending" as const },
  { name: "Houseplant Central", icon: BookOpen, status: "pending" as const },
]

// Timeline stages configuration
const stages = [
  {
    key: "identifying",
    label: "Identifying",
    icon: Search,
    description: "Analyzing plant features",
    details: "Using AI vision to identify species, leaf patterns, and distinguishing characteristics",
  },
  {
    key: "researching",
    label: "Researching",
    icon: BookOpen,
    description: "Finding care information",
    details: "Consulting botanical databases and horticultural resources",
  },
  {
    key: "comparing",
    label: "Comparing",
    icon: Scale,
    description: "Cross-referencing sources",
    details: "Verifying care requirements across multiple authoritative sources",
  },
  {
    key: "confirming",
    label: "Ready",
    icon: CheckCircle2,
    description: "Ready for review",
    details: "All information verified and ready for your approval",
  },
]

const statusOrder = ["uploading", "identifying", "researching", "comparing", "confirming", "completed"]

function getStageStatus(currentStatus: string, stageKey: string): "completed" | "current" | "pending" {
  const currentIndex = statusOrder.indexOf(currentStatus)
  const stageIndex = statusOrder.indexOf(stageKey)

  if (stageIndex < currentIndex || currentStatus === "completed") return "completed"
  if (stageIndex === currentIndex) return "current"
  return "pending"
}

function ResearchSourcesList({ foundSources }: { foundSources: ResearchSource[] }) {
  const foundNames = foundSources.map((s) => s.name.toLowerCase())

  return (
    <div className="mt-3 ml-11 space-y-2">
      <p className="text-xs text-muted-foreground font-medium mb-2">Querying sources:</p>
      {researchSources.map((source, index) => {
        const isFound = foundNames.some(
          (name) => source.name.toLowerCase().includes(name) || name.includes(source.name.toLowerCase()),
        )
        const matchedSource = foundSources[index]

        return (
          <div
            key={source.name}
            className="flex items-center gap-2 text-xs animate-in fade-in slide-in-from-left-2"
            style={{ animationDelay: `${index * 150}ms` }}
          >
            <div
              className={`
              w-5 h-5 rounded-full flex items-center justify-center
              ${matchedSource ? "bg-[var(--success-green)]/20 text-[var(--success-green)]" : "bg-muted text-muted-foreground"}
            `}
            >
              {matchedSource ? <CheckCircle2 className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
            </div>
            <source.icon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className={matchedSource ? "text-foreground" : "text-muted-foreground"}>
              {matchedSource ? matchedSource.name : source.name}
            </span>
            {matchedSource && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 bg-[var(--success-green)]/10 text-[var(--success-green)] border-[var(--success-green)]/30"
              >
                Found
              </Badge>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TimelineStage({
  stage,
  status,
  isLast,
  showDetails,
  currentStatus,
  foundSources,
}: {
  stage: (typeof stages)[0]
  status: "completed" | "current" | "pending"
  isLast: boolean
  showDetails: boolean
  currentStatus: string
  foundSources: ResearchSource[]
}) {
  const Icon = stage.icon
  const showResearchBreakdown =
    stage.key === "researching" && (status === "current" || (status === "completed" && currentStatus === "comparing"))

  return (
    <div className="flex gap-3">
      {/* Icon and connector line */}
      <div className="flex flex-col items-center">
        <div
          className={`
          w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500
          ${status === "completed" ? "bg-[var(--success-green)] text-white" : ""}
          ${status === "current" ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : ""}
          ${status === "pending" ? "bg-muted text-muted-foreground" : ""}
        `}
        >
          {status === "current" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : status === "completed" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Icon className="w-4 h-4" />
          )}
        </div>
        {!isLast && (
          <div
            className={`
            w-0.5 flex-1 min-h-[24px] transition-colors duration-500
            ${status === "completed" ? "bg-[var(--success-green)]" : "bg-border"}
            ${showResearchBreakdown ? "min-h-[140px]" : ""}
          `}
          />
        )}
      </div>

      {/* Content */}
      <div className={`pb-4 flex-1 ${isLast ? "pb-0" : ""}`}>
        <div className="flex items-center gap-2">
          <span
            className={`
            font-medium text-sm transition-colors
            ${status === "current" ? "text-primary" : ""}
            ${status === "completed" ? "text-[var(--success-green)]" : ""}
            ${status === "pending" ? "text-muted-foreground" : ""}
          `}
          >
            {stage.label}
          </span>
          {status === "current" && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 animate-pulse">
              In Progress
            </Badge>
          )}
        </div>
        {showDetails && (
          <p
            className={`
            text-xs mt-0.5 transition-colors
            ${status === "pending" ? "text-muted-foreground/60" : "text-muted-foreground"}
          `}
          >
            {status === "current" ? stage.details : stage.description}
          </p>
        )}

        {showResearchBreakdown && <ResearchSourcesList foundSources={foundSources} />}
      </div>
    </div>
  )
}

function SourceCard({ source, index }: { source: ResearchSource; index: number }) {
  return (
    <div
      className="bg-muted/50 rounded-lg p-3 border border-border/50 animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <ExternalLink className="w-3 h-3 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{source.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{source.recommendation}</p>
        </div>
      </div>
    </div>
  )
}

function CarePreview({
  careRequirements,
  isPartial,
}: {
  careRequirements: ImportSession["care_requirements"] | ImportSession["partial_data"]
  isPartial: boolean
}) {
  if (!careRequirements) return null

  const items = [
    {
      icon: Droplets,
      label: "Watering",
      value: careRequirements.watering_frequency_days ? `Every ${careRequirements.watering_frequency_days} days` : null,
      color: "text-blue-500",
    },
    {
      icon: Sun,
      label: "Light",
      value: careRequirements.sunlight_level,
      color: "text-yellow-500",
    },
    {
      icon: Wind,
      label: "Humidity",
      value: careRequirements.humidity_preference,
      color: "text-cyan-500",
    },
    {
      icon: Thermometer,
      label: "Temperature",
      value: careRequirements.temperature_range,
      color: "text-orange-500",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`
            bg-background rounded-lg p-3 border transition-all
            ${item.value ? "border-border" : "border-dashed border-border/50"}
          `}
        >
          <div className="flex items-center gap-2 mb-1">
            <item.icon className={`w-4 h-4 ${item.value ? item.color : "text-muted-foreground/50"}`} />
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
          {item.value ? (
            <p className="text-sm font-medium capitalize">{item.value}</p>
          ) : (
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          )}
        </div>
      ))}
    </div>
  )
}

export function ImportSessionCard({
  session,
  onConfirm,
  onCancel,
  isExpanded,
  onToggleExpand,
}: ImportSessionCardProps) {
  const [showDetails, setShowDetails] = useState(true)

  const isProcessing = ["uploading", "identifying", "researching", "comparing"].includes(session.status)
  const isFailed = session.status === "failed"
  const isReady = session.status === "confirming"

  // Get display data (use partial_data during streaming, or final data when ready)
  const displaySpecies = session.partial_data?.identified_species || session.identified_species
  const displayScientific = session.partial_data?.scientific_name || session.scientific_name
  const displayConfidence = session.partial_data?.confidence || session.confidence
  const displaySources = session.partial_data?.research_sources || session.research_sources || []
  const displayCare = session.partial_data?.care_requirements || session.care_requirements

  return (
    <Card
      className={`
      overflow-hidden transition-all duration-300
      ${isReady ? "ring-2 ring-[var(--success-green)] bg-[var(--success-green)]/5" : ""}
      ${isProcessing ? "ring-1 ring-primary/30" : ""}
      ${isFailed ? "ring-1 ring-destructive/30 bg-destructive/5" : ""}
    `}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex gap-4">
          {/* Plant Image */}
          {session.image_url && (
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0 ring-2 ring-border">
              <img src={session.image_url || "/placeholder.svg"} alt="Plant" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Species Name */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                {displaySpecies ? (
                  <>
                    <h3 className="font-semibold text-lg leading-tight">{displaySpecies}</h3>
                    {displayScientific && <p className="text-sm text-muted-foreground italic">{displayScientific}</p>}
                  </>
                ) : (
                  <>
                    <div className="h-5 w-32 bg-muted rounded animate-pulse mb-1" />
                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  </>
                )}
              </div>

              {/* Status Badge */}
              <Badge
                variant={isReady ? "default" : isFailed ? "destructive" : "secondary"}
                className={`
                  flex-shrink-0
                  ${isReady ? "bg-[var(--success-green)] hover:bg-[var(--success-green)]" : ""}
                `}
              >
                {isFailed ? "Failed" : isReady ? "Ready" : isProcessing ? "Processing..." : "Done"}
              </Badge>
            </div>

            {/* Confidence */}
            {displayConfidence !== null && displayConfidence !== undefined && (
              <div className="flex items-center gap-2 mt-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">{Math.round(displayConfidence * 100)}% confidence</span>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="mt-2 -ml-2 h-7 text-xs"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? "Hide Details" : "Show Details"}
              <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${showDetails ? "rotate-180" : ""}`} />
            </Button>
          </div>
        </div>

        {showDetails && (
          <div className="mt-4 pt-4 border-t space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Timeline */}
            <div className="bg-muted/30 rounded-xl p-4">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Import Progress
              </h4>
              <div className="space-y-0">
                {stages.map((stage, index) => (
                  <TimelineStage
                    key={stage.key}
                    stage={stage}
                    status={getStageStatus(session.status, stage.key)}
                    isLast={index === stages.length - 1}
                    showDetails={true}
                    currentStatus={session.status}
                    foundSources={displaySources}
                  />
                ))}
              </div>
            </div>

            {/* Current Action */}
            {isProcessing && session.current_action && (
              <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{session.current_action}</span>
              </div>
            )}

            {/* Care Requirements Preview */}
            {(displayCare || isProcessing) && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Care Requirements
                </h4>
                <CarePreview careRequirements={displayCare} isPartial={isProcessing} />
              </div>
            )}

            {/* Research Sources */}
            {displaySources.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Verified Sources ({displaySources.length})
                </h4>
                <div className="space-y-2">
                  {displaySources.map((source, i) => (
                    <SourceCard key={i} source={source} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Error Message */}
            {isFailed && session.error_message && (
              <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{session.error_message}</div>
            )}

            {/* Action Buttons */}
            {isReady && (
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => onConfirm(session)}
                  className="flex-1 bg-[var(--success-green)] hover:bg-[var(--success-green)]/90"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Add to Collection
                </Button>
                <Button variant="outline" onClick={() => onCancel(session.id)}>
                  Cancel
                </Button>
              </div>
            )}

            {isProcessing && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => onCancel(session.id)}
                  className="w-full text-muted-foreground hover:text-destructive hover:border-destructive"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel Import
                </Button>
              </div>
            )}

            {isFailed && (
              <Button variant="outline" onClick={() => onCancel(session.id)} className="w-full">
                Dismiss
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
