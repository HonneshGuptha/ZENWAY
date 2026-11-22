import { describe, it, expect, vi } from "vitest"
import { deduplicateById, mergeDeduplicatedById } from "@/utils/deduplicate"

describe("Single-Invocation & In-Flight Lock Protection", () => {
  it("invokes the guarded submit handler strictly ONCE for complete profiles", async () => {
    let inFlight = false
    const mockSubmitHandler = vi.fn(async () => {
      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    const executeGuardedAction = async (action: () => Promise<void>) => {
      if (inFlight) {
        return false
      }
      inFlight = true
      try {
        await action()
        return true
      } finally {
        inFlight = false
      }
    }

    // Call once
    const promise1 = executeGuardedAction(mockSubmitHandler)
    // Duplicate concurrent call fired before promise1 settles
    const promise2 = executeGuardedAction(mockSubmitHandler)

    const [res1, res2] = await Promise.all([promise1, promise2])

    expect(res1).toBe(true)
    expect(res2).toBe(false)
    expect(mockSubmitHandler).toHaveBeenCalledTimes(1)
  })

  it("prevents double-invocation when caller triggers form submit and button click", async () => {
    let inFlight = false
    const insertMock = vi.fn().mockResolvedValue({ data: { id: "ride-1" }, error: null })

    const handleCreateListing = async () => {
      if (inFlight) return
      inFlight = true
      try {
        await insertMock()
      } finally {
        inFlight = false
      }
    }

    // Simulate simultaneous event propagation (e.g. form onSubmit + button onClick)
    const call1 = handleCreateListing()
    const call2 = handleCreateListing()

    await Promise.all([call1, call2])

    expect(insertMock).toHaveBeenCalledTimes(1)
  })

  it("invokes pending action strictly ONCE upon modal completion", async () => {
    let pendingAction: (() => Promise<void>) | null = null
    const submitMock = vi.fn(async () => {})

    const requireCompleteProfile = (
      isComplete: boolean,
      action: () => Promise<void>
    ) => {
      if (isComplete) {
        return action()
      }
      pendingAction = action
      return Promise.resolve()
    }

    // Step 1: Incomplete student submits
    await requireCompleteProfile(false, submitMock)
    expect(submitMock).not.toHaveBeenCalled()

    // Step 2: Modal succeeds and executes pending action
    const runPendingAction = async () => {
      if (pendingAction) {
        const act: () => Promise<void> = pendingAction
        pendingAction = null
        await act()
      }
    }

    await runPendingAction()

    // Step 3: Ensure subsequent modal success attempts do not re-run action
    await runPendingAction()

    expect(submitMock).toHaveBeenCalledTimes(1)
  })

  describe("Array Deduplication Utility", () => {
    it("deduplicates array of items by id, keeping first occurrence", () => {
      const items = [
        { id: "vehicle-1", title: "Hero Lectro", hourly_rate: 25 },
        { id: "vehicle-2", title: "Trek Mountain", hourly_rate: 30 },
        { id: "vehicle-1", title: "Hero Lectro Duplicate", hourly_rate: 25 },
        { id: "vehicle-3", title: "Avon City Bike", hourly_rate: 15 },
      ]

      const deduplicated = deduplicateById(items)
      expect(deduplicated).toHaveLength(3)
      expect(deduplicated.map((i) => i.id)).toEqual(["vehicle-1", "vehicle-2", "vehicle-3"])
      expect(deduplicated[0].title).toBe("Hero Lectro")
    })

    it("merges incoming items and deduplicates by id", () => {
      const existing = [
        { id: "ride-1", driver_id: "user-a", origin: "Main Gate" },
        { id: "ride-2", driver_id: "user-b", origin: "Hostel 3" },
      ]

      const incoming = [
        { id: "ride-2", driver_id: "user-b", origin: "Hostel 3 Updated" },
        { id: "ride-3", driver_id: "user-c", origin: "Campus Gate" },
      ]

      const merged = mergeDeduplicatedById(existing, incoming)
      expect(merged).toHaveLength(3)
      expect(merged.find((r) => r.id === "ride-2")?.origin).toBe("Hostel 3 Updated")
    })
  })
})
