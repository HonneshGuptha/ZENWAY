import { describe, it, expect } from "vitest"
import {
  isValidUniversity,
  normalizeUniversity,
  SUPPORTED_UNIVERSITIES,
  DEFAULT_UNIVERSITY,
} from "@/constants/universities"
import {
  isValidIndianPhone,
  normalizeIndianPhone,
  formatIndianPhoneDisplay,
} from "@/utils/phone"

describe("PART 1: Mandatory Student Registration & Validation", () => {
  describe("University Validation & Selection", () => {
    it("recognizes only the designated supported university option", () => {
      expect(SUPPORTED_UNIVERSITIES).toHaveLength(1)
      expect(SUPPORTED_UNIVERSITIES[0].name).toBe("MS Ramaiah University of Applied Sciences")
      expect(DEFAULT_UNIVERSITY).toBe("MS Ramaiah University of Applied Sciences")
    })

    it("accepts official MS Ramaiah University of Applied Sciences name", () => {
      expect(isValidUniversity("MS Ramaiah University of Applied Sciences")).toBe(true)
      expect(isValidUniversity("  ms ramaiah university of applied sciences  ")).toBe(true)
    })

    it("safely normalizes legacy MSRUAS shorthand without failing existing accounts", () => {
      expect(isValidUniversity("MSRUAS")).toBe(true)
      expect(normalizeUniversity("MSRUAS")).toBe("MS Ramaiah University of Applied Sciences")
      expect(normalizeUniversity("msruas")).toBe("MS Ramaiah University of Applied Sciences")
    })

    it("rejects unsupported, arbitrary, or blank university names", () => {
      expect(isValidUniversity("")).toBe(false)
      expect(isValidUniversity(null)).toBe(false)
      expect(isValidUniversity(undefined)).toBe(false)
      expect(isValidUniversity("Harvard University")).toBe(false)
      expect(isValidUniversity("State University")).toBe(false)
      expect(isValidUniversity("MIT")).toBe(false)
      expect(normalizeUniversity("Random University")).toBeNull()
    })
  })

  describe("Indian Mobile Phone Normalization & Canonicalization", () => {
    it("accepts valid 10-digit Indian mobile numbers starting with 6, 7, 8, 9", () => {
      expect(isValidIndianPhone("9876543210")).toBe(true)
      expect(isValidIndianPhone("8123456789")).toBe(true)
      expect(isValidIndianPhone("7012345678")).toBe(true)
      expect(isValidIndianPhone("6398765432")).toBe(true)
    })

    it("normalizes diverse input formats into canonical +91XXXXXXXXXX format", () => {
      // Raw 10 digits
      expect(normalizeIndianPhone("9876543210")).toBe("+919876543210")
      // With +91
      expect(normalizeIndianPhone("+91 98765 43210")).toBe("+919876543210")
      expect(normalizeIndianPhone("+91-9876543210")).toBe("+919876543210")
      expect(normalizeIndianPhone("+919876543210")).toBe("+919876543210")
      // With 91 prefix without plus
      expect(normalizeIndianPhone("919876543210")).toBe("+919876543210")
      // With leading 0 (trunk prefix)
      expect(normalizeIndianPhone("09876543210")).toBe("+919876543210")
      // With spaces and hyphens
      expect(normalizeIndianPhone("98765-43210")).toBe("+919876543210")
      expect(normalizeIndianPhone("  +91 9876-543-210  ")).toBe("+919876543210")
    })

    it("rejects invalid prefixes (0-5), incomplete numbers, and arbitrary text", () => {
      // Invalid starting digits in India
      expect(isValidIndianPhone("5123456789")).toBe(false)
      expect(isValidIndianPhone("1234567890")).toBe(false)
      expect(isValidIndianPhone("0123456789")).toBe(false)
      // Incomplete numbers
      expect(isValidIndianPhone("98765")).toBe(false)
      expect(isValidIndianPhone("987654321")).toBe(false)
      // Excessive digits
      expect(isValidIndianPhone("987654321000")).toBe(false)
      // Arbitrary text / symbols
      expect(isValidIndianPhone("not-a-number")).toBe(false)
      expect(isValidIndianPhone("")).toBe(false)
      expect(isValidIndianPhone(null)).toBe(false)
      expect(isValidIndianPhone(undefined)).toBe(false)
      expect(normalizeIndianPhone("abcdefghij")).toBeNull()
    })

    it("formats Indian phone numbers cleanly for human display without leaking private data", () => {
      expect(formatIndianPhoneDisplay("+919876543210")).toBe("+91 98765 43210")
      expect(formatIndianPhoneDisplay("9876543210")).toBe("+91 98765 43210")
    })
  })

  describe("Signup Payload & Email Confirmation Compatibility", () => {
    it("prepares complete auth metadata with normalized phone and university for handle_new_user trigger", () => {
      const rawInput = {
        fullName: "Honnesh Guptha",
        email: "student@msruas.ac.in",
        password: "securepassword123",
        universityName: "MS Ramaiah University of Applied Sciences",
        phoneNumber: "+91 98765 43210",
      }

      const normalizedUniv = normalizeUniversity(rawInput.universityName)
      const normalizedPhone = normalizeIndianPhone(rawInput.phoneNumber)

      expect(normalizedUniv).toBe("MS Ramaiah University of Applied Sciences")
      expect(normalizedPhone).toBe("+919876543210")

      // Simulated metadata passed to supabase.auth.signUp({ options: { data: { ... } } })
      const signUpMetadata = {
        full_name: rawInput.fullName.trim(),
        university: normalizedUniv,
        university_name: normalizedUniv,
        phone: normalizedPhone,
        phone_number: normalizedPhone,
      }

      expect(signUpMetadata.full_name).toBe("Honnesh Guptha")
      expect(signUpMetadata.university).toBe("MS Ramaiah University of Applied Sciences")
      expect(signUpMetadata.university_name).toBe("MS Ramaiah University of Applied Sciences")
      expect(signUpMetadata.phone).toBe("+919876543210")
      expect(signUpMetadata.phone_number).toBe("+919876543210")
    })

    it("rejects signup when any of the 5 mandatory fields are missing or invalid", () => {
      const validateRegistration = (data: {
        fullName?: string
        email?: string
        password?: string
        university?: string
        phone?: string
      }) => {
        if (!data.fullName || data.fullName.trim().length < 2) {
          return { valid: false, error: "Full name must be at least 2 characters." }
        }
        if (!data.email || !data.email.includes("@")) {
          return { valid: false, error: "Valid email address required." }
        }
        if (!data.password || data.password.length < 8) {
          return { valid: false, error: "Password must be at least 8 characters." }
        }
        if (!isValidUniversity(data.university)) {
          return { valid: false, error: "Supported university required." }
        }
        if (!isValidIndianPhone(data.phone)) {
          return { valid: false, error: "Valid 10-digit Indian mobile required." }
        }
        return { valid: true }
      }

      // Missing name
      expect(validateRegistration({ email: "a@b.com", password: "password123", university: DEFAULT_UNIVERSITY, phone: "9876543210" }).valid).toBe(false)
      // Missing email
      expect(validateRegistration({ fullName: "Alex M", password: "password123", university: DEFAULT_UNIVERSITY, phone: "9876543210" }).valid).toBe(false)
      // Short password
      expect(validateRegistration({ fullName: "Alex M", email: "a@b.com", password: "short", university: DEFAULT_UNIVERSITY, phone: "9876543210" }).valid).toBe(false)
      // Invalid university
      expect(validateRegistration({ fullName: "Alex M", email: "a@b.com", password: "password123", university: "Fake University", phone: "9876543210" }).valid).toBe(false)
      // Invalid phone
      expect(validateRegistration({ fullName: "Alex M", email: "a@b.com", password: "password123", university: DEFAULT_UNIVERSITY, phone: "12345" }).valid).toBe(false)
      // All valid
      expect(validateRegistration({ fullName: "Alex M", email: "a@b.com", password: "password123", university: DEFAULT_UNIVERSITY, phone: "9876543210" }).valid).toBe(true)
    })
  })
})
