"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, Filter, X } from "lucide-react"
import { useState } from "react"
import type { Plant } from "@/lib/types"

interface PlantGalleryFiltersProps {
  plants: Plant[]
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedLocations: string[]
  onLocationsChange: (locations: string[]) => void
  selectedSpecies: string[]
  onSpeciesChange: (species: string[]) => void
}

export function PlantGalleryFilters({
  plants,
  searchQuery,
  onSearchChange,
  selectedLocations,
  onLocationsChange,
  selectedSpecies,
  onSpeciesChange,
}: PlantGalleryFiltersProps) {
  // Get unique locations and species from plants
  const locations = Array.from(new Set(plants.map((p) => p.location).filter(Boolean))) as string[]
  const species = Array.from(new Set(plants.map((p) => p.species).filter(Boolean))) as string[]

  const activeFilterCount =
    selectedLocations.length + selectedSpecies.length + (searchQuery ? 1 : 0)

  const handleClearFilters = () => {
    onSearchChange("")
    onLocationsChange([])
    onSpeciesChange([])
  }

  const toggleLocation = (location: string) => {
    if (selectedLocations.includes(location)) {
      onLocationsChange(selectedLocations.filter((l) => l !== location))
    } else {
      onLocationsChange([...selectedLocations, location])
    }
  }

  const toggleSpecies = (sp: string) => {
    if (selectedSpecies.includes(sp)) {
      onSpeciesChange(selectedSpecies.filter((s) => s !== sp))
    } else {
      onSpeciesChange([...selectedSpecies, sp])
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      {/* Search Bar */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search plants by name..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Location Filter */}
      {locations.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="w-4 h-4 mr-2" />
              Location
              {selectedLocations.length > 0 && (
                <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                  {selectedLocations.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Filter by Location</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {locations.map((location) => (
              <DropdownMenuCheckboxItem
                key={location}
                checked={selectedLocations.includes(location)}
                onCheckedChange={() => toggleLocation(location)}
              >
                {location}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Species Filter */}
      {species.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="w-4 h-4 mr-2" />
              Species
              {selectedSpecies.length > 0 && (
                <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                  {selectedSpecies.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Filter by Species</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {species.map((sp) => (
              <DropdownMenuCheckboxItem
                key={sp}
                checked={selectedSpecies.includes(sp)}
                onCheckedChange={() => toggleSpecies(sp)}
              >
                {sp}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <Button variant="ghost" onClick={handleClearFilters}>
          Clear {activeFilterCount} {activeFilterCount === 1 ? "filter" : "filters"}
        </Button>
      )}
    </div>
  )
}
