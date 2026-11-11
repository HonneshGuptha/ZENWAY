/**
 * ZENWAY Campus Routing Service
 * Fetches real route geometry, road distance (km), and estimated travel duration (minutes)
 * using the Open Source Routing Machine (OSRM) with resilient campus fallback.
 */

export interface RouteResult {
  coordinates: [number, number][] // [lat, lng] array for Leaflet polyline
  distanceKm: number
  durationMinutes: number
  summary: string
}

// Haversine fallback if OSRM is unreachable
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Number((R * c).toFixed(2))
}

export async function calculateRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: "driving" | "bike" | "walking" = "driving"
): Promise<RouteResult> {
  const straightDistKm = calculateHaversineDistance(originLat, originLng, destLat, destLng)

  try {
    const osrmProfile = mode === "bike" ? "bicycle" : mode === "walking" ? "foot" : "car"
    const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`

    const response = await fetch(url, { signal: AbortSignal.timeout(3500) })
    if (!response.ok) throw new Error("Routing service returned non-200")

    const data = await response.json()
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0]
      // GeoJSON coordinates are [lng, lat], Leaflet expects [lat, lng]
      const coords: [number, number][] = route.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng]
      )

      const distKm = Number((route.distance / 1000).toFixed(1))
      const durMin = Math.max(1, Math.round(route.duration / 60))

      return {
        coordinates: coords,
        distanceKm: distKm,
        durationMinutes: durMin,
        summary: `${distKm} km • ~${durMin} min`,
      }
    }
  } catch (err) {
    console.warn("[Routing] OSRM query failed or timed out, using campus geometric route:", err)
  }

  // Campus geometric fallback (straight line with mid-way road offset)
  const midLat = (originLat + destLat) / 2 + 0.001
  const midLng = (originLng + destLng) / 2 - 0.001
  const estDistance = Number((straightDistKm * 1.3).toFixed(1))
  const estDuration = Math.max(3, Math.round((estDistance / 25) * 60)) // ~25km/h campus road avg

  return {
    coordinates: [
      [originLat, originLng],
      [midLat, midLng],
      [destLat, destLng],
    ],
    distanceKm: estDistance,
    durationMinutes: estDuration,
    summary: `${estDistance} km • ~${estDuration} min`,
  }
}
