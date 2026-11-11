import * as React from "react"
import { CampusMap, CAMPUS_LANDMARKS, type CampusLocation } from "./CampusMap"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MapPin, Search, Check, Compass } from "lucide-react"

interface LocationPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (loc: CampusLocation) => void
  title?: string
  initialLocationName?: string
}

export function LocationPickerModal({
  isOpen,
  onClose,
  onSelect,
  title = "Select Campus Location",
  initialLocationName = "",
}: LocationPickerModalProps) {
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<CampusLocation | null>(null)

  // Find match or default
  React.useEffect(() => {
    if (initialLocationName) {
      const match = CAMPUS_LANDMARKS.find((l) =>
        l.name.toLowerCase().includes(initialLocationName.toLowerCase())
      )
      if (match) {
        setSelected(match)
      } else {
        setSelected({
          name: initialLocationName,
          lat: 13.0304,
          lng: 77.5649,
          category: "general",
        })
      }
    } else {
      setSelected(CAMPUS_LANDMARKS[0])
    }
  }, [initialLocationName, isOpen])

  const filteredLandmarks = CAMPUS_LANDMARKS.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden sm:rounded-2xl">
        <DialogHeader className="p-4 sm:p-6 pb-2 border-b border-border/80">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <MapPin className="size-5 text-primary" />
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pick from verified campus landmarks or click anywhere on the OpenStreetMap.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Search Landmarks */}
          <div className="relative">
            <Search className="size-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
            <Input
              placeholder="Search campus buildings, gates, transit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Quick Landmark Badges */}
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pb-1">
            {filteredLandmarks.map((loc) => {
              const isSelected = selected?.name === loc.name
              return (
                <button
                  key={loc.name}
                  type="button"
                  onClick={() => setSelected(loc)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border-border/70"
                  }`}
                >
                  <MapPin className="size-3" />
                  <span>{loc.name}</span>
                </button>
              )
            })}
          </div>

          {/* Interactive Leaflet Map */}
          <div className="rounded-xl overflow-hidden border border-border">
            <CampusMap
              height="260px"
              selectedLocation={selected}
              onLocationSelect={(loc) => setSelected(loc)}
            />
          </div>

          {/* Selected Location Pill */}
          {selected && (
            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <Compass className="size-4 text-primary shrink-0" />
                <span className="font-semibold text-foreground truncate">{selected.name}</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">
                {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 sm:p-6 pt-2 border-t border-border/80 flex sm:justify-between items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs cursor-pointer">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!selected}
            className="text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
          >
            <Check className="size-3.5" />
            <span>Select This Location</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
