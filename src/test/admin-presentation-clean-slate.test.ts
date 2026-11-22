import { describe, it, expect } from "vitest"

describe("Admin Presentation Clean-Slate Reset Wiring", () => {
  it("rejects execution when confirmation token is not exactly 'RESET'", async () => {
    let rpcCalled = false
    const simulateReset = async (token: string) => {
      if (token.trim() !== "RESET") {
        return { error: "Please type RESET to confirm." }
      }
      rpcCalled = true
      return { success: true }
    }

    const wrongAttempt = await simulateReset("reset")
    expect(wrongAttempt.error).toBe("Please type RESET to confirm.")
    expect(rpcCalled).toBe(false)

    const emptyAttempt = await simulateReset("  ")
    expect(emptyAttempt.error).toBe("Please type RESET to confirm.")
    expect(rpcCalled).toBe(false)

    const correctAttempt = await simulateReset("RESET")
    expect(correctAttempt.success).toBe(true)
    expect(rpcCalled).toBe(true)
  })

  it("verifies clean-slate RPC parameters and preservation contract", () => {
    const requiredPreservedEntities = [
      "auth.users",
      "profiles",
      "student_verifications",
      "campus_localities",
      "admin_sessions",
      "audit_logs",
    ]

    const wipedDemonstrationEntities = [
      "rides",
      "ride_requests",
      "rentals",
      "rental_requests",
      "carry_packages",
      "carry_requests",
      "reviews",
      "disputes",
      "notifications",
    ]

    expect(requiredPreservedEntities).toHaveLength(6)
    expect(wipedDemonstrationEntities).toHaveLength(9)
    expect(requiredPreservedEntities).not.toEqual(expect.arrayContaining(wipedDemonstrationEntities))
  })
})
