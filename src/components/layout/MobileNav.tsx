import * as React from "react"
import { Home, KeyRound, Car, Package, User, Activity, Layers, HelpCircle, LogIn, UserPlus } from "lucide-react"
import { ZenwayLogo } from "@/components/brand/ZenwayLogo"
import { ThemeToggle } from "./ThemeToggle"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import type { NavTab } from "./Header"

interface MobileNavProps {
  currentTab: NavTab
  onTabChange: (tab: NavTab) => void
}

interface MobileNavItem {
  id: NavTab
  label: string
  icon: React.ElementType
}

const authMobileItems: MobileNavItem[] = [
  { id: "home", label: "HOME", icon: Home },
  { id: "rent", label: "RENT", icon: KeyRound },
  { id: "ride", label: "RIDE", icon: Car },
  { id: "carry", label: "CARRY", icon: Package },
  { id: "activity", label: "ACTIVITY", icon: Activity },
  { id: "profile", label: "PROFILE", icon: User },
]

export function MobileNav({ currentTab, onTabChange }: MobileNavProps) {
  const { user } = useAuth()
  const { navigate } = useRouter()

  const handleAnchorScroll = (anchorId: string) => {
    if (currentTab !== "home") {
      onTabChange("home")
      setTimeout(() => {
        const el = document.getElementById(anchorId)
        if (el) el.scrollIntoView({ behavior: "smooth" })
      }, 100)
    } else {
      const el = document.getElementById(anchorId)
      if (el) el.scrollIntoView({ behavior: "smooth" })
    }
  }

  // If visitor is logged out, provide contextual landing navigation
  if (!user) {
    return (
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/80 bg-background/85 backdrop-blur-xl px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 transition-colors"
        aria-label="Guest Mobile Navigation"
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {/* Home */}
          <button
            type="button"
            onClick={() => onTabChange("home")}
            className={`relative flex min-h-[48px] min-w-[56px] flex-col items-center justify-center rounded-xl px-2 py-1 text-xs transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              currentTab === "home" ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {currentTab === "home" && <span className="absolute top-0 w-8 h-0.5 rounded-full bg-primary" />}
            <div className={`p-1 rounded-lg ${currentTab === "home" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
              <ZenwayLogo variant="icon" size="xs" alt="ZENWAY" className="size-5 flex items-center justify-center" />
            </div>
            <span className="text-[11px] leading-tight tracking-tight mt-0.5">Home</span>
          </button>

          {/* Services Anchor */}
          <button
            type="button"
            onClick={() => handleAnchorScroll("services")}
            className="flex min-h-[48px] min-w-[56px] flex-col items-center justify-center rounded-xl px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="p-1 rounded-lg text-muted-foreground">
              <Layers className="size-5" />
            </div>
            <span className="text-[11px] leading-tight tracking-tight mt-0.5">Services</span>
          </button>

          {/* How It Works Anchor */}
          <button
            type="button"
            onClick={() => handleAnchorScroll("how-it-works")}
            className="flex min-h-[48px] min-w-[56px] flex-col items-center justify-center rounded-xl px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="p-1 rounded-lg text-muted-foreground">
              <HelpCircle className="size-5" />
            </div>
            <span className="text-[11px] leading-tight tracking-tight mt-0.5">How It Works</span>
          </button>

          {/* Sign In */}
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="flex min-h-[48px] min-w-[56px] flex-col items-center justify-center rounded-xl px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="p-1 rounded-lg text-muted-foreground">
              <LogIn className="size-5" />
            </div>
            <span className="text-[11px] leading-tight tracking-tight mt-0.5">Sign In</span>
          </button>

          {/* Theme Toggle */}
          <div className="flex min-h-[48px] items-center justify-center">
            <ThemeToggle />
          </div>

          {/* Register */}
          <button
            type="button"
            onClick={() => navigate("/register")}
            className="flex min-h-[48px] min-w-[56px] flex-col items-center justify-center rounded-xl px-2 py-1 text-xs text-primary font-semibold transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="p-1 rounded-lg bg-primary/10 text-primary">
              <UserPlus className="size-5" />
            </div>
            <span className="text-[11px] leading-tight tracking-tight mt-0.5">Join</span>
          </button>
        </div>
      </nav>
    )
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/80 bg-background/85 backdrop-blur-xl px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 transition-colors"
      aria-label="Student Mobile Navigation"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {authMobileItems.map((item) => {
          const Icon = item.icon
          const isActive = currentTab === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-h-[48px] min-w-[48px] flex-col items-center justify-center rounded-xl px-1.5 py-1 text-xs transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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

              <span className="text-[10px] leading-tight font-semibold tracking-[0.08em] uppercase mt-0.5">
                {item.label}
              </span>
            </button>
          )
        })}

        {/* Theme Toggle on Mobile */}
        <div className="flex min-h-[48px] items-center justify-center shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}
