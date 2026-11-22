/**
 * ZENWAY Supported Universities Registry
 * Structured for clean extensibility as additional campuses are onboarded.
 */

export interface UniversityOption {
  id: string
  name: string
  shortName?: string
  location?: string
  isActive: boolean
}

export const SUPPORTED_UNIVERSITIES: readonly UniversityOption[] = [
  {
    id: "msruas",
    name: "MS Ramaiah University of Applied Sciences",
    shortName: "MSRUAS",
    location: "Peenya / Gnanagangothri Campus, Bengaluru",
    isActive: true,
  },
] as const

export const DEFAULT_UNIVERSITY = "MS Ramaiah University of Applied Sciences"

export const MORE_UNIVERSITIES_NOTE = "More colleges and universities will be added soon!"

/**
 * Validates whether a university string matches an active supported university.
 * Tolerates official name and accepted canonical shorthand.
 */
export function isValidUniversity(university?: string | null): boolean {
  if (!university || typeof university !== "string") return false
  const trimmed = university.trim().toLowerCase()
  return SUPPORTED_UNIVERSITIES.some(
    (u) =>
      u.isActive &&
      (u.name.toLowerCase() === trimmed ||
        (u.shortName && u.shortName.toLowerCase() === trimmed))
  )
}

/**
 * Normalizes university name to canonical official name.
 */
export function normalizeUniversity(university?: string | null): string | null {
  if (!university || typeof university !== "string") return null
  const trimmed = university.trim().toLowerCase()
  const match = SUPPORTED_UNIVERSITIES.find(
    (u) =>
      u.isActive &&
      (u.name.toLowerCase() === trimmed ||
        (u.shortName && u.shortName.toLowerCase() === trimmed))
  )
  return match ? match.name : null
}
