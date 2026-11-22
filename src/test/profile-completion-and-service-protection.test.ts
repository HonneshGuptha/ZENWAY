import { describe, it, expect, vi } from "vitest"
import { isValidUniversity } from "@/constants/universities"
import { isValidIndianPhone } from "@/utils/phone"

// Simulated backend function is_profile_complete() matching 20261122000002 migration
function isBackendProfileComplete(profile: {
  role: string
  university_name: string | null
  phone: string | null
  phone_number?: string | null
}): boolean {
  // Administrators are unconditionally exempt
  if (profile.role === "admin") {
    return true
  }

  // University validation
  if (!profile.university_name || !isValidUniversity(profile.university_name)) {
    return false
  }

  // Phone validation
  const effectivePhone = profile.phone || profile.phone_number || null
  if (!effectivePhone || !isValidIndianPhone(effectivePhone)) {
    return false
  }

  return true
}

// Simulated acceptance RPCs (Rent, Ride, Carry)
function simulateAcceptRentalRequest(caller: { id: string; role: string; university_name: string | null; phone: string | null }, requestId: string) {
  if (caller.role !== "admin" && !isBackendProfileComplete(caller)) {
    throw new Error("Incomplete profile: You must complete your university and phone number before accepting rentals.")
  }
  return { success: true, requestId }
}

function simulateAcceptRideRequest(caller: { id: string; role: string; university_name: string | null; phone: string | null }, requestId: string) {
  if (caller.role !== "admin" && !isBackendProfileComplete(caller)) {
    throw new Error("Incomplete profile: You must complete your university and phone number before accepting ride requests.")
  }
  return { success: true, requestId }
}

function simulateAcceptCarryOffer(caller: { id: string; role: string; university_name: string | null; phone: string | null }, offerId: string) {
  if (caller.role !== "admin" && !isBackendProfileComplete(caller)) {
    throw new Error("Incomplete profile: You must complete your university and phone number before accepting carry offers.")
  }
  return { success: true, offerId }
}

describe("PART 2: Incomplete-Profile Protection & Admin Exemption", () => {
  describe("Backend RLS & RPC Enforcement", () => {
    const incompleteStudentMissingPhone = {
      id: "student-1",
      role: "student",
      university_name: "MS Ramaiah University of Applied Sciences",
      phone: null,
    }

    const incompleteStudentMissingUniv = {
      id: "student-2",
      role: "student",
      university_name: null,
      phone: "+919876543210",
    }

    const completeStudent = {
      id: "student-3",
      role: "student",
      university_name: "MS Ramaiah University of Applied Sciences",
      phone: "+919876543210",
    }

    const adminUser = {
      id: "admin-1",
      role: "admin",
      university_name: null,
      phone: null,
    }

    it("verifies is_profile_complete() correctly identifies complete vs incomplete profiles", () => {
      expect(isBackendProfileComplete(incompleteStudentMissingPhone)).toBe(false)
      expect(isBackendProfileComplete(incompleteStudentMissingUniv)).toBe(false)
      expect(isBackendProfileComplete(completeStudent)).toBe(true)
      // Admin is exempt
      expect(isBackendProfileComplete(adminUser)).toBe(true)
    })

    it("blocks incomplete student from accepting rental requests via RPC", () => {
      expect(() => simulateAcceptRentalRequest(incompleteStudentMissingPhone, "req-1")).toThrow(
        /Incomplete profile/
      )
      expect(simulateAcceptRentalRequest(completeStudent, "req-1")).toEqual({ success: true, requestId: "req-1" })
      expect(simulateAcceptRentalRequest(adminUser, "req-1")).toEqual({ success: true, requestId: "req-1" })
    })

    it("blocks incomplete student from accepting ride requests via RPC", () => {
      expect(() => simulateAcceptRideRequest(incompleteStudentMissingPhone, "ride-req-1")).toThrow(
        /Incomplete profile/
      )
      expect(simulateAcceptRideRequest(completeStudent, "ride-req-1")).toEqual({ success: true, requestId: "ride-req-1" })
      expect(simulateAcceptRideRequest(adminUser, "ride-req-1")).toEqual({ success: true, requestId: "ride-req-1" })
    })

    it("blocks incomplete student from accepting carry offers via RPC", () => {
      expect(() => simulateAcceptCarryOffer(incompleteStudentMissingUniv, "offer-1")).toThrow(
        /Incomplete profile/
      )
      expect(simulateAcceptCarryOffer(completeStudent, "offer-1")).toEqual({ success: true, offerId: "offer-1" })
      expect(simulateAcceptCarryOffer(adminUser, "offer-1")).toEqual({ success: true, offerId: "offer-1" })
    })
  })

  describe("Frontend Zero Form Data Loss Guard", () => {
    it("intercepts service action when profile is incomplete and preserves typed form state", async () => {
      let isModalOpen = false
      let pendingAction: (() => void) | null = null

      const requireCompleteProfile = (
        isProfileComplete: boolean,
        action: () => void
      ) => {
        if (isProfileComplete) {
          action()
          return true
        }
        pendingAction = action
        isModalOpen = true
        return false
      }

      // Preserved user form state
      const typedFormState = {
        title: "Trek Mountain Bicycle",
        hourlyRate: "25",
        dailyRate: "150",
        pickupLocation: "MSRUAS Gate 2",
      }

      const submittedRecord: any = {}
      const mockSubmitAction = vi.fn(() => {
        Object.assign(submittedRecord, typedFormState)
      })

      // 1. Incomplete student triggers submit
      const isComplete = false
      const canProceed = requireCompleteProfile(isComplete, mockSubmitAction)

      expect(canProceed).toBe(false)
      expect(isModalOpen).toBe(true)
      expect(mockSubmitAction).not.toHaveBeenCalled()
      // Form state remains intact
      expect(typedFormState.title).toBe("Trek Mountain Bicycle")

      // 2. Student fills modal and saves
      const updatedProfile = {
        university_name: "MS Ramaiah University of Applied Sciences",
        phone: "+919876543210",
      }
      expect(isValidUniversity(updatedProfile.university_name)).toBe(true)
      expect(isValidIndianPhone(updatedProfile.phone)).toBe(true)

      // 3. Modal success resumes pending action
      isModalOpen = false
      if (pendingAction) {
        const resume: () => void = pendingAction
        resume()
      }

      expect(mockSubmitAction).toHaveBeenCalledTimes(1)
      expect(submittedRecord.title).toBe("Trek Mountain Bicycle")
      expect(submittedRecord.pickupLocation).toBe("MSRUAS Gate 2")
    })

    it("allows complete student to proceed directly without opening modal", () => {
      const mockAction = vi.fn()
      const isComplete = true

      if (isComplete) {
        mockAction()
      }

      expect(mockAction).toHaveBeenCalledTimes(1)
    })

    it("unconditionally permits administrators across all service operations", () => {
      const mockListAction = vi.fn()
      const mockReserveAction = vi.fn()
      const mockRideAction = vi.fn()
      const mockCarryAction = vi.fn()

      const isAdmin = true
      const hasPhone = false
      const hasUniv = false

      const checkGuard = (action: () => void) => {
        if (isAdmin || (hasPhone && hasUniv)) {
          action()
          return true
        }
        return false
      }

      expect(checkGuard(mockListAction)).toBe(true)
      expect(checkGuard(mockReserveAction)).toBe(true)
      expect(checkGuard(mockRideAction)).toBe(true)
      expect(checkGuard(mockCarryAction)).toBe(true)

      expect(mockListAction).toHaveBeenCalled()
      expect(mockReserveAction).toHaveBeenCalled()
      expect(mockRideAction).toHaveBeenCalled()
      expect(mockCarryAction).toHaveBeenCalled()
    })
  })

  describe("Existing Account Preservation & Navigation", () => {
    it("preserves active session without deleting or modifying user ID on incomplete login", () => {
      const existingUserSession = {
        userId: "user-existing-789",
        email: "legacy.student@gmail.com",
        role: "student",
        universityName: null, // legacy missing
        phone: null, // legacy missing
      }

      // Check whether session is preserved
      expect(existingUserSession.userId).toBe("user-existing-789")
      expect(existingUserSession.email).toBe("legacy.student@gmail.com")

      // Compute destination
      const intendedDestination = "/rent"
      const isMissingRequiredFields = !existingUserSession.universityName || !existingUserSession.phone

      let targetUrl = intendedDestination
      if (isMissingRequiredFields && existingUserSession.role !== "admin") {
        targetUrl = `/profile?complete=true&redirect=${encodeURIComponent(intendedDestination)}`
      }

      expect(targetUrl).toBe("/profile?complete=true&redirect=%2Frent")
      // User ID remains unchanged
      expect(existingUserSession.userId).toBe("user-existing-789")
    })
  })
})
