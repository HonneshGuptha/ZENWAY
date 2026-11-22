export const CAMPUS_LOCATION = "RUAS Peenya Campus"

export type RideDirection = "to_college" | "from_college"

export const POPULAR_LOCALITIES: string[] = [
  "Vijayanagar",
  "RPC Layout",
  "Yeshwanthpur",
  "Rajajinagar",
  "Jalahalli",
  "Kamakshipalya",
]

const CAMPUS_KEYWORDS = [
  "ruas", // catches "RUAS", "MSRUAS", "MSRUAS gate 3"
  "ramaiah", // catches "Ramaiah University", "M.S. Ramaiah"
  "peenya campus",
  "rtc campus",
  "college",
]

export function isCampusLocation(location: string | undefined | null): boolean {
  if (!location) return false
  const normalized = location.trim().toLowerCase()
  return CAMPUS_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

/**
 * Determines whether a ride route is heading to college, from college, or a custom route.
 */
export function getRideDirection(
  origin: string | undefined | null,
  destination: string | undefined | null
): RideDirection | null {
  if (isCampusLocation(destination)) return "to_college"
  if (isCampusLocation(origin)) return "from_college"
  return null
}

/**
 * Trims, collapses internal whitespace, and lowercases a hub name.
 */
export function normalizeHubName(name: string | undefined | null): string {
  if (!name) return ""
  return name.trim().replace(/\s+/g, " ").toLowerCase()
}

/**
 * Calculates a horizontal bar width percentage relative to the highest demand count in a queue.
 * Ensures a minimum of 12% width for visual clarity.
 */
export function calculateBarWidth(suggestionCount: number, maxCount: number): number {
  if (!maxCount || maxCount <= 0) return 12
  return Math.max(12, Math.round((Math.max(0, suggestionCount) / maxCount) * 100))
}

