import { describe, it, expect } from "vitest"

/**
 * Pure domain logic implementations matching database and application rules
 * for authoritative server-side booking pricing and validation.
 */
export function calculateRentalPricing(params: {
  startTime: string | Date
  endTime: string | Date
  hourlyRate: number | null
  dailyRate: number | null
  depositAmount: number | null
}) {
  const start = new Date(params.startTime)
  const end = new Date(params.endTime)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid Schedule: Start and end times must be valid timestamps.")
  }

  if (end.getTime() <= start.getTime()) {
    throw new Error("Invalid Schedule: Rental end time must be after the start time.")
  }

  // Calculate duration in hours rounded up to next integer, minimum 1 hour
  const durationHours = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60)))

  if (durationHours > 720) {
    throw new Error("Invalid Duration: Maximum rental booking duration is 30 days.")
  }

  let rate: number
  if (params.hourlyRate != null && params.hourlyRate > 0) {
    rate = params.hourlyRate
  } else if (params.dailyRate != null && params.dailyRate > 0) {
    rate = Math.round((params.dailyRate / 24) * 100) / 100
  } else {
    rate = 100.0
  }

  const totalPrice = Math.round(durationHours * rate * 100) / 100
  const deposit = params.depositAmount != null && params.depositAmount >= 0 ? params.depositAmount : 0

  return {
    durationHours,
    rate,
    totalPrice,
    depositAmount: deposit,
  }
}

export function validateRentalBooking(params: {
  renterId: string
  ownerId: string
  isVerifiedStudent: boolean
  startTime: string | Date
  endTime: string | Date
  vehicleStatus: string
  now?: number
}) {
  if (!params.isVerifiedStudent) {
    throw new Error("Verification Required: Only verified students can submit rental bookings.")
  }

  if (params.renterId === params.ownerId) {
    throw new Error("Invalid Booking: You cannot rent your own vehicle.")
  }

  if (params.vehicleStatus !== "available") {
    throw new Error("Vehicle Unavailable: Vehicle is not currently listed as available.")
  }

  const start = new Date(params.startTime).getTime()
  const currentNow = params.now ?? Date.now()

  // Allow up to 5 minutes clock skew for past bookings
  if (start < currentNow - 5 * 60 * 1000) {
    throw new Error("Invalid Schedule: Rental start time cannot be in the past.")
  }

  return true
}

export function calculateRidePricing(seatsRequested: number, pricePerSeat: number) {
  if (seatsRequested < 1 || seatsRequested > 8) {
    throw new Error("Invalid Seat Count: Requested seats must be between 1 and 8.")
  }
  const safePrice = Math.max(0, pricePerSeat)
  return Math.round(seatsRequested * safePrice * 100) / 100
}

export function validateRideSeatBooking(params: {
  passengerId: string
  driverId: string
  isVerifiedStudent: boolean
  seatsRequested: number
  availableSeats: number
  departureTime: string | Date
  rideStatus: string
  now?: number
}) {
  if (!params.isVerifiedStudent) {
    throw new Error("Verification Required: Only verified students can reserve ride seats.")
  }

  if (params.passengerId === params.driverId) {
    throw new Error("Invalid Request: Drivers cannot reserve seats on their own rides.")
  }

  if (params.rideStatus !== "scheduled") {
    throw new Error("Ride Closed: Cannot request seats on a ride that is not scheduled.")
  }

  const dep = new Date(params.departureTime).getTime()
  const currentNow = params.now ?? Date.now()

  if (dep <= currentNow) {
    throw new Error("Ride Departed: Cannot book seats on a ride that has already departed.")
  }

  if (params.seatsRequested < 1 || params.seatsRequested > 8) {
    throw new Error("Invalid Seat Count: Requested seats must be between 1 and 8.")
  }

  if (params.seatsRequested > params.availableSeats) {
    throw new Error(`Insufficient Seats: Only ${params.availableSeats} seat(s) available on this ride.`)
  }

  return true
}

describe("Server-Side Booking Price Integrity & Validation", () => {
  describe("Rental Price Calculation", () => {
    it("correctly calculates price based on hourly rate", () => {
      const now = new Date("2026-11-21T10:00:00Z")
      const end = new Date("2026-11-21T13:00:00Z") // 3 hours

      const result = calculateRentalPricing({
        startTime: now,
        endTime: end,
        hourlyRate: 50,
        dailyRate: null,
        depositAmount: 200,
      })

      expect(result.durationHours).toBe(3)
      expect(result.totalPrice).toBe(150)
      expect(result.depositAmount).toBe(200)
    })

    it("falls back to pro-rated daily rate when hourly rate is null", () => {
      const now = new Date("2026-11-21T10:00:00Z")
      const end = new Date("2026-11-21T14:00:00Z") // 4 hours

      const result = calculateRentalPricing({
        startTime: now,
        endTime: end,
        hourlyRate: null,
        dailyRate: 240, // 10/hour
        depositAmount: 500,
      })

      expect(result.durationHours).toBe(4)
      expect(result.rate).toBe(10)
      expect(result.totalPrice).toBe(40)
      expect(result.depositAmount).toBe(500)
    })

    it("enforces minimum 1 hour duration even for 15 minute bookings", () => {
      const now = new Date("2026-11-21T10:00:00Z")
      const end = new Date("2026-11-21T10:15:00Z") // 15 mins

      const result = calculateRentalPricing({
        startTime: now,
        endTime: end,
        hourlyRate: 60,
        dailyRate: null,
        depositAmount: 0,
      })

      expect(result.durationHours).toBe(1)
      expect(result.totalPrice).toBe(60)
    })

    it("rejects booking where end time is before or equal to start time", () => {
      const now = new Date("2026-11-21T10:00:00Z")
      const past = new Date("2026-11-21T09:00:00Z")

      expect(() => {
        calculateRentalPricing({
          startTime: now,
          endTime: past,
          hourlyRate: 50,
          dailyRate: null,
          depositAmount: 0,
        })
      }).toThrow("Rental end time must be after the start time")
    })

    it("rejects durations exceeding 30 days (720 hours)", () => {
      const start = new Date("2026-11-21T10:00:00Z")
      const end = new Date(start.getTime() + 31 * 24 * 60 * 60 * 1000) // 31 days

      expect(() => {
        calculateRentalPricing({
          startTime: start,
          endTime: end,
          hourlyRate: 50,
          dailyRate: null,
          depositAmount: 0,
        })
      }).toThrow("Maximum rental booking duration is 30 days")
    })
  })

  describe("Rental Booking Authorization & Conflict Validation", () => {
    it("rejects unauthorized booking by unverified student", () => {
      expect(() => {
        validateRentalBooking({
          renterId: "student-1",
          ownerId: "student-2",
          isVerifiedStudent: false,
          startTime: new Date(Date.now() + 60000),
          endTime: new Date(Date.now() + 3600000),
          vehicleStatus: "available",
        })
      }).toThrow("Verification Required: Only verified students can submit rental bookings.")
    })

    it("prevents students from renting their own vehicles", () => {
      expect(() => {
        validateRentalBooking({
          renterId: "student-same-id",
          ownerId: "student-same-id",
          isVerifiedStudent: true,
          startTime: new Date(Date.now() + 60000),
          endTime: new Date(Date.now() + 3600000),
          vehicleStatus: "available",
        })
      }).toThrow("Invalid Booking: You cannot rent your own vehicle.")
    })

    it("rejects booking when vehicle is not available (e.g. maintenance or rented)", () => {
      expect(() => {
        validateRentalBooking({
          renterId: "student-1",
          ownerId: "student-2",
          isVerifiedStudent: true,
          startTime: new Date(Date.now() + 60000),
          endTime: new Date(Date.now() + 3600000),
          vehicleStatus: "maintenance",
        })
      }).toThrow("Vehicle Unavailable: Vehicle is not currently listed as available.")
    })

    it("rejects booking starting in the past", () => {
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000
      expect(() => {
        validateRentalBooking({
          renterId: "student-1",
          ownerId: "student-2",
          isVerifiedStudent: true,
          startTime: new Date(tenMinutesAgo),
          endTime: new Date(Date.now() + 3600000),
          vehicleStatus: "available",
        })
      }).toThrow("Rental start time cannot be in the past.")
    })
  })

  describe("Ride Price & Seat Management", () => {
    it("calculates total price strictly as seats * price_per_seat", () => {
      expect(calculateRidePricing(3, 45)).toBe(135)
      expect(calculateRidePricing(1, 100)).toBe(100)
      expect(calculateRidePricing(2, 0)).toBe(0) // Free campus ride
    })

    it("rejects invalid seat requests outside 1 to 8 range", () => {
      expect(() => calculateRidePricing(0, 50)).toThrow("between 1 and 8")
      expect(() => calculateRidePricing(9, 50)).toThrow("between 1 and 8")
    })

    it("rejects driver booking seats on their own ride", () => {
      expect(() => {
        validateRideSeatBooking({
          passengerId: "driver-123",
          driverId: "driver-123",
          isVerifiedStudent: true,
          seatsRequested: 1,
          availableSeats: 3,
          departureTime: new Date(Date.now() + 3600000),
          rideStatus: "scheduled",
        })
      }).toThrow("Drivers cannot reserve seats on their own rides.")
    })

    it("rejects seat request exceeding available seats", () => {
      expect(() => {
        validateRideSeatBooking({
          passengerId: "passenger-1",
          driverId: "driver-2",
          isVerifiedStudent: true,
          seatsRequested: 3,
          availableSeats: 2, // only 2 left
          departureTime: new Date(Date.now() + 3600000),
          rideStatus: "scheduled",
        })
      }).toThrow("Insufficient Seats: Only 2 seat(s) available on this ride.")
    })

    it("rejects booking on departed or closed rides", () => {
      expect(() => {
        validateRideSeatBooking({
          passengerId: "passenger-1",
          driverId: "driver-2",
          isVerifiedStudent: true,
          seatsRequested: 1,
          availableSeats: 3,
          departureTime: new Date(Date.now() - 60000), // departed 1 min ago
          rideStatus: "scheduled",
        })
      }).toThrow("Ride Departed: Cannot book seats on a ride that has already departed.")
    })
  })
})
