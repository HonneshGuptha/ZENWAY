/**
 * ZENWAY Student & Exchange Formatting Helpers
 * Standardized across Rent, Ride, Carry, Activity, Profile, and Admin views.
 */

/**
 * Derives consistent 2-letter uppercase initials for student avatars.
 */
export function getStudentInitials(fullName?: string | null, email?: string | null): string {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return fullName.trim().slice(0, 2).toUpperCase()
  }
  if (email && email.trim()) {
    return email.trim().slice(0, 2).toUpperCase()
  }
  return "ST"
}

/**
 * Formats ISO timestamps into human-readable date & time strings without raw seconds.
 * Example: "Mon, Nov 23, 5:30 PM"
 */
export function formatReadableDateTime(isoString?: string | null): string {
  if (!isoString) return ""
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return isoString
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return isoString || ""
  }
}

/**
 * Formats ISO timestamps into clean short dates.
 * Example: "Nov 23, 2026"
 */
export function formatReadableDate(isoString?: string | null): string {
  if (!isoString) return ""
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return isoString
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return isoString || ""
  }
}

/**
 * Formats dispute reason identifiers (e.g. "property_damage") into clean title case.
 */
export function formatDisputeReason(reason?: string | null): string {
  if (!reason) return "Unspecified Incident"
  return reason
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}
