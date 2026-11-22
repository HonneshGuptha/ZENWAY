import * as React from "react"
import { useSonner } from "sonner"
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

export interface ShowMascotNotificationParams {
  title: string
  message: string
  type?: "rent" | "ride" | "carry" | "profile" | "verify" | "success" | "error" | "info" | "warning" | "system" | string
  actionLabel?: string
  actionUrl?: string
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
  showMascotNotification: (params: ShowMascotNotificationParams) => void
  dismissActiveNotification: () => void
  isHoverPaused: boolean
  setIsHoverPaused: (paused: boolean) => void
  isKicking: boolean
  triggerKickDismiss: () => void
}

const NotificationContext = React.createContext<NotificationContextType | null>(null)

function SonnerMascotBridge() {
  const { toasts } = useSonner()
  const { queueMascotNotification } = useNotifications()
  const processedIds = React.useRef<Set<string | number>>(new Set())

  React.useEffect(() => {
    for (const t of toasts) {
      if (processedIds.current.has(t.id)) continue
      processedIds.current.add(t.id)

      const rawTitle = typeof t.title === "string" ? t.title : ""
      const rawDesc = typeof t.description === "string" ? t.description : ""

      let title = rawTitle
      let message = rawDesc

      if (!message) {
        if (t.type === "error") {
          title = "Action Failed"
          message = rawTitle || "An unexpected error occurred."
        } else if (t.type === "info") {
          title = "Notice"
          message = rawTitle
        } else if (t.type === "warning") {
          title = "Attention"
          message = rawTitle
        } else if (t.type === "success") {
          title = "Success"
          message = rawTitle
        } else {
          title = rawTitle || "Notification"
          message = ""
        }
      }

      // Infer domain category if type is generic
      let inferredType = t.type || "system"
      const combined = `${title} ${message}`.toLowerCase()
      if (combined.includes("rent") || combined.includes("vehicle")) {
        inferredType = "rent"
      } else if (combined.includes("ride") || combined.includes("carpool") || combined.includes("seat")) {
        inferredType = "ride"
      } else if (combined.includes("carry") || combined.includes("package") || combined.includes("delivery")) {
        inferredType = "carry"
      } else if (combined.includes("profile") || combined.includes("upi")) {
        inferredType = "profile"
      } else if (combined.includes("verif") || combined.includes("approval") || combined.includes("document")) {
        inferredType = "verify"
      }

      queueMascotNotification({
        id: `sonner-${t.id}`,
        user_id: "local",
        type: inferredType,
        title,
        message,
        data: {},
        is_read: false,
        created_at: new Date().toISOString(),
        durationMs: typeof t.duration === "number" ? t.duration : 4500,
      })
    }
  }, [toasts, queueMascotNotification])

  return null
}

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
  const recentMessagesRef = React.useRef<Map<string, number>>(new Map())

  // Process queue sequentially: only one active at a time
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
      recentMessagesRef.current.clear()
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
    // Deduplication check by ID
    if (!notif.id) {
      notif.id = `mascot-toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    }
    if (knownNotificationIds.current.has(notif.id)) {
      return
    }

    // Debounce duplicate identical notifications within 1.5s
    const dedupeKey = `${notif.title}:${notif.message}:${notif.type}`
    const now = Date.now()
    const lastSeen = recentMessagesRef.current.get(dedupeKey)
    if (lastSeen && now - lastSeen < 1500) {
      return
    }
    recentMessagesRef.current.set(dedupeKey, now)
    knownNotificationIds.current.add(notif.id)

    setQueue((q) => [...q, notif])
  }, [])

  // Clean explicit helper for local action confirmations
  const showMascotNotification = React.useCallback(
    ({
      title,
      message,
      type = "system",
      actionLabel,
      actionUrl,
      durationMs = 5000,
    }: ShowMascotNotificationParams) => {
      const id = `mascot-toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      queueMascotNotification({
        id,
        user_id: user?.id || "local",
        type,
        title,
        message,
        data: {},
        is_read: false,
        created_at: new Date().toISOString(),
        actionLabel,
        actionUrl,
        durationMs,
      })
    },
    [user, queueMascotNotification]
  )

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
      showMascotNotification,
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
      showMascotNotification,
      dismissActiveNotification,
      isHoverPaused,
      isKicking,
      triggerKickDismiss,
    ]
  )

  return (
    <NotificationContext.Provider value={value}>
      <SonnerMascotBridge />
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
