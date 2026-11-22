import { describe, it, expect } from "vitest"

// Replicate the deduplication algorithm from NotificationsDropdown
interface NotificationRecord {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  data: any
  is_read: boolean
  created_at: string
}

function deduplicateNotifications(list: NotificationRecord[]): NotificationRecord[] {
  const seen = new Set<string>()
  const result: NotificationRecord[] = []

  for (const n of list) {
    if (seen.has(n.id)) continue

    const entityRefs = [
      n.data?.request_id,
      n.data?.rental_request_id,
      n.data?.ride_request_id,
      n.data?.carry_offer_id,
      n.data?.offer_id,
    ].filter(Boolean)

    const keys = entityRefs.length > 0
      ? entityRefs.map((ref) => `${n.user_id}:${n.type}:${ref}`)
      : [`${n.user_id}:${n.id}`]

    if (keys.some((k) => seen.has(k))) continue

    seen.add(n.id)
    for (const k of keys) {
      seen.add(k)
    }
    result.push(n)
  }

  return result
}

describe("Notification Deduplication Integrity", () => {
  it("deduplicates twin database records from concurrent RPC and trigger dispatches (rental)", () => {
    const rpcNotification: NotificationRecord = {
      id: "notif-uuid-1",
      user_id: "user-100",
      type: "rental_request_accepted",
      title: "Rental Request Approved!",
      message: "Your booking for Bicycle has been approved!",
      data: { rental_request_id: "req-xyz-999", vehicle_id: "veh-1" },
      is_read: false,
      created_at: "2026-11-22T12:00:00.000Z",
    }

    const triggerNotification: NotificationRecord = {
      id: "notif-uuid-2",
      user_id: "user-100",
      type: "rental_request_accepted",
      title: "Rental Request Approved!",
      message: "Your booking for Bicycle has been approved!",
      data: { request_id: "req-xyz-999", vehicle_id: "veh-1" },
      is_read: false,
      created_at: "2026-11-22T12:00:00.100Z",
    }

    const result = deduplicateNotifications([rpcNotification, triggerNotification])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("notif-uuid-1")
  })

  it("deduplicates twin database records from concurrent RPC and trigger dispatches (carry)", () => {
    const rpcNotification: NotificationRecord = {
      id: "notif-carry-1",
      user_id: "user-200",
      type: "carry_offer_accepted",
      title: "Carry Offer Accepted!",
      message: "Your offer to carry package was accepted!",
      data: { carry_offer_id: "offer-abc-123", request_id: "req-456" },
      is_read: false,
      created_at: "2026-11-22T12:00:00.000Z",
    }

    const triggerNotification: NotificationRecord = {
      id: "notif-carry-2",
      user_id: "user-200",
      type: "carry_offer_accepted",
      title: "Carry Offer Accepted!",
      message: "Your offer to carry package was accepted!",
      data: { offer_id: "offer-abc-123" },
      is_read: false,
      created_at: "2026-11-22T12:00:00.050Z",
    }

    const result = deduplicateNotifications([rpcNotification, triggerNotification])
    expect(result).toHaveLength(1)
  })

  it("preserves distinct notifications for two separate rental requests", () => {
    const notif1: NotificationRecord = {
      id: "notif-1",
      user_id: "user-100",
      type: "rental_request_accepted",
      title: "Rental Request Approved!",
      message: "Your booking 1",
      data: { request_id: "req-AAA" },
      is_read: false,
      created_at: "2026-11-22T12:00:00Z",
    }

    const notif2: NotificationRecord = {
      id: "notif-2",
      user_id: "user-100",
      type: "rental_request_accepted",
      title: "Rental Request Approved!",
      message: "Your booking 2",
      data: { request_id: "req-BBB" },
      is_read: false,
      created_at: "2026-11-22T12:00:02Z",
    }

    const result = deduplicateNotifications([notif1, notif2])
    expect(result).toHaveLength(2)
  })

  it("does not suppress legitimate independent notifications lacking entity references", () => {
    const notice1: NotificationRecord = {
      id: "notice-1",
      user_id: "user-100",
      type: "general_notice",
      title: "Campus Announcement",
      message: "Library closes early today",
      data: null,
      is_read: false,
      created_at: "2026-11-22T12:00:00Z",
    }

    const notice2: NotificationRecord = {
      id: "notice-2",
      user_id: "user-100",
      type: "general_notice",
      title: "Campus Announcement",
      message: "Transit gate open",
      data: null,
      is_read: false,
      created_at: "2026-11-22T12:00:03Z", // within 3 seconds
    }

    const result = deduplicateNotifications([notice1, notice2])
    expect(result).toHaveLength(2)
    expect(result.map(n => n.id)).toEqual(["notice-1", "notice-2"])
  })
})
