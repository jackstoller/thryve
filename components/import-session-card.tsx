"use client"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  HelpCircle,
  Shuffle,
} from "lucide-react"
import type { ImportSession, ResearchSource } from "@/lib/types"
import { getRandomPlantName } from "@/lib/plant-names"

interface ImportSessionCardProps {
  session: ImportSession
  onConfirm: (session: ImportSession) => void
  onCancel: (id: string) => void
  onCorrect?: (session: ImportSession) => void
  isExpanded: boolean
  onToggleExpand: () => void
}

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

function IdentificationModelsList({ currentStatus }: { currentStatus: string }) {
  // AI models used for identification
  const models = [
    { name: "Claude Sonnet 4", provider: "Anthropic" },
    { name: "GPT-4o", provider: "OpenAI" },
    { name: "Gemini 2.0 Flash", provider: "Google" },
  ]

  // Show as completed if we've moved past identifying
  const isCompleted = ["researching", "comparing", "confirming", "completed"].includes(currentStatus)

  return (
    <div className="mt-3 ml-6 space-y-2">
      <p className="text-xs text-muted-foreground font-medium mb-2">
        Cross-verifying with AI models ({isCompleted ? models.length : "0"}/{models.length}):
      </p>
      {models.map((model, index) => {
        return (
          <div
            key={model.name}
            className="flex items-center gap-2 text-xs animate-in fade-in slide-in-from-left-2 flex-wrap"
            style={{ animationDelay: `${index * 150}ms` }}
          >
            <div
              className={`
              w-5 h-5 rounded-full flex items-center justify-center shrink-0
              ${isCompleted ? "bg-[var(--success-green)]/20 text-[var(--success-green)]" : "bg-muted text-muted-foreground"}
            `}
            >
              {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
            </div>
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className={`${isCompleted ? "text-foreground" : "text-muted-foreground"} truncate`}>
              {model.name}
            </span>
            {isCompleted && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 bg-[var(--success-green)]/10 text-[var(--success-green)] border-[var(--success-green)]/30 shrink-0"
              >
                Analyzed
              </Badge>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ResearchSourcesList({ foundSources }: { foundSources: ResearchSource[] }) {
  // Show loading state for minimum 3 sources
  const minSources = 3
  const sourcesToShow = Math.max(minSources, foundSources.length)

  return (
    <div className="mt-3 ml-6 space-y-2">
      <p className="text-xs text-muted-foreground font-medium mb-2">
        Consulting authoritative sources ({foundSources.length}/{minSources} minimum):
      </p>
      {Array.from({ length: sourcesToShow }).map((_, index) => {
        const source = foundSources[index]
        const isLoading = !source

        return (
          <div
            key={source?.name || `loading-${index}`}
            className="flex items-center gap-2 text-xs animate-in fade-in slide-in-from-left-2 flex-wrap"
            style={{ animationDelay: `${index * 150}ms` }}
          >
            <div
              className={`
              w-5 h-5 rounded-full flex items-center justify-center shrink-0
              ${source ? "bg-[var(--success-green)]/20 text-[var(--success-green)]" : "bg-muted text-muted-foreground"}
            `}
            >
              {source ? <CheckCircle2 className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
            </div>
            <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className={`${source ? "text-foreground" : "text-muted-foreground"} truncate`}>
              {source ? source.name : "Searching..."} 
            </span>
            {source && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 bg-[var(--success-green)]/10 text-[var(--success-green)] border-[var(--success-green)]/30 shrink-0"
              >
                Verified
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
  const showIdentifyingBreakdown =
    stage.key === "identifying" && (status === "current" || status === "completed")

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
            ${showResearchBreakdown || showIdentifyingBreakdown ? "min-h-[140px]" : ""}
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

        {showIdentifyingBreakdown && <IdentificationModelsList currentStatus={currentStatus} />}
        {showResearchBreakdown && <ResearchSourcesList foundSources={foundSources} />}
      </div>
    </div>
  )
}

function SourceCard({ source, index }: { source: ResearchSource; index: number }) {
  const getSourceUrl = (sourceName: string) => {
    if (sourceName.includes("Royal Horticultural Society") || sourceName.includes("RHS")) {
      return "https://www.rhs.org.uk/"
    } else if (sourceName.includes("Missouri Botanical")) {
      return "https://www.missouribotanicalgarden.org/"
    } else if (sourceName.includes("University Extension") || sourceName.includes("Extension Services")) {
      return "https://extension.org/"
    }
    return source.url
  }

  const sourceUrl = getSourceUrl(source.name)

  return (
    <div
      className="bg-muted/50 rounded-lg p-3 border border-border/50 animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <ExternalLink className="w-3 h-3 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{source.name}</p>
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-xs"
              >
                Visit →
              </a>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{source.recommendation}</p>
        </div>
      </div>

      {/* Detailed research data */}
      {(source.watering_frequency_days || source.fertilizing_frequency_days || source.sunlight_level) && (
        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/30">
          {source.watering_frequency_days && (
            <div className="text-xs">
              <span className="text-muted-foreground">Water:</span>{" "}
              <span className="font-medium">Every {source.watering_frequency_days}d</span>
            </div>
          )}
          {source.fertilizing_frequency_days && (
            <div className="text-xs">
              <span className="text-muted-foreground">Fertilize:</span>{" "}
              <span className="font-medium">Every {source.fertilizing_frequency_days}d</span>
            </div>
          )}
          {source.sunlight_level && (
            <div className="text-xs">
              <span className="text-muted-foreground">Light:</span>{" "}
              <span className="font-medium capitalize">{source.sunlight_level}</span>
            </div>
          )}
          {source.humidity_preference && (
            <div className="text-xs">
              <span className="text-muted-foreground">Humidity:</span>{" "}
              <span className="font-medium capitalize">{source.humidity_preference}</span>
            </div>
          )}
          {source.temperature_range && (
            <div className="text-xs col-span-2">
              <span className="text-muted-foreground">Temp:</span>{" "}
              <span className="font-medium">{source.temperature_range}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CarePreview({ careRequirements }: { careRequirements: ImportSession["care_requirements"] | null }) {
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
  onCorrect,
  isExpanded,
  onToggleExpand,
}: ImportSessionCardProps) {
  const [showDetails, setShowDetails] = useState(true)
  const [isSelectingSpecies, setIsSelectingSpecies] = useState(false)
  const [customSpecies, setCustomSpecies] = useState("")
  const [customScientificName, setCustomScientificName] = useState("")

  const isProcessing = ["uploading", "identifying", "researching", "comparing"].includes(session.status)
  const isFailed = session.status === "failed"
  const isCompleted = session.status === "completed"
  const needsSelection = session.status === "needs_selection"
  const needsConfirmation = session.status === "confirming"

  // Use final session data (no partial data needed with server-side processing)
  const displaySpecies = session.identified_species
  const displayScientific = session.scientific_name
  const displayConfidence = session.confidence
  const displaySources = session.research_sources || []
  const displayCare = session.care_requirements

  // Generate status message based on current state
  const getStatusMessage = () => {
    switch (session.status) {
      case "uploading":
        return "Uploading image..."
      case "identifying":
        return displaySpecies
          ? `Identified as ${displaySpecies}, confirming...`
          : "Analyzing plant features and characteristics..."
      case "researching":
        return displaySources.length > 0
          ? `Consulting source ${displaySources.length}...`
          : "Searching botanical databases for care requirements..."
      case "comparing":
        return "Cross-referencing sources and verifying care requirements..."
      case "needs_selection":
        return "Please help us identify this plant"
      case "confirming":
        return "Research complete! Ready to add to your collection"
      case "completed":
        return "Successfully added to your collection!"
      case "failed":
        return session.error_message || "Identification failed"
      default:
        return "Processing..."
    }
  }

  const handleSelectSuggestion = async (species: string, scientificName: string) => {
    setIsSelectingSpecies(true)
    try {
      const response = await fetch(`/api/import-sessions/${session.id}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ species, scientific_name: scientificName }),
      })

      if (!response.ok) {
        throw new Error("Failed to select species")
      }
    } catch (error) {
      console.error("Failed to select species:", error)
      alert("Failed to select species. Please try again.")
    } finally {
      setIsSelectingSpecies(false)
    }
  }

  const handleCustomSpecies = async () => {
    if (!customSpecies.trim() || !customScientificName.trim()) {
      alert("Please enter both common and scientific names")
      return
    }
    await handleSelectSuggestion(customSpecies, customScientificName)
  }

  const handleAutoName = () => {
    const randomName = getRandomPlantName()
    setCustomSpecies(randomName)
    // Keep the scientific name the user might have already entered, or suggest they enter it
    if (!customScientificName.trim()) {
      // If no scientific name, suggest they still need to enter it
      setTimeout(() => {
        document.getElementById("custom-scientific")?.focus()
      }, 100)
    }
  }

  return (
    <Card
      className={`
      overflow-hidden transition-all duration-300
      ${isCompleted ? "ring-2 ring-green-500 bg-green-500/5" : ""}
      ${isProcessing ? "ring-1 ring-primary/30" : ""}
      ${needsSelection ? "ring-2 ring-amber-500/50 bg-amber-500/5" : ""}
      ${isFailed ? "ring-1 ring-destructive/30 bg-destructive/5" : ""}
    `}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex gap-4">
          {/* Plant Image */}
          {session.image_url && (
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted shrink-0 ring-2 ring-border">
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
                variant={isCompleted ? "default" : isFailed ? "destructive" : needsSelection || needsConfirmation ? "outline" : "secondary"}
                className={`
                  shrink-0
                  ${isCompleted ? "bg-green-500 hover:bg-green-500" : ""}
                  ${needsSelection ? "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950" : ""}
                  ${needsConfirmation ? "border-primary text-primary bg-primary/10" : ""}
                `}
              >
                {isFailed ? "Failed" : isCompleted ? "Added!" : needsSelection ? "Needs ID" : needsConfirmation ? "Ready!" : isProcessing ? "Processing..." : "Done"}
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
            {isProcessing && (
              <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{getStatusMessage()}</span>
              </div>
            )}

            {/* Ready for Confirmation */}
            {needsConfirmation && (
              <div className="flex items-start gap-3 text-sm text-primary bg-primary/5 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-0.5">{getStatusMessage()}</p>
                  <p className="text-xs text-muted-foreground">Review the care requirements below and click "Add Plant" to complete the import.</p>
                </div>
              </div>
            )}

            {/* Completion Message */}
            {isCompleted && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{getStatusMessage()}</span>
              </div>
            )}

            {/* Care Requirements Preview */}
            {(displayCare || isProcessing) && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Care Requirements
                </h4>
                <CarePreview careRequirements={displayCare} />
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

            {/* Plant Suggestions */}
            {needsSelection && session.suggestions && session.suggestions.length > 0 && (
              <div className="space-y-4">
                <div className="bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100 rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <HelpCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium mb-1">We need your help!</h4>
                      <p className="text-sm opacity-90">
                        We couldn't identify this plant with high confidence. Please select from our best guesses below, or enter your own identification.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    AI Suggestions
                  </h4>
                  <div className="space-y-2">
                    {session.suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSelectSuggestion(suggestion.common_name, suggestion.scientific_name)}
                        disabled={isSelectingSpecies}
                        className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent hover:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="font-medium">{suggestion.common_name}</div>
                            <div className="text-sm text-muted-foreground italic">{suggestion.scientific_name}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant="outline" className="text-[10px] px-1.5">
                              {Math.round(suggestion.confidence * 100)}% confidence
                            </Badge>
                            {suggestion.votes > 1 && (
                              <span className="text-[10px] text-muted-foreground">
                                {suggestion.votes}/{session.suggestions?.length || 3} models agreed
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Or Enter Your Own
                  </h4>
                  <div className="space-y-3 p-3 rounded-lg border border-border">
                    <div className="space-y-1.5">
                      <Label htmlFor="custom-species" className="text-sm">
                        Common Name
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="custom-species"
                          placeholder="e.g., Snake Plant"
                          value={customSpecies}
                          onChange={(e) => setCustomSpecies(e.target.value)}
                          className="flex-1"
                          disabled={isSelectingSpecies}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAutoName}
                          disabled={isSelectingSpecies}
                          className="shrink-0"
                          title="Generate a random plant name"
                        >
                          <Shuffle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="custom-scientific" className="text-sm">
                        Scientific Name
                      </Label>
                      <Input
                        id="custom-scientific"
                        placeholder="e.g., Sansevieria trifasciata"
                        value={customScientificName}
                        onChange={(e) => setCustomScientificName(e.target.value)}
                        disabled={isSelectingSpecies}
                      />
                    </div>
                    <Button
                      onClick={handleCustomSpecies}
                      disabled={isSelectingSpecies || !customSpecies.trim() || !customScientificName.trim()}
                      className="w-full"
                    >
                      {isSelectingSpecies ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Continue with Custom Name"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {needsSelection && (
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

            {needsConfirmation && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => onCancel(session.id)}
                  className="flex-1 text-muted-foreground hover:text-destructive hover:border-destructive"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                {onCorrect && (
                  <Button onClick={() => onCorrect(session)} className="flex-1">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Add Plant
                  </Button>
                )}
              </div>
            )}

            {isCompleted && (
              <div className="pt-2">
                <Button variant="outline" onClick={() => onCancel(session.id)} className="w-full">
                  Dismiss
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
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => onCancel(session.id)} className="flex-1">
                  Ignore
                </Button>
                {onCorrect && (
                  <Button onClick={() => onCorrect(session)} className="flex-1">
                    Correct
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
