import { useRouter } from "@/context/RouterContext"
import {
  useNotifications,
  type NotificationRecord,
  deduplicateNotifications,
} from "@/context/NotificationContext"
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

export { type NotificationRecord, deduplicateNotifications }

export function NotificationsDropdown() {
  const { navigate } = useRouter()
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications()

  // Mark all read
  const handleMarkAllRead = async () => {
    await markAllAsRead()
  }

  // Mark single notification read
  const handleClickNotification = async (notification: NotificationRecord) => {
    if (!notification.is_read) {
      await markAsRead(notification.id)
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
