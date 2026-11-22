import { describe, it, expect } from "vitest"
import {
  CAMPUS_LOCATION,
  POPULAR_LOCALITIES,
  type RideDirection,
  getRideDirection,
  isCampusLocation,
  normalizeHubName,
  calculateBarWidth,
} from "../constants/campus"

describe("Campus-Anchored Routing Constants & Utilities", () => {
  it("exports the authoritative campus location", () => {
    expect(CAMPUS_LOCATION).toBe("RUAS Peenya Campus")
  })

  it("exports all popular student localities", () => {
    expect(POPULAR_LOCALITIES).toEqual([
      "Vijayanagar",
      "RPC Layout",
      "Yeshwanthpur",
      "Rajajinagar",
      "Jalahalli",
      "Kamakshipalya",
    ])
  })

  it("identifies campus locations flexibly", () => {
    expect(isCampusLocation("RUAS Peenya Campus")).toBe(true)
    expect(isCampusLocation("MSRUAS gate 3")).toBe(true)
    expect(isCampusLocation("Ramaiah University")).toBe(true)
    expect(isCampusLocation("Peenya campus")).toBe(true)
    expect(isCampusLocation("rtc campus")).toBe(true)
    expect(isCampusLocation("College main gate")).toBe(true)
    expect(isCampusLocation("Vijayanagar Metro")).toBe(false)
    expect(isCampusLocation("Yeshwanthpur")).toBe(false)
    expect(isCampusLocation(null)).toBe(false)
    expect(isCampusLocation(undefined)).toBe(false)
  })

  it("determines 'to_college' when destination is locked or matches campus keywords", () => {
    expect(getRideDirection("Vijayanagar", "RUAS Peenya Campus")).toBe("to_college")
    expect(getRideDirection("Rajajinagar", "MSRUAS gate 3")).toBe("to_college")
    expect(getRideDirection("Jalahalli", "Ramaiah University")).toBe("to_college")
    expect(getRideDirection("Kamakshipalya", "College")).toBe("to_college")
  })

  it("determines 'from_college' when pickup is locked or matches campus keywords", () => {
    expect(getRideDirection("RUAS Peenya Campus", "Vijayanagar")).toBe("from_college")
    expect(getRideDirection("MSRUAS gate 3", "Rajajinagar")).toBe("from_college")
    expect(getRideDirection("RTC campus", "Kamakshipalya")).toBe("from_college")
    expect(getRideDirection("Peenya Campus", "Yeshwanthpur")).toBe("from_college")
  })

  it("returns null for non-campus routes", () => {
    expect(getRideDirection("Vijayanagar", "Yeshwanthpur")).toBeNull()
  })
})

describe("Post Ride Form Route Derivation", () => {
  function deriveRidePayload(direction: RideDirection, locality: string) {
    const trimmedLocality = locality.trim()
    if (!trimmedLocality) {
      throw new Error(
        direction === "to_college"
          ? "Please enter your pickup area."
          : "Please enter your drop-off area."
      )
    }

    const pickup = direction === "to_college" ? trimmedLocality : CAMPUS_LOCATION
    const destination = direction === "to_college" ? CAMPUS_LOCATION : trimmedLocality

    return {
      pickup,
      destination,
      origin_name: pickup,
      destination_name: destination,
    }
  }

  it("correctly derives 'To College' route payload with pickup as locality and destination locked to campus", () => {
    const payload = deriveRidePayload("to_college", "Vijayanagar")
    expect(payload.pickup).toBe("Vijayanagar")
    expect(payload.destination).toBe("RUAS Peenya Campus")
    expect(payload.origin_name).toBe("Vijayanagar")
    expect(payload.destination_name).toBe("RUAS Peenya Campus")
  })

  it("correctly derives 'From College' route payload with pickup locked to campus and destination as locality", () => {
    const payload = deriveRidePayload("from_college", "Rajajinagar")
    expect(payload.pickup).toBe("RUAS Peenya Campus")
    expect(payload.destination).toBe("Rajajinagar")
    expect(payload.origin_name).toBe("RUAS Peenya Campus")
    expect(payload.destination_name).toBe("Rajajinagar")
  })

  it("trims whitespace from the entered locality", () => {
    const payload = deriveRidePayload("to_college", "   Yeshwanthpur   ")
    expect(payload.pickup).toBe("Yeshwanthpur")
    expect(payload.destination).toBe("RUAS Peenya Campus")
  })

  it("rejects empty locality input", () => {
    expect(() => deriveRidePayload("to_college", "   ")).toThrow("Please enter your pickup area.")
    expect(() => deriveRidePayload("from_college", "")).toThrow("Please enter your drop-off area.")
  })
})

describe("Ride Feed & Direction Filtering", () => {
  interface MockRide {
    id: string
    origin_name: string
    destination_name: string
    pickup?: string
    destination?: string
    driver?: { full_name: string | null }
  }

  const sampleRides: MockRide[] = [
    {
      id: "1",
      origin_name: "Vijayanagar",
      destination_name: "RUAS Peenya Campus",
      pickup: "Vijayanagar",
      destination: "RUAS Peenya Campus",
      driver: { full_name: "Aarav Sharma" },
    },
    {
      id: "2",
      origin_name: "RUAS Peenya Campus",
      destination_name: "Rajajinagar",
      pickup: "RUAS Peenya Campus",
      destination: "Rajajinagar",
      driver: { full_name: "Diya Rao" },
    },
    {
      id: "3",
      origin_name: "Yeshwanthpur",
      destination_name: "MSRUAS gate 3",
      pickup: "Yeshwanthpur",
      destination: "MSRUAS gate 3",
      driver: { full_name: "Karan Patel" },
    },
    {
      id: "4",
      origin_name: "Ramaiah University Peenya",
      destination_name: "Jalahalli",
      pickup: "Ramaiah University Peenya",
      destination: "Jalahalli",
      driver: { full_name: "Pooja Hegde" },
    },
  ]

  function filterRides(
    rides: MockRide[],
    feedDirection: "all" | RideDirection,
    searchQuery: string = ""
  ) {
    return rides.filter((r) => {
      const pickupVal = r.pickup || r.origin_name || ""
      const destVal = r.destination || r.destination_name || ""

      if (feedDirection === "to_college") {
        if (destVal !== CAMPUS_LOCATION && !isCampusLocation(destVal)) {
          return false
        }
      } else if (feedDirection === "from_college") {
        if (pickupVal !== CAMPUS_LOCATION && !isCampusLocation(pickupVal)) {
          return false
        }
      }

      const q = searchQuery.toLowerCase().trim()
      if (!q) return true
      return (
        pickupVal.toLowerCase().includes(q) ||
        destVal.toLowerCase().includes(q) ||
        (r.driver?.full_name || "").toLowerCase().includes(q)
      )
    })
  }

  it("returns all rides when direction filter is 'all'", () => {
    const results = filterRides(sampleRides, "all")
    expect(results.length).toBe(4)
  })

  it("filters for rides heading 'to_college' including flexible campus names", () => {
    const results = filterRides(sampleRides, "to_college")
    expect(results.length).toBe(2)
    expect(results.map((r) => r.id)).toEqual(["1", "3"])
  })

  it("filters for rides heading 'from_college' including flexible campus names", () => {
    const results = filterRides(sampleRides, "from_college")
    expect(results.length).toBe(2)
    expect(results.map((r) => r.id)).toEqual(["2", "4"])
  })

  it("allows search within a direction filter tab", () => {
    const collegeResults = filterRides(sampleRides, "to_college", "Vijayanagar")
    expect(collegeResults.length).toBe(1)
    expect(collegeResults[0].id).toBe("1")

    const homeResults = filterRides(sampleRides, "from_college", "jalahalli")
    expect(homeResults.length).toBe(1)
    expect(homeResults[0].id).toBe("4")
  })
})

describe("Dynamic Hub Normalization & Demand Bar Calculation", () => {
  it("normalizes hub names by trimming, collapsing spaces, and lowercasing", () => {
    expect(normalizeHubName("  Nagarabhavi  ")).toBe("nagarabhavi")
    expect(normalizeHubName("RPC    Layout")).toBe("rpc layout")
    expect(normalizeHubName("Vijayanagar  1st   Stage")).toBe("vijayanagar 1st stage")
    expect(normalizeHubName("MSRUAS   Main   Gate")).toBe("msruas main gate")
    expect(normalizeHubName("")).toBe("")
    expect(normalizeHubName(null)).toBe("")
    expect(normalizeHubName(undefined)).toBe("")
  })

  it("calculates bar width percentages with 12% minimum visual baseline", () => {
    // Single request out of 100 max: baseline 12%
    expect(calculateBarWidth(1, 100)).toBe(12)

    // 50 requests out of 100: 50%
    expect(calculateBarWidth(50, 100)).toBe(50)

    // Highest demand request (100 out of 100): 100%
    expect(calculateBarWidth(100, 100)).toBe(100)

    // 25 out of 50: 50%
    expect(calculateBarWidth(25, 50)).toBe(50)

    // 5 out of 20: 25%
    expect(calculateBarWidth(5, 20)).toBe(25)

    // 1 out of 25: round(4) is < 12, so clamped to 12%
    expect(calculateBarWidth(1, 25)).toBe(12)

    // Edge cases: zero or negative max count
    expect(calculateBarWidth(5, 0)).toBe(12)
    expect(calculateBarWidth(5, -10)).toBe(12)
  })
})

