import * as React from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Bell,
  Car,
  KeyRound,
  Package,
  ShieldAlert,
  ShieldCheck,
  Star,
  Check,
} from "lucide-react"
import { toast } from "sonner"

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

/**
 * Deduplicate twin database notifications while preserving all distinct independent events.
 * Corrects duplicate records caused by concurrent RPC + database trigger dispatches
 * by matching across all transaction entity references, avoiding arbitrary time heuristics.
 */
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

export function NotificationsDropdown() {
  const { user } = useAuth()
  const { navigate } = useRouter()

  const [notifications, setNotifications] = React.useState<NotificationRecord[]>([])
  const [unreadCount, setUnreadCount] = React.useState(0)

  const fetchNotifications = React.useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, type, title, message, data, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)

      if (error) throw error

      const list = (data || []) as NotificationRecord[]
      const deduped = deduplicateNotifications(list)
      setNotifications(deduped)
      setUnreadCount(deduped.filter((n) => !n.is_read).length)
    } catch (err) {
      console.error("[Notifications] Fetch error:", err)
    }
  }, [user])

  React.useEffect(() => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    // 1. Initial fetch
    fetchNotifications()

    // 2. Realtime subscription: live updates on INSERT/UPDATE for current user with clean unique channel instance
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
            // Only toast if it was genuinely added to the deduplicated list
            const isAdded = dedupedList.some((n) => n.id === newNotif.id)
            if (isAdded && !newNotif.is_read) {
              setUnreadCount(dedupedList.filter((n) => !n.is_read).length)
              toast.info(newNotif.title, {
                description: newNotif.message,
              })
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

    // 3. Fallback background sync every 60 seconds
    const interval = setInterval(fetchNotifications, 60000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [user, fetchNotifications])

  // Mark all read
  const handleMarkAllRead = async () => {
    if (!user) return
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false)

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      )
      setUnreadCount(0)
    } catch (err) {
      console.error("[Notifications] Mark all read error:", err)
    }
  }

  // Mark single notification read
  const handleClickNotification = async (notification: NotificationRecord) => {
    if (!notification.is_read) {
      try {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", notification.id)

        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
        )
        setUnreadCount((c) => Math.max(0, c - 1))
      } catch (err) {
        console.error("[Notifications] Mark read error:", err)
      }
    }

    // Contextual navigation
    if (notification.type.startsWith("rental_")) {
      navigate("/rent")
    } else if (notification.type.startsWith("ride_")) {
      navigate("/ride")
    } else if (notification.type.startsWith("carry_")) {
      navigate("/carry")
    } else if (notification.type.startsWith("verification_")) {
      navigate("/verification-status")
    }
  }

  const getNotificationIcon = (type: string) => {
    if (type.startsWith("rental_")) return <KeyRound className="size-3.5 text-primary" />
    if (type.startsWith("ride_")) return <Car className="size-3.5 text-emerald-500" />
    if (type.startsWith("carry_")) return <Package className="size-3.5 text-accent" />
    if (type === "verification_approved") return <ShieldCheck className="size-3.5 text-emerald-500" />
    if (type === "verification_rejected") return <ShieldAlert className="size-3.5 text-destructive" />
    if (type === "review_received") return <Star className="size-3.5 text-amber-500" />
    return <Bell className="size-3.5 text-muted-foreground" />
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative size-9 rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            aria-label="Campus Transit Notifications"
          >
            <Bell className="size-4.5" />
            {unreadCount > 0 && (
              <span
                aria-label={`${unreadCount} unread notifications`}
                className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white shadow-xs"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        }
      />

      <DropdownMenuContent align="end" sideOffset={6} className="w-80 p-0 shadow-lg">
        <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              Notifications
            </span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/15 text-primary font-bold text-[10px] px-1.5 py-0.2">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-primary hover:underline transition-colors cursor-pointer flex items-center gap-1 font-medium"
            >
              <Check className="size-3" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        <div className="divide-y divide-border/60 max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
              <Bell className="size-6 text-muted-foreground/40 mx-auto" />
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => {
              const isUnread = !n.is_read
              return (
                <div
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`p-3 transition-colors flex items-start gap-2.5 cursor-pointer ${
                    isUnread ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="p-1.5 rounded-md bg-muted mt-0.5 shrink-0">
                    {getNotificationIcon(n.type)}
                  </div>
                  <div className="flex-1 text-xs space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`font-semibold ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
                        {n.title}
                      </p>
                      {isUnread && (
                        <span className="size-1.5 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-muted-foreground text-[11px] line-clamp-2">
                      {n.message}
                    </p>
                    <span className="text-[10px] text-muted-foreground font-mono block pt-0.5">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
