import { describe, it, expect } from "vitest"
import { calculateRentalPricing } from "../utils/rentalPricing"

describe("Rental Pricing & Schedule Calculation", () => {
  const baseNow = new Date("2026-11-22T10:00:00Z")

  it("calculates accurate subtotal for integer hourly rate and exact hours", () => {
    const start = "2026-11-22T11:00:00Z"
    const end = "2026-11-22T14:00:00Z" // 3 hours

    const result = calculateRentalPricing({
      startDate: start,
      endDate: end,
      hourlyRate: 60,
      dailyRate: null,
      depositAmount: 200,
      now: baseNow,
    })

    expect(result.isValid).toBe(true)
    expect(result.durationHours).toBe(3)
    expect(result.effectiveHourlyRate).toBe(60)
    expect(result.rentalSubtotal).toBe(180)
    expect(result.depositAmount).toBe(200)
    expect(result.totalEstimate).toBe(380)
  })

  it("handles fractional hourly rates cleanly with two-decimal precision", () => {
    const start = "2026-11-22T11:00:00Z"
    const end = "2026-11-22T13:00:00Z" // 2 hours

    const result = calculateRentalPricing({
      startDate: start,
      endDate: end,
      hourlyRate: 45.5,
      dailyRate: null,
      depositAmount: 100,
      now: baseNow,
    })

    expect(result.isValid).toBe(true)
    expect(result.durationHours).toBe(2)
    expect(result.effectiveHourlyRate).toBe(45.5)
    expect(result.rentalSubtotal).toBe(91)
    expect(result.totalEstimate).toBe(191)
  })

  it("converts daily rate to hourly rate matching Postgres round(v_daily_rate / 24.0, 2)", () => {
    const start = "2026-11-22T12:00:00Z"
    const end = "2026-11-22T18:00:00Z" // 6 hours

    // 250 / 24 = 10.41666... rounded to 2 decimal places is 10.42
    const result = calculateRentalPricing({
      startDate: start,
      endDate: end,
      hourlyRate: null,
      dailyRate: 250,
      depositAmount: 500,
      now: baseNow,
    })

    expect(result.isValid).toBe(true)
    expect(result.isDailyConverted).toBe(true)
    expect(result.effectiveHourlyRate).toBe(10.42)
    expect(result.durationHours).toBe(6)
    expect(result.rentalSubtotal).toBe(62.52) // 6 * 10.42 = 62.52
    expect(result.depositAmount).toBe(500)
    expect(result.totalEstimate).toBe(562.52)
  })

  it("enforces minimum 1 hour duration for short rentals under 60 minutes", () => {
    const start = "2026-11-22T11:00:00Z"
    const end = "2026-11-22T11:25:00Z" // 25 minutes

    const result = calculateRentalPricing({
      startDate: start,
      endDate: end,
      hourlyRate: 40,
      dailyRate: null,
      depositAmount: 0,
      now: baseNow,
    })

    expect(result.isValid).toBe(true)
    expect(result.durationHours).toBe(1)
    expect(result.rentalSubtotal).toBe(40)
    expect(result.totalEstimate).toBe(40)
  })

  it("rounds up fractional duration to next full hour (ceil)", () => {
    const start = "2026-11-22T11:00:00Z"
    const end = "2026-11-22T12:05:00Z" // 1 hour 5 minutes -> 2 hours

    const result = calculateRentalPricing({
      startDate: start,
      endDate: end,
      hourlyRate: 50,
      dailyRate: null,
      depositAmount: 0,
      now: baseNow,
    })

    expect(result.isValid).toBe(true)
    expect(result.durationHours).toBe(2)
    expect(result.rentalSubtotal).toBe(100)
  })

  it("falls back to default 100/hr when both hourly and daily rates are omitted or 0", () => {
    const start = "2026-11-22T11:00:00Z"
    const end = "2026-11-22T13:00:00Z" // 2 hours

    const result = calculateRentalPricing({
      startDate: start,
      endDate: end,
      hourlyRate: null,
      dailyRate: null,
      depositAmount: 0,
      now: baseNow,
    })

    expect(result.isValid).toBe(true)
    expect(result.effectiveHourlyRate).toBe(100)
    expect(result.durationHours).toBe(2)
    expect(result.rentalSubtotal).toBe(200)
  })

  it("rejects invalid reversed date ranges (end before or equal to start)", () => {
    const start = "2026-11-22T14:00:00Z"
    const end = "2026-11-22T12:00:00Z" // reversed

    const result = calculateRentalPricing({
      startDate: start,
      endDate: end,
      hourlyRate: 50,
      dailyRate: null,
      now: baseNow,
    })

    expect(result.isValid).toBe(false)
    expect(result.validationError).toBe("End time must be after start time.")
  })

  it("rejects rental start time in the past beyond 5-minute clock drift margin", () => {
    const pastStart = new Date(baseNow.getTime() - 10 * 60 * 1000).toISOString() // 10 minutes ago
    const futureEnd = new Date(baseNow.getTime() + 60 * 60 * 1000).toISOString()

    const result = calculateRentalPricing({
      startDate: pastStart,
      endDate: futureEnd,
      hourlyRate: 50,
      dailyRate: null,
      now: baseNow,
    })

    expect(result.isValid).toBe(false)
    expect(result.validationError).toBe("Rental start time cannot be in the past.")
  })

  it("allows start time within 5-minute past clock drift tolerance", () => {
    const slightPastStart = new Date(baseNow.getTime() - 3 * 60 * 1000).toISOString() // 3 minutes ago
    const futureEnd = new Date(baseNow.getTime() + 60 * 60 * 1000).toISOString()

    const result = calculateRentalPricing({
      startDate: slightPastStart,
      endDate: futureEnd,
      hourlyRate: 50,
      dailyRate: null,
      now: baseNow,
    })

    expect(result.isValid).toBe(true)
    expect(result.durationHours).toBeGreaterThanOrEqual(1)
  })

  it("rejects rentals exceeding maximum 30 days (720 hours)", () => {
    const start = "2026-11-22T10:00:00Z"
    const end = "2026-12-25T10:00:00Z" // 33 days = 792 hours

    const result = calculateRentalPricing({
      startDate: start,
      endDate: end,
      hourlyRate: 50,
      dailyRate: null,
      now: baseNow,
    })

    expect(result.isValid).toBe(false)
    expect(result.validationError).toBe("Maximum rental booking duration is 30 days (720 hours).")
  })
})
