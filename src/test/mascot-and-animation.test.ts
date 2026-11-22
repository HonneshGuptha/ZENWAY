import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  MASCOT_COLORS,
  hasSeenIntro,
  markIntroSeen,
  clearIntroSeen,
  prefersReducedMotion,
  INTRO_STORAGE_KEY,
} from "@/components/ui/mascotConstants"

// Mock Storage implementation for node test environment
class MockStorage implements Storage {
  private store: Map<string, string> = new Map()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

describe("Mascot Constants & Brand Identity", () => {
  it("defines consistent 2D flat vector brand color tokens", () => {
    expect(MASCOT_COLORS.white).toBe("#FFFFFF")
    expect(MASCOT_COLORS.outline).toBe("#141413")
    expect(MASCOT_COLORS.vermilion).toBe("#EA2E00")
    expect(MASCOT_COLORS.sage).toBe("#9DBDB8")
    expect(MASCOT_COLORS.cream).toBe("#FAF6EE")
  })
})

describe("First-Visit Storage & Persistence Logic", () => {
  let mockLocal: MockStorage
  let mockSession: MockStorage

  beforeEach(() => {
    mockLocal = new MockStorage()
    mockSession = new MockStorage()

    Object.defineProperty(globalThis, "window", {
      value: {
        matchMedia: vi.fn().mockImplementation(() => ({
          matches: false,
          media: "",
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      },
      writable: true,
      configurable: true,
    })

    Object.defineProperty(globalThis, "localStorage", {
      value: mockLocal,
      writable: true,
      configurable: true,
    })

    Object.defineProperty(globalThis, "sessionStorage", {
      value: mockSession,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("reports intro not seen on first visit", () => {
    expect(hasSeenIntro()).toBe(false)
  })

  it("persists intro seen across localStorage and sessionStorage", () => {
    markIntroSeen()
    expect(hasSeenIntro()).toBe(true)
    expect(mockLocal.getItem(INTRO_STORAGE_KEY)).toBe("true")
    expect(mockSession.getItem(INTRO_STORAGE_KEY)).toBe("true")
  })

  it("clears intro seen on explicit replay trigger", () => {
    markIntroSeen()
    expect(hasSeenIntro()).toBe(true)
    clearIntroSeen()
    expect(hasSeenIntro()).toBe(false)
    expect(mockLocal.getItem(INTRO_STORAGE_KEY)).toBeNull()
    expect(mockSession.getItem(INTRO_STORAGE_KEY)).toBeNull()
  })

  it("handles restricted storage environments gracefully without throwing", () => {
    vi.spyOn(mockLocal, "getItem").mockImplementation(() => {
      throw new Error("QuotaExceededError or Private Browsing restricted")
    })

    expect(() => hasSeenIntro()).not.toThrow()
    expect(hasSeenIntro()).toBe(false)

    vi.spyOn(mockLocal, "setItem").mockImplementation(() => {
      throw new Error("Access Denied")
    })

    expect(() => markIntroSeen()).not.toThrow()
    expect(() => clearIntroSeen()).not.toThrow()
  })
})

describe("Accessibility & Reduced Motion", () => {
  it("detects prefers-reduced-motion correctly", () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        matchMedia: vi.fn().mockImplementation((query) => ({
          matches: query === "(prefers-reduced-motion: reduce)",
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      },
      writable: true,
      configurable: true,
    })

    expect(prefersReducedMotion()).toBe(true)

    Object.defineProperty(globalThis, "window", {
      value: {
        matchMedia: vi.fn().mockImplementation(() => ({
          matches: false,
          media: "",
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      },
      writable: true,
      configurable: true,
    })

    expect(prefersReducedMotion()).toBe(false)
  })
})
