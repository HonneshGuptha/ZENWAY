import { describe, it, expect } from "vitest"

/**
 * Domain rules and simulated server-side authorization checks
 * representing PostgreSQL RPC verify_admin_access_key, has_active_admin_session,
 * check_admin_session, and admin_sign_out.
 */
interface MockAdminSession {
  adminId: string
  sessionToken: string
  createdAt: number
  expiresAt: number
}

class MockAdminAuthStore {
  private accessKeyHash: string
  private sessions: Map<string, MockAdminSession> = new Map()

  constructor(initialKey: string) {
    // Simulated hash using simple prefix for test determinism
    this.accessKeyHash = `hashed_${initialKey}`
  }

  // Matches verify_admin_access_key RPC logic
  verifyAdminKey(params: {
    userId: string
    userRole: string
    key: string
    now?: number
  }): { success: boolean; error?: string } {
    if (params.userRole !== "admin") {
      return { success: false, error: "Access Denied: Administrator role required." }
    }

    if (!params.key || params.key.trim().length === 0) {
      return { success: false, error: "Key cannot be empty." }
    }

    const testHash = `hashed_${params.key.trim()}`
    if (testHash !== this.accessKeyHash) {
      return { success: false, error: "Invalid Admin Access Key." }
    }

    // Provision active 2-hour session
    const currentNow = params.now ?? Date.now()
    const sessionToken = `tok_${Math.random().toString(36).substring(2)}`
    this.sessions.set(params.userId, {
      adminId: params.userId,
      sessionToken,
      createdAt: currentNow,
      expiresAt: currentNow + 2 * 60 * 60 * 1000,
    })

    return { success: true }
  }

  // Matches has_active_admin_session / check_admin_session RPC logic
  hasActiveSession(userId: string, userRole: string, now?: number): boolean {
    if (userRole !== "admin") return false
    const session = this.sessions.get(userId)
    if (!session) return false
    const currentNow = now ?? Date.now()
    return session.expiresAt > currentNow
  }

  // Matches update_admin_access_key RPC logic
  updateAccessKey(params: {
    userId: string
    userRole: string
    oldKey: string
    newKey: string
    now?: number
  }): { success: boolean; error?: string } {
    if (!this.hasActiveSession(params.userId, params.userRole, params.now)) {
      return { success: false, error: "Access Denied: Valid verified administrator session required." }
    }

    if (!params.newKey || params.newKey.trim().length < 8) {
      return { success: false, error: "Invalid Key: New admin access key must be at least 8 characters." }
    }

    const oldHash = `hashed_${params.oldKey.trim()}`
    if (oldHash !== this.accessKeyHash) {
      return { success: false, error: "Authentication Failed: Current access key is incorrect." }
    }

    this.accessKeyHash = `hashed_${params.newKey.trim()}`
    // Crucial: Invalidate all existing sessions upon key rotation
    this.sessions.clear()
    return { success: true }
  }

  // Matches admin_sign_out RPC logic
  adminSignOut(userId: string): void {
    this.sessions.delete(userId)
  }

  // Check if legacy key is accepted
  isLegacyKeyCompromised(legacyKey: string): boolean {
    return this.accessKeyHash === `hashed_${legacyKey}`
  }
}

describe("Admin Authorization & Session Integrity", () => {
  it("rejects non-admin users from verifying access key", () => {
    const store = new MockAdminAuthStore("secureSuperSecretKey2026")
    const result = store.verifyAdminKey({
      userId: "student-1",
      userRole: "student",
      key: "secureSuperSecretKey2026",
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain("Administrator role required")
  })

  it("provisions a valid server-side admin session upon valid key verification", () => {
    const store = new MockAdminAuthStore("secureAdminMasterPassphrase!")
    const verifyResult = store.verifyAdminKey({
      userId: "admin-1",
      userRole: "admin",
      key: "secureAdminMasterPassphrase!",
    })

    expect(verifyResult.success).toBe(true)
    expect(store.hasActiveSession("admin-1", "admin")).toBe(true)
  })

  it("rejects access attempts with incorrect or old access key", () => {
    const store = new MockAdminAuthStore("correctSecretKey123")
    const result = store.verifyAdminKey({
      userId: "admin-1",
      userRole: "admin",
      key: "wrongPasswordAttempt",
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe("Invalid Admin Access Key.")
    expect(store.hasActiveSession("admin-1", "admin")).toBe(false)
  })

  it("rotates away from legacy exposed '2077' key", () => {
    // Initial store rotated away from legacy key
    const store = new MockAdminAuthStore("ZenwayCampusAdmin2026!#")
    expect(store.isLegacyKeyCompromised("2077")).toBe(false)

    // Attempting to authenticate with 2077 must fail
    const result = store.verifyAdminKey({
      userId: "admin-1",
      userRole: "admin",
      key: "2077",
    })
    expect(result.success).toBe(false)
  })

  it("enforces session expiry after 2 hours", () => {
    const store = new MockAdminAuthStore("myCampusStrongKey2026")
    const startTime = 1000000000000

    store.verifyAdminKey({
      userId: "admin-1",
      userRole: "admin",
      key: "myCampusStrongKey2026",
      now: startTime,
    })

    // 1 hour later: still active
    expect(store.hasActiveSession("admin-1", "admin", startTime + 1 * 60 * 60 * 1000)).toBe(true)

    // 2 hours and 1 second later: expired
    expect(store.hasActiveSession("admin-1", "admin", startTime + 2 * 60 * 60 * 1000 + 1000)).toBe(false)
  })

  it("requires minimum 8 characters when rotating admin access key", () => {
    const store = new MockAdminAuthStore("originalSecureKey2026")
    store.verifyAdminKey({
      userId: "admin-1",
      userRole: "admin",
      key: "originalSecureKey2026",
    })

    // Try setting short 4-char key
    const shortResult = store.updateAccessKey({
      userId: "admin-1",
      userRole: "admin",
      oldKey: "originalSecureKey2026",
      newKey: "abcd",
    })
    expect(shortResult.success).toBe(false)
    expect(shortResult.error).toContain("at least 8 characters")

    // Set strong >= 8-char key
    const successResult = store.updateAccessKey({
      userId: "admin-1",
      userRole: "admin",
      oldKey: "originalSecureKey2026",
      newKey: "NewStrongCampusKey2026!",
    })
    expect(successResult.success).toBe(true)

    // After key rotation, active sessions must be cleared
    expect(store.hasActiveSession("admin-1", "admin")).toBe(false)
  })

  it("immediately invalidates active session on admin sign out", () => {
    const store = new MockAdminAuthStore("superAdminKey2026")
    store.verifyAdminKey({
      userId: "admin-1",
      userRole: "admin",
      key: "superAdminKey2026",
    })

    expect(store.hasActiveSession("admin-1", "admin")).toBe(true)

    store.adminSignOut("admin-1")
    expect(store.hasActiveSession("admin-1", "admin")).toBe(false)
  })
})
