import * as React from "react"
import { Home, KeyRound, Car, Package, User, Activity } from "lucide-react"
import { ZenwayLogo } from "@/components/brand/ZenwayLogo"
import type { NavTab } from "./Header"

interface MobileNavProps {
  currentTab: NavTab
  onTabChange: (tab: NavTab) => void
}

interface MobileNavItem {
  id: NavTab
  label: string
  icon: React.ElementType
  badge?: string
}

const mobileItems: MobileNavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "rent", label: "RENT", icon: KeyRound, badge: "Rent" },
  { id: "ride", label: "RIDE", icon: Car, badge: "Share" },
  { id: "carry", label: "CARRY", icon: Package, badge: "Drop" },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "profile", label: "Profile", icon: User },
]

export function MobileNav({ currentTab, onTabChange }: MobileNavProps) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/80 bg-background/90 backdrop-blur-lg px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 transition-colors"
      aria-label="Mobile Navigation"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {mobileItems.map((item) => {
          const Icon = item.icon
          const isActive = currentTab === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-h-[48px] min-w-[56px] flex-col items-center justify-center rounded-xl px-2 py-1 text-xs transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {/* Active Top Bar Indicator */}
              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 rounded-full bg-primary" />
              )}

              {/* Icon Container with subtle active glow/pill */}
              <div
                className={`relative p-1 rounded-lg transition-colors flex items-center justify-center ${
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                }`}
              >
                {item.id === "home" ? (
                  <ZenwayLogo
                    variant="icon"
                    size="xs"
                    alt="ZENWAY"
                    className="size-5 flex items-center justify-center"
                  />
                ) : (
                  <Icon className="size-5" />
                )}
              </div>

              <span className="text-[11px] leading-tight tracking-tight mt-0.5">
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
