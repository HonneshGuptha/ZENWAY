import * as React from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"

export interface NotificationRecord {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  data: any
  is_read: boolean
  created_at: string
  actionLabel?: string
  actionUrl?: string
}

export interface MascotNotificationItem extends NotificationRecord {
  durationMs?: number
}

export function deduplicateNotifications(list: NotificationRecord[]): NotificationRecord[] {
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

    const keys =
      entityRefs.length > 0
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

interface NotificationContextType {
  notifications: NotificationRecord[]
  unreadCount: number
  fetchNotifications: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  activeMascotNotification: MascotNotificationItem | null
  queueMascotNotification: (notif: MascotNotificationItem) => void
  dismissActiveNotification: () => void
  isHoverPaused: boolean
  setIsHoverPaused: (paused: boolean) => void
  isKicking: boolean
  triggerKickDismiss: () => void
}

const NotificationContext = React.createContext<NotificationContextType | null>(null)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = React.useState<NotificationRecord[]>([])
  const [unreadCount, setUnreadCount] = React.useState(0)

  // Mascot-driven notification queue
  const [queue, setQueue] = React.useState<MascotNotificationItem[]>([])
  const [activeNotification, setActiveNotification] = React.useState<MascotNotificationItem | null>(null)
  const [isHoverPaused, setIsHoverPaused] = React.useState(false)
  const [isKicking, setIsKicking] = React.useState(false)

  // Track initial load IDs so initial history never triggers mascot kick popups
  const initialLoadedRef = React.useRef(false)
  const knownNotificationIds = React.useRef<Set<string>>(new Set())

  // Process queue sequentially
  React.useEffect(() => {
    if (!activeNotification && queue.length > 0) {
      const [nextNotif, ...remaining] = queue
      setActiveNotification(nextNotif)
      setQueue(remaining)
      setIsKicking(false)
      setIsHoverPaused(false)
    }
  }, [activeNotification, queue])

  const fetchNotifications = React.useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, type, title, message, data, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30)

      if (error) throw error

      const list = (data || []) as NotificationRecord[]
      const deduped = deduplicateNotifications(list)
      setNotifications(deduped)
      setUnreadCount(deduped.filter((n) => !n.is_read).length)

      for (const n of deduped) {
        knownNotificationIds.current.add(n.id)
      }
      initialLoadedRef.current = true
    } catch (err) {
      console.error("[Notifications] Fetch error:", err)
    }
  }, [user])

  // Single authoritatively subscribed Realtime Channel
  React.useEffect(() => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      setQueue([])
      setActiveNotification(null)
      initialLoadedRef.current = false
      knownNotificationIds.current.clear()
      return
    }

    // Initial fetch of past history
    fetchNotifications()

    const channelName = `user-notifs-${user.id}-${Math.random().toString(36).slice(2, 7)}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as NotificationRecord

          setNotifications((prev) => {
            const dedupedList = deduplicateNotifications([newNotif, ...prev])
            const isAdded = dedupedList.some((n) => n.id === newNotif.id)

            if (isAdded && !newNotif.is_read) {
              setUnreadCount(dedupedList.filter((n) => !n.is_read).length)

              // Only queue into mascot notification if newly arrived in realtime
              if (!knownNotificationIds.current.has(newNotif.id)) {
                knownNotificationIds.current.add(newNotif.id)
                setQueue((q) => [...q, newNotif])
              }
            }
            return dedupedList
          })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedNotif = payload.new as NotificationRecord
          setNotifications((prev) => {
            const nextList = prev.map((n) => (n.id === updatedNotif.id ? updatedNotif : n))
            setUnreadCount(nextList.filter((n) => !n.is_read).length)
            return nextList
          })
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("[Notifications] Realtime channel error")
        }
      })

    // Background sync fallback every 60 seconds
    const interval = setInterval(fetchNotifications, 60000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [user, fetchNotifications])

  // Mark single as read
  const markAsRead = React.useCallback(async (id: string) => {
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch (err) {
      console.error("[Notifications] Mark read error:", err)
    }
  }, [])

  // Mark all as read
  const markAllAsRead = React.useCallback(async () => {
    if (!user) return
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false)

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error("[Notifications] Mark all read error:", err)
    }
  }, [user])

  // Explicit mascot notification queueing
  const queueMascotNotification = React.useCallback((notif: MascotNotificationItem) => {
    // Deduplication check
    if (!notif.id) {
      notif.id = `mascot-toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    }
    if (knownNotificationIds.current.has(notif.id)) {
      return
    }
    knownNotificationIds.current.add(notif.id)
    setQueue((q) => [...q, notif])
  }, [])

  // Start kick exit sequence
  const triggerKickDismiss = React.useCallback(() => {
    if (isKicking) return
    setIsKicking(true)
  }, [isKicking])

  // Complete and remove active notification from screen
  const dismissActiveNotification = React.useCallback(() => {
    if (activeNotification) {
      markAsRead(activeNotification.id).catch(() => {})
    }
    setActiveNotification(null)
    setIsKicking(false)
    setIsHoverPaused(false)
  }, [activeNotification, markAsRead])

  const value = React.useMemo(
    () => ({
      notifications,
      unreadCount,
      fetchNotifications,
      markAsRead,
      markAllAsRead,
      activeMascotNotification: activeNotification,
      queueMascotNotification,
      dismissActiveNotification,
      isHoverPaused,
      setIsHoverPaused,
      isKicking,
      triggerKickDismiss,
    }),
    [
      notifications,
      unreadCount,
      fetchNotifications,
      markAsRead,
      markAllAsRead,
      activeNotification,
      queueMascotNotification,
      dismissActiveNotification,
      isHoverPaused,
      isKicking,
      triggerKickDismiss,
    ]
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = React.useContext(NotificationContext)
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}
