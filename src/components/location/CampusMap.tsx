import * as React from "react"
import L from "leaflet"
import { Compass, Navigation } from "lucide-react"
import { Button } from "@/components/ui/button"
import { calculateRoute, type RouteResult } from "@/lib/routing"

export interface CampusLocation {
  name: string
  lat: number
  lng: number
  category?: "academic" | "hostel" | "transit" | "gate" | "general"
}

export const CAMPUS_LANDMARKS: CampusLocation[] = [
  { name: "MSRUAS Main Gate (New BEL Road)", lat: 13.0298, lng: 77.5658, category: "gate" },
  { name: "Faculty of Engineering & Tech (FET)", lat: 13.0315, lng: 77.5640, category: "academic" },
  { name: "MSRUAS Central Library", lat: 13.0308, lng: 77.5645, category: "academic" },
  { name: "Student Hostels (West Gate)", lat: 13.0322, lng: 77.5630, category: "hostel" },
  { name: "Campus Sports Complex & Gym", lat: 13.0328, lng: 77.5652, category: "academic" },
  { name: "Mathikere Bus Stand & Junction", lat: 13.0335, lng: 77.5585, category: "transit" },
  { name: "Yeshwanthpur Metro Station", lat: 13.0235, lng: 77.5503, category: "transit" },
  { name: "MSRIT Campus Connect Gate", lat: 13.0301, lng: 77.5635, category: "gate" },
  { name: "Peenya Campus Block", lat: 13.0280, lng: 77.5180, category: "academic" },
  { name: "Hebbal Flyover Junction", lat: 13.0358, lng: 77.5970, category: "transit" },
]

interface CampusMapProps {
  initialLat?: number
  initialLng?: number
  zoom?: number
  interactive?: boolean
  selectedLocation?: CampusLocation | null
  destinationLocation?: CampusLocation | null
  onLocationSelect?: (loc: CampusLocation) => void
  showRoute?: boolean
  height?: string
  className?: string
}

export function CampusMap({
  initialLat = 13.0304,
  initialLng = 77.5649,
  zoom = 15,
  interactive = true,
  selectedLocation,
  destinationLocation,
  onLocationSelect,
  showRoute = false,
  height = "320px",
  className = "",
}: CampusMapProps) {
  const mapContainerRef = React.useRef<HTMLDivElement>(null)
  const mapInstanceRef = React.useRef<L.Map | null>(null)
  const markersLayerRef = React.useRef<L.LayerGroup | null>(null)
  const routePolylineRef = React.useRef<L.Polyline | null>(null)
  const [routeInfo, setRouteInfo] = React.useState<RouteResult | null>(null)

  // Initialize Map
  React.useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: zoom,
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive ? "center" : false,
      attributionControl: false,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map)

    const markersLayer = L.layerGroup().addTo(map)
    markersLayerRef.current = markersLayer
    mapInstanceRef.current = map

    if (interactive && onLocationSelect) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        onLocationSelect({
          name: `Pin: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`,
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          category: "general",
        })
      })
    }

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [initialLat, initialLng, zoom, interactive, onLocationSelect])

  // Update Markers & Route
  React.useEffect(() => {
    const map = mapInstanceRef.current
    const markersLayer = markersLayerRef.current
    if (!map || !markersLayer) return

    markersLayer.clearLayers()
    if (routePolylineRef.current) {
      routePolylineRef.current.remove()
      routePolylineRef.current = null
    }

    // Default icon creator
    const createCustomIcon = (color: string, label: string) =>
      L.divIcon({
        className: "custom-map-pin",
        html: `
          <div style="background-color: ${color}; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 2px solid white; color: white; font-size: 11px; font-weight: bold;">
            ${label}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })

    // Selected (Origin / Pickup) Marker
    if (selectedLocation) {
      const marker = L.marker([selectedLocation.lat, selectedLocation.lng], {
        icon: createCustomIcon("#2563eb", "A"),
      }).addTo(markersLayer)
      marker.bindPopup(`<b>${selectedLocation.name}</b><br/><span style="font-size: 10px;">Pickup / Origin</span>`)
    }

    // Destination Marker
    if (destinationLocation) {
      const destMarker = L.marker([destinationLocation.lat, destinationLocation.lng], {
        icon: createCustomIcon("#16a34a", "B"),
      }).addTo(markersLayer)
      destMarker.bindPopup(`<b>${destinationLocation.name}</b><br/><span style="font-size: 10px;">Drop-off / Destination</span>`)
    }

    // Draw Route Polyline with Real Routing Engine
    if (showRoute && selectedLocation && destinationLocation) {
      calculateRoute(
        selectedLocation.lat,
        selectedLocation.lng,
        destinationLocation.lat,
        destinationLocation.lng
      ).then((res) => {
        setRouteInfo(res)
        if (!map) return

        if (routePolylineRef.current) {
          routePolylineRef.current.remove()
        }

        const polyline = L.polyline(res.coordinates, {
          color: "#2563eb",
          weight: 4,
          opacity: 0.85,
        }).addTo(map)

        routePolylineRef.current = polyline
        map.fitBounds(polyline.getBounds(), { padding: [35, 35] })
      })
    } else if (selectedLocation) {
      map.setView([selectedLocation.lat, selectedLocation.lng], 15)
      setRouteInfo(null)
    }
  }, [selectedLocation, destinationLocation, showRoute])

  const handleCenterCampus = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([13.0304, 77.5649], 15)
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-border shadow-xs ${className}`}>
      <div ref={mapContainerRef} style={{ height, width: "100%" }} className="z-10" />

      {/* Floating Route Summary Badge */}
      {routeInfo && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background/95 backdrop-blur-md border border-border shadow-md text-xs font-semibold text-foreground">
          <Navigation className="size-3.5 text-primary" />
          <span>{routeInfo.summary}</span>
        </div>
      )}

      {/* Floating Campus Center Button */}
      {interactive && (
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCenterCampus}
            className="h-8 px-2.5 bg-background/90 backdrop-blur-sm shadow-sm text-xs font-medium cursor-pointer gap-1.5"
            title="Center on Campus"
          >
            <Compass className="size-3.5 text-primary" />
            <span className="hidden sm:inline">MSRUAS Campus</span>
          </Button>
        </div>
      )}

      {/* Map Attribution Banner */}
      <div className="absolute bottom-1 right-2 z-20 text-[9px] text-muted-foreground/80 bg-background/70 px-1.5 py-0.5 rounded pointer-events-none">
        © OpenStreetMap contributors
      </div>
    </div>
  )
}
