"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, Filter, X, ArrowUpDown } from "lucide-react"
import { useState } from "react"
import type { Plant } from "@/lib/types"

export type PlantGallerySortKey = "watering_next" | "feeding_next" | "name" | "location" | "species"

interface PlantGalleryFiltersProps {
  plants: Plant[]
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedLocations: string[]
  onLocationsChange: (locations: string[]) => void
  selectedSpecies: string[]
  onSpeciesChange: (species: string[]) => void
  sortKey: PlantGallerySortKey
  onSortChange: (sortKey: PlantGallerySortKey) => void
}

export function PlantGalleryFilters({
  plants,
  searchQuery,
  onSearchChange,
  selectedLocations,
  onLocationsChange,
  selectedSpecies,
  onSpeciesChange,
  sortKey,
  onSortChange,
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
    <div className="flex flex-col gap-2.5 mb-4">
      {/* Search Bar */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search plants..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9 h-10"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground active:text-foreground tap-target flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="relative flex-shrink-0 h-9 active:scale-95">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={sortKey} onValueChange={(v) => onSortChange(v as PlantGallerySortKey)}>
              <DropdownMenuRadioItem value="watering_next">Watering next</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="feeding_next">Feeding next</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="location">Location</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="species">Species</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Location Filter */}
        {locations.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="relative flex-shrink-0 h-9 active:scale-95">
                <Filter className="w-3.5 h-3.5 mr-1.5" />
                Location
                {selectedLocations.length > 0 && (
                  <Badge className="ml-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
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
            <Button variant="outline" size="sm" className="relative flex-shrink-0 h-9 active:scale-95">
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              Species
              {selectedSpecies.length > 0 && (
                <Badge className="ml-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
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
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleClearFilters}
          className="flex-shrink-0 h-9 active:scale-95 text-muted-foreground"
        >
          Clear ({activeFilterCount})
        </Button>
      )}
      </div>
    </div>
  )
}
