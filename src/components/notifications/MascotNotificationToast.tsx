import * as React from "react"
import { motion } from "motion/react"
import { useNotifications } from "@/context/NotificationContext"
import { MascotKickVector } from "./MascotKickVector"
import { useRouter } from "@/context/RouterContext"
import { prefersReducedMotion } from "@/components/ui/mascotConstants"
import {
  KeyRound,
  Car,
  Package,
  ShieldCheck,
  Bell,
  X,
  ArrowRight,
  Sparkles,
} from "lucide-react"

function getServiceIcon(type?: string) {
  if (!type) return <Bell className="size-4 text-primary" />
  const lower = type.toLowerCase()
  if (lower.includes("rent") || lower.includes("vehicle")) {
    return <KeyRound className="size-4 text-amber-600 dark:text-amber-400" />
  }
  if (lower.includes("ride") || lower.includes("carpool")) {
    return <Car className="size-4 text-sky-600 dark:text-sky-400" />
  }
  if (lower.includes("carry") || lower.includes("delivery") || lower.includes("package")) {
    return <Package className="size-4 text-emerald-600 dark:text-emerald-400" />
  }
  if (lower.includes("verify") || lower.includes("approval")) {
    return <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
  }
  return <Bell className="size-4 text-primary" />
}

export function MascotNotificationToast() {
  const {
    activeMascotNotification,
    dismissActiveNotification,
    isHoverPaused,
    setIsHoverPaused,
    isKicking,
    triggerKickDismiss,
  } = useNotifications()

  const { navigate } = useRouter()
  const [reducedMotion, setReducedMotion] = React.useState(false)
  const [timeLeft, setTimeLeft] = React.useState(5000)
  const totalDuration = activeMascotNotification?.durationMs || 5000

  // Detect reduced motion preference
  React.useEffect(() => {
    setReducedMotion(prefersReducedMotion())
  }, [])

  // Reset timer on new notification
  React.useEffect(() => {
    if (activeMascotNotification) {
      setTimeLeft(totalDuration)
    }
  }, [activeMascotNotification, totalDuration])

  // Count down unless paused or kicking
  React.useEffect(() => {
    if (!activeMascotNotification || isHoverPaused || isKicking) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 100) {
          clearInterval(interval)
          triggerKickDismiss()
          return 0
        }
        return prev - 100
      })
    }, 100)

    return () => clearInterval(interval)
  }, [activeMascotNotification, isHoverPaused, isKicking, triggerKickDismiss])

  // Listen for Escape key
  React.useEffect(() => {
    if (!activeMascotNotification) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        triggerKickDismiss()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeMascotNotification, triggerKickDismiss])

  // Execute kick-exit sequence
  React.useEffect(() => {
    if (!isKicking) return

    // Allow kick animation to complete and exit screen before removing
    const exitTimer = setTimeout(() => {
      dismissActiveNotification()
    }, reducedMotion ? 250 : 650)

    return () => clearTimeout(exitTimer)
  }, [isKicking, dismissActiveNotification, reducedMotion])

  if (!activeMascotNotification) return null

  const handleActionClick = () => {
    if (activeMascotNotification.actionUrl) {
      navigate(activeMascotNotification.actionUrl)
    } else {
      const type = activeMascotNotification.type?.toLowerCase() || ""
      if (type.includes("rent")) navigate("/rent")
      else if (type.includes("ride")) navigate("/ride")
      else if (type.includes("carry")) navigate("/carry")
      else navigate("/activity")
    }
    triggerKickDismiss()
  }

  // Animation variants
  const mascotVariants: Record<string, any> = {
    initial: reducedMotion
      ? { opacity: 0 }
      : { y: -70, x: -10, opacity: 0, rotate: -10 },
    animate: reducedMotion
      ? { opacity: 1 }
      : {
          y: 0,
          x: 0,
          opacity: 1,
          rotate: [0, 4, -4, 0],
          transition: {
            y: { type: "spring", stiffness: 450, damping: 22 },
            rotate: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
          },
        },
    kickExit: reducedMotion
      ? { opacity: 0, transition: { duration: 0.25 } }
      : {
          x: [-15, 60, 500],
          y: [0, -10, 20],
          rotate: [-15, 12, 25],
          opacity: [1, 1, 0],
          transition: {
            duration: 0.6,
            times: [0, 0.25, 1],
            ease: "easeIn",
          },
        },
  }

  const cardVariants: Record<string, any> = {
    initial: reducedMotion
      ? { opacity: 0 }
      : { y: -20, opacity: 0, scale: 0.95 },
    animate: reducedMotion
      ? { opacity: 1 }
      : {
          y: 0,
          opacity: 1,
          scale: 1,
          transition: { type: "spring", stiffness: 400, damping: 26, delay: 0.08 },
        },
    kickExit: reducedMotion
      ? { opacity: 0, transition: { duration: 0.25 } }
      : {
          x: [0, 80, 520],
          y: [0, 15, -40],
          rotate: [0, 14, -20],
          opacity: [1, 1, 0],
          transition: {
            duration: 0.6,
            times: [0, 0.28, 1],
            ease: "easeIn",
          },
        },
  }

  const progressPercent = Math.max(0, Math.min(100, (timeLeft / totalDuration) * 100))

  return (
    <div
      className="fixed top-4 inset-x-4 max-w-sm sm:max-w-md sm:right-6 sm:inset-x-auto sm:top-5 z-[9999] pointer-events-none select-none"
      role="region"
      aria-label="Campus Mascot Notifications"
    >
      <div className="relative flex flex-col items-end">
        {/* Animated Mascot Dropping Down / Striking */}
        <motion.div
          key={`mascot-${activeMascotNotification.id}`}
          variants={mascotVariants}
          initial="initial"
          animate={isKicking ? "kickExit" : "animate"}
          className="relative -mb-3.5 mr-6 z-20 pointer-events-none"
        >
          <MascotKickVector
            pose={isKicking ? "kick" : "hover"}
            size={56}
            className="filter drop-shadow-md"
          />
          {/* Vermilion Kick Impact Accent Spark */}
          {isKicking && !reducedMotion && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.8, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 0.35, delay: 0.12 }}
              className="absolute right-[-10px] top-[24px] pointer-events-none text-primary"
            >
              <Sparkles className="size-6 text-primary fill-primary" />
            </motion.div>
          )}
        </motion.div>

        {/* Notification Card */}
        <motion.div
          key={`card-${activeMascotNotification.id}`}
          variants={cardVariants}
          initial="initial"
          animate={isKicking ? "kickExit" : "animate"}
          onMouseEnter={() => setIsHoverPaused(true)}
          onMouseLeave={() => setIsHoverPaused(false)}
          onFocus={() => setIsHoverPaused(true)}
          onBlur={() => setIsHoverPaused(false)}
          className="pointer-events-auto relative w-full rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl p-4 text-foreground overflow-hidden"
          role="alert"
          aria-live="polite"
        >
          {/* Top subtle reading progress bar (pauses on hover) */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-muted/60 overflow-hidden">
            <div
              className={`h-full bg-primary transition-all duration-100 ease-linear ${
                isHoverPaused ? "opacity-60" : "opacity-100"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-start gap-3 pt-1">
            {/* Service / Status Icon */}
            <div className="size-9 rounded-xl bg-muted/80 border border-border/60 flex items-center justify-center shrink-0 mt-0.5">
              {getServiceIcon(activeMascotNotification.type)}
            </div>

            {/* Notification Text */}
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-foreground truncate tracking-tight font-heading">
                  {activeMascotNotification.title}
                </h4>
                {isHoverPaused && (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                    Paused
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                {activeMascotNotification.message}
              </p>

              {/* Action Button */}
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleActionClick}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer group"
                >
                  <span>{activeMascotNotification.actionLabel || "View Details"}</span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={triggerKickDismiss}
              aria-label="Dismiss notification"
              className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
