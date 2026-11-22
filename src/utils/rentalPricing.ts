/**
 * Authoritative frontend rental calculation & validation helper.
 * Strictly aligns with the server RPC create_rental_booking in Postgres:
 *
 * 1. Schedule checks:
 *    - Start and end dates must be provided and valid.
 *    - Start date cannot be in the past (with a 5-minute clock drift margin).
 *    - End date must be strictly after start date.
 *    - Maximum duration: 30 days (720 hours).
 *
 * 2. Rate determination:
 *    - If hourly_rate is provided and > 0, use hourly_rate directly.
 *    - Else if daily_rate is provided and > 0, convert via round(daily_rate / 24.0, 2).
 *    - Else fallback to 100.00/hr.
 *
 * 3. Duration:
 *    - Duration in hours is ceil(diffMs / 3600000), minimum 1 hour.
 *
 * 4. Subtotal & Deposit:
 *    - Rental subtotal = round(durationHours * effectiveRate, 2).
 *    - Deposit = vehicle.deposit_amount (or 0).
 *    - Total estimate = round(subtotal + deposit, 2).
 */

export interface RentalPricingInput {
  startDate: string | Date | null | undefined
  endDate: string | Date | null | undefined
  hourlyRate: number | null | undefined
  dailyRate: number | null | undefined
  depositAmount?: number | null | undefined
  now?: Date // Optional anchor for reproducible tests
}

export interface RentalPricingResult {
  isValid: boolean
  validationError?: string
  durationHours: number
  effectiveHourlyRate: number
  isDailyConverted: boolean
  rentalSubtotal: number
  depositAmount: number
  totalEstimate: number
}

export function calculateRentalPricing(input: RentalPricingInput): RentalPricingResult {
  const {
    startDate,
    endDate,
    hourlyRate,
    dailyRate,
    depositAmount = 0,
    now = new Date(),
  } = input

  const deposit = Math.max(0, Number(depositAmount) || 0)

  // 1. Determine effective hourly rate
  let effectiveHourlyRate = 100.0
  let isDailyConverted = false

  if (typeof hourlyRate === "number" && !isNaN(hourlyRate) && hourlyRate > 0) {
    effectiveHourlyRate = hourlyRate
    isDailyConverted = false
  } else if (typeof dailyRate === "number" && !isNaN(dailyRate) && dailyRate > 0) {
    effectiveHourlyRate = Math.round((dailyRate / 24.0) * 100) / 100
    isDailyConverted = true
  }

  // Check if inputs are provided
  if (!startDate || !endDate) {
    return {
      isValid: false,
      durationHours: 0,
      effectiveHourlyRate,
      isDailyConverted,
      rentalSubtotal: 0,
      depositAmount: deposit,
      totalEstimate: deposit,
    }
  }

  const start = new Date(startDate)
  const end = new Date(endDate)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      isValid: false,
      validationError: "Please enter valid reservation dates and times.",
      durationHours: 0,
      effectiveHourlyRate,
      isDailyConverted,
      rentalSubtotal: 0,
      depositAmount: deposit,
      totalEstimate: deposit,
    }
  }

  // Check past start time (5 minutes clock drift tolerance)
  const pastThreshold = now.getTime() - 5 * 60 * 1000
  if (start.getTime() < pastThreshold) {
    return {
      isValid: false,
      validationError: "Rental start time cannot be in the past.",
      durationHours: 0,
      effectiveHourlyRate,
      isDailyConverted,
      rentalSubtotal: 0,
      depositAmount: deposit,
      totalEstimate: deposit,
    }
  }

  // End time must be after start time
  if (end.getTime() <= start.getTime()) {
    return {
      isValid: false,
      validationError: "End time must be after start time.",
      durationHours: 0,
      effectiveHourlyRate,
      isDailyConverted,
      rentalSubtotal: 0,
      depositAmount: deposit,
      totalEstimate: deposit,
    }
  }

  const diffMs = end.getTime() - start.getTime()
  const durationHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)))

  // Maximum duration guard (30 days = 720 hours)
  if (durationHours > 720) {
    return {
      isValid: false,
      validationError: "Maximum rental booking duration is 30 days (720 hours).",
      durationHours,
      effectiveHourlyRate,
      isDailyConverted,
      rentalSubtotal: 0,
      depositAmount: deposit,
      totalEstimate: deposit,
    }
  }

  const rentalSubtotal = Math.round(durationHours * effectiveHourlyRate * 100) / 100
  const totalEstimate = Math.round((rentalSubtotal + deposit) * 100) / 100

  return {
    isValid: true,
    durationHours,
    effectiveHourlyRate,
    isDailyConverted,
    rentalSubtotal,
    depositAmount: deposit,
    totalEstimate,
  }
}
