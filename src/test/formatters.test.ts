import { describe, it, expect } from "vitest"
import {
  getStudentInitials,
  formatReadableDateTime,
  formatReadableDate,
  formatDisputeReason,
} from "@/utils/formatters"

describe("formatters utility suite", () => {
  describe("getStudentInitials", () => {
    it("extracts first and last initial for multi-word full names", () => {
      expect(getStudentInitials("Honnesh Guptaha")).toBe("HG")
      expect(getStudentInitials("Aarav Kumar Sharma")).toBe("AS")
    })

    it("extracts first two characters for single-word full names", () => {
      expect(getStudentInitials("Prakhar")).toBe("PR")
    })

    it("falls back to email initials if full name is missing or empty", () => {
      expect(getStudentInitials(null, "student@msruas.ac.in")).toBe("ST")
      expect(getStudentInitials("", "john.doe@example.com")).toBe("JO")
    })

    it("returns ST as absolute default if both are empty", () => {
      expect(getStudentInitials(null, null)).toBe("ST")
    })
  })

  describe("formatReadableDateTime", () => {
    it("formats ISO timestamps without seconds", () => {
      const formatted = formatReadableDateTime("2026-11-23T17:30:00Z")
      expect(formatted).toBeTruthy()
      expect(formatted).not.toContain(":00:")
      // Should contain date elements
      expect(formatted).toMatch(/Nov|11/)
    })

    it("gracefully handles invalid date strings", () => {
      expect(formatReadableDateTime("not-a-date")).toBe("not-a-date")
      expect(formatReadableDateTime(null)).toBe("")
    })
  })

  describe("formatReadableDate", () => {
    it("formats dates clearly", () => {
      const formatted = formatReadableDate("2026-11-23T17:30:00Z")
      expect(formatted).toContain("2026")
    })
  })

  describe("formatDisputeReason", () => {
    it("converts snake_case incident strings to title case", () => {
      expect(formatDisputeReason("property_damage")).toBe("Property Damage")
      expect(formatDisputeReason("late_return")).toBe("Late Return")
      expect(formatDisputeReason("unauthorized_driver")).toBe("Unauthorized Driver")
    })

    it("handles empty or null values gracefully", () => {
      expect(formatDisputeReason(null)).toBe("Unspecified Incident")
      expect(formatDisputeReason("")).toBe("Unspecified Incident")
    })
  })
})
