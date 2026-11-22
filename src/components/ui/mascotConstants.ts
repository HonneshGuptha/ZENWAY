/**
 * ZENWAY Mascot System Tokens & Persistence Helpers
 * Strict frontend-only brand tokens and storage utilities.
 */

export const MASCOT_COLORS = {
  white: "#FFFFFF",
  outline: "#141413",
  vermilion: "#EA2E00",
  sage: "#9DBDB8",
  cream: "#FAF6EE",
} as const

export const INTRO_STORAGE_KEY = "zenway_intro_seen"

/**
 * Checks whether the user has already seen the entry intro in this or previous sessions.
 * Safe for private browsing and restricted storage environments.
 */
export function hasSeenIntro(): boolean {
  try {
    if (typeof window === "undefined") return false
    return (
      localStorage.getItem(INTRO_STORAGE_KEY) === "true" ||
      sessionStorage.getItem(INTRO_STORAGE_KEY) === "true"
    )
  } catch {
    return false
  }
}

/**
 * Marks the entry intro as seen across both localStorage and sessionStorage.
 */
export function markIntroSeen(): void {
  try {
    localStorage.setItem(INTRO_STORAGE_KEY, "true")
  } catch {
    // Ignore restricted storage
  }
  try {
    sessionStorage.setItem(INTRO_STORAGE_KEY, "true")
  } catch {
    // Ignore restricted storage
  }
}

/**
 * Clears the intro seen flag for replay purposes.
 */
export function clearIntroSeen(): void {
  try {
    localStorage.removeItem(INTRO_STORAGE_KEY)
  } catch {
    // Ignore restricted storage
  }
  try {
    sessionStorage.removeItem(INTRO_STORAGE_KEY)
  } catch {
    // Ignore restricted storage
  }
}

/**
 * Detects whether the user has requested reduced motion.
 */
export function prefersReducedMotion(): boolean {
  try {
    if (typeof window === "undefined" || !window.matchMedia) return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}
