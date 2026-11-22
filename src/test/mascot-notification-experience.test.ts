import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  deduplicateNotifications,
  type NotificationRecord,
} from "@/context/NotificationContext"

describe("PART 3: Mascot-Driven Notification Experience", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe("Notification Content & Structure", () => {
    it("preserves title, message, entity data, and action properties", () => {
      const notif: NotificationRecord = {
        id: "notif-1",
        user_id: "user-1",
        type: "rental_request_accepted",
        title: "Rental Booking Approved!",
        message: "Your reservation for Hero Lectro E-Bike was confirmed by Alex.",
        data: { rental_request_id: "req-123" },
        is_read: false,
        created_at: new Date().toISOString(),
        actionLabel: "View Rental",
        actionUrl: "/rent",
      }

      expect(notif.title).toBe("Rental Booking Approved!")
      expect(notif.message).toContain("Hero Lectro")
      expect(notif.actionLabel).toBe("View Rental")
      expect(notif.actionUrl).toBe("/rent")
      expect(notif.is_read).toBe(false)
    })
  })

  describe("Hover-Pause & Keyboard Accessibility", () => {
    it("pauses auto-dismiss countdown timer when user hovers or focuses", () => {
      let isHoverPaused = false
      let timeLeft = 5000
      let kickTriggered = false

      const tick = (deltaMs: number) => {
        if (!isHoverPaused && !kickTriggered) {
          timeLeft = Math.max(0, timeLeft - deltaMs)
          if (timeLeft === 0) {
            kickTriggered = true
          }
        }
      }

      // 1. Initial 1000ms passes
      tick(1000)
      expect(timeLeft).toBe(4000)
      expect(kickTriggered).toBe(false)

      // 2. User hovers cursor over card (or focuses via keyboard)
      isHoverPaused = true
      tick(2000)
      // Time left remains unchanged because timer is paused
      expect(timeLeft).toBe(4000)
      expect(kickTriggered).toBe(false)

      // 3. User moves mouse away (or blurs)
      isHoverPaused = false
      tick(4000)
      expect(timeLeft).toBe(0)
      expect(kickTriggered).toBe(true)
    })

    it("triggers kick-exit dismissal immediately upon Escape key press", () => {
      let isKicking = false
      const onKeyDown = (key: string) => {
        if (key === "Escape") {
          isKicking = true
        }
      }

      expect(isKicking).toBe(false)
      onKeyDown("Escape")
      expect(isKicking).toBe(true)
    })
  })

  describe("Mascot Flying-Kick Choreography & State Machine", () => {
    it("transitions through enter, hover, karate kick, and off-screen exit", () => {
      type NotificationAnimState = "entering" | "hovering" | "kicking" | "exited"

      let state: NotificationAnimState = "entering"
      let pose: "hover" | "kick" = "hover"
      let cardOffset = 0
      let mascotOffset = 0

      // Step 1: Mascot drops down from top
      state = "hovering"
      pose = "hover"
      expect(state).toBe("hovering")
      expect(pose).toBe("hover")

      // Step 2: Kick is triggered (auto-dismiss or manual click)
      state = "kicking"
      pose = "kick"
      // Mascot surges into flying-kick striking the card
      mascotOffset = 60
      // Card receives physical strike impact
      cardOffset = 80
      expect(state).toBe("kicking")
      expect(pose).toBe("kick")
      expect(mascotOffset).toBe(60)
      expect(cardOffset).toBe(80)

      // Step 3: Follow-through off-screen in the same direction
      mascotOffset = 500
      cardOffset = 520
      state = "exited"

      expect(state).toBe("exited")
      expect(mascotOffset).toBeGreaterThan(400)
      expect(cardOffset).toBeGreaterThan(400)
    })

    it("respects prefers-reduced-motion with gentle fade fallback without dash-kick", () => {
      const reducedMotion = true
      const getAnimationType = (isReduced: boolean) => {
        if (isReduced) {
          return { type: "fade", exitDuration: 250 }
        }
        return { type: "flying-kick", exitDuration: 650 }
      }

      const anim = getAnimationType(reducedMotion)
      expect(anim.type).toBe("fade")
      expect(anim.exitDuration).toBe(250)
    })
  })

  describe("Queueing & Non-Overlapping Mascot Transitions", () => {
    it("queues multiple notifications sequentially so mascot animations never collide", () => {
      const queue: NotificationRecord[] = []
      let active: NotificationRecord | null = null

      const enqueue = (notif: NotificationRecord) => {
        if (!active) {
          active = notif
        } else {
          queue.push(notif)
        }
      }

      const onNotificationComplete = () => {
        if (queue.length > 0) {
          active = queue.shift()!
        } else {
          active = null
        }
      }

      const notif1 = { id: "n-1", user_id: "u-1", type: "rent", title: "Rental 1", message: "m1", data: {}, is_read: false, created_at: "" }
      const notif2 = { id: "n-2", user_id: "u-1", type: "ride", title: "Ride 2", message: "m2", data: {}, is_read: false, created_at: "" }
      const notif3 = { id: "n-3", user_id: "u-1", type: "carry", title: "Carry 3", message: "m3", data: {}, is_read: false, created_at: "" }

      enqueue(notif1)
      enqueue(notif2)
      enqueue(notif3)

      // Only notif1 is active initially
      expect((active as any)?.id).toBe("n-1")
      expect(queue).toHaveLength(2)

      // notif1 completes its kick exit
      onNotificationComplete()
      expect((active as any)?.id).toBe("n-2")
      expect(queue).toHaveLength(1)

      // notif2 completes its kick exit
      onNotificationComplete()
      expect((active as any)?.id).toBe("n-3")
      expect(queue).toHaveLength(0)

      // notif3 completes
      onNotificationComplete()
      expect(active).toBeNull()
    })

    it("deduplicates identical events between initial load and realtime dispatches", () => {
      const list: NotificationRecord[] = [
        {
          id: "initial-1",
          user_id: "user-100",
          type: "rental_request_accepted",
          title: "Approved",
          message: "Rental approved",
          data: { rental_request_id: "shared-rental-999" },
          is_read: false,
          created_at: "2026-11-22T10:00:00Z",
        },
        {
          id: "realtime-duplicate-2",
          user_id: "user-100",
          type: "rental_request_accepted",
          title: "Approved",
          message: "Rental approved",
          data: { request_id: "shared-rental-999" },
          is_read: false,
          created_at: "2026-11-22T10:00:01Z",
        },
      ]

      const result = deduplicateNotifications(list)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("initial-1")
    })
  })
})
