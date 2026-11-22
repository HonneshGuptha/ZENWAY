import * as React from "react"
import { motion } from "motion/react"
import { Home, KeyRound, Car, Package, Activity } from "lucide-react"
import type { NavTab } from "./Header"

interface BottomDockProps {
  currentTab: NavTab
  onTabChange: (tab: NavTab) => void
}

interface DockItem {
  id: NavTab
  label: string
  icon: React.ElementType
}

const dockItems: DockItem[] = [
  { id: "home", label: "HOME", icon: Home },
  { id: "rent", label: "RENT", icon: KeyRound },
  { id: "ride", label: "RIDE", icon: Car },
  { id: "carry", label: "CARRY", icon: Package },
  { id: "activity", label: "ACTIVITY", icon: Activity },
]

const prefetchTab = (tab: NavTab) => {
  if (tab === "profile") void import("@/pages/profile/StudentProfilePage")
}

/**
 * BottomDock:
 * Sleek, centered post-login floating bottom glass dock for desktop & mobile.
 * Uses motion/react layoutId="bottomDockActive" for a springy active pill.
 */
export function BottomDock({ currentTab, onTabChange }: BottomDockProps) {
  React.useEffect(() => {
    // Idle prefetch of remaining lazy tab pages (e.g. StudentProfilePage)
    const prefetchCore = () => {
      void import("@/pages/profile/StudentProfilePage")
    }
    if (typeof window !== "undefined") {
      if ("requestIdleCallback" in window) {
        ;(window as any).requestIdleCallback(prefetchCore)
      } else {
        setTimeout(prefetchCore, 250)
      }
    }
  }, [])

  return (
    <div
      role="navigation"
      aria-label="Student Navigation Dock"
      className="fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[95vw] rounded-full border border-border/80 zen-glass px-2 sm:px-2.5 py-1.5 sm:py-2 shadow-xl flex items-center gap-1 sm:gap-1.5 select-none mb-[env(safe-area-inset-bottom)]"
    >
      {dockItems.map((item) => {
        const Icon = item.icon
        const isActive = currentTab === item.id

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            onMouseEnter={() => prefetchTab(item.id)}
            onFocus={() => prefetchTab(item.id)}
            aria-current={isActive ? "page" : undefined}
            aria-label={item.label}
            className={`relative min-h-[44px] min-w-[44px] justify-center px-3 sm:px-4 py-2 rounded-full text-[11px] font-semibold tracking-[0.1em] uppercase transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center gap-1.5 ${
              isActive
                ? "text-primary-foreground font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            {/* Sliding Active Background Pill */}
            {isActive && (
              <motion.span
                layoutId="bottomDockActive"
                className="absolute inset-0 rounded-full bg-primary shadow-md z-0"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}

            <Icon className="size-4 relative z-10 shrink-0" />
            <span className="relative z-10 hidden sm:inline">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
