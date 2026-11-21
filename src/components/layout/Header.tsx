import * as React from "react"
import { motion } from "motion/react"
import {
  ShieldCheck,
  CheckCircle2,
  User,
  LogOut,
  UserCheck,
  ArrowRight,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "./ThemeToggle"
import { NotificationsDropdown } from "@/components/notifications/NotificationsDropdown"
import { ZenwayLogo } from "@/components/brand/ZenwayLogo"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"

export type NavTab = "home" | "rent" | "ride" | "carry" | "activity" | "profile"

interface HeaderProps {
  currentTab: NavTab
  onTabChange: (tab: NavTab) => void
}

/**
 * Logged-out navigation tabs
 */
const loggedOutNavItems: { id: string; label: string; tab?: NavTab; anchor?: string }[] = [
  { id: "rent", label: "RENT", tab: "rent" },
  { id: "ride", label: "RIDE", tab: "ride" },
  { id: "carry", label: "CARRY", tab: "carry" },
  { id: "safety", label: "SAFETY", anchor: "trust-safety" },
]

export function Header({ currentTab, onTabChange }: HeaderProps) {
  const {
    user,
    profile,
    signOut,
    isVerified,
    isPending,
    isSuspended,
    isAdmin,
  } = useAuth()
  const { navigate } = useRouter()

  // Compute clean student initials (e.g. "HO", "PK")
  const userInitials = React.useMemo(() => {
    if (profile?.full_name) {
      const parts = profile.full_name.trim().split(/\s+/)
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      }
      return profile.full_name.slice(0, 2).toUpperCase()
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase()
    }
    return "ST"
  }, [profile, user])

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate("/")
    } catch (err) {
      console.error("[Header] Logout error:", err)
    }
  }

  const handleLoggedOutNav = (item: typeof loggedOutNavItems[number]) => {
    if (item.tab) {
      onTabChange(item.tab)
    } else if (item.anchor) {
      if (currentTab !== "home") {
        onTabChange("home")
        setTimeout(() => {
          const el = document.getElementById(item.anchor!)
          if (el) el.scrollIntoView({ behavior: "smooth" })
        }, 120)
      } else {
        const el = document.getElementById(item.anchor)
        if (el) el.scrollIntoView({ behavior: "smooth" })
      }
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full transition-colors">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* GROUP 1 (LEFT): Pure brand logo only — zero badge, zero clutter */}
        <button
          type="button"
          onClick={() => onTabChange("home")}
          className="group flex cursor-pointer items-center rounded-lg py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring text-left"
          aria-label="ZENWAY Campus Mobility Home"
        >
          <ZenwayLogo
            size="md"
            withBadge={false}
            className="transition-transform duration-200 group-hover:scale-[1.02]"
          />
        </button>

        {/* GROUP 2 (RIGHT): Post-Login Minimalist Avatar OR Logged-Out Floating Pill Nav */}
        {user ? (
          /* Logged-In Top Bar: Notifications bell & Minimal Avatar with Verified Badge */
          <div className="flex items-center gap-2">
            <NotificationsDropdown />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="relative size-9 rounded-full ring-1 ring-border/80 hover:ring-primary/40 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center justify-center bg-card shadow-xs shrink-0"
                    aria-label="Student profile and account menu"
                  >
                    <Avatar className="size-8.5">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-[11px]">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>

                    {/* Tiny 14px sage/emerald verified checkmark badge anchored at bottom-right */}
                    {isVerified && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center p-0.5 border border-background shadow-xs"
                        title="Verified Student ID"
                      >
                        <ShieldCheck className="size-2.5 stroke-[2.5]" />
                      </span>
                    )}
                  </button>
                }
              />
              <DropdownMenuContent align="end" sideOffset={8} className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal px-2 py-1.5">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold leading-none text-foreground truncate max-w-[150px]">
                          {profile?.full_name || "Campus Student"}
                        </p>
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[9px] font-semibold capitalize ${
                            isVerified
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : isPending
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              : isSuspended
                              ? "bg-destructive/15 text-destructive"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {profile?.verification_status || "Unverified"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate font-mono">
                        {user.email}
                      </p>
                      {profile?.university_name && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {profile.university_name}
                        </p>
                      )}
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {isAdmin && (
                    <DropdownMenuItem
                      onClick={() => navigate("/admin/registrations")}
                      className="gap-2 cursor-pointer text-primary font-medium"
                    >
                      <UserCheck className="size-4" />
                      <span>Admin Approval Queue</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => onTabChange("profile")}
                    className="gap-2 cursor-pointer"
                  >
                    <User className="size-4 text-muted-foreground" />
                    <span>Student Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/verification-status")}
                    className="gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="size-4 text-muted-foreground" />
                    <span>Verification Standing</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onTabChange("activity")}
                    className="gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="size-4 text-muted-foreground" />
                    <span>My Active Activity</span>
                  </DropdownMenuItem>
                  <div className="px-2 py-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Appearance</span>
                    <ThemeToggle />
                  </div>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  className="gap-2 cursor-pointer text-destructive"
                  onClick={handleSignOut}
                >
                  <LogOut className="size-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          /* Logged-Out Top Bar: Desktop Floating Pill Nav + Mobile Compact CTA */
          <div className="flex items-center gap-2">
            <nav
              className="hidden md:flex items-center gap-1.5 rounded-full border border-border/80 bg-[var(--bg-surface)]/90 backdrop-blur-md px-2 py-1.5 shadow-xs"
              aria-label="Main Navigation"
            >
              {loggedOutNavItems.map((item) => {
                const isActive = item.tab && currentTab === item.tab
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleLoggedOutNav(item)}
                    aria-current={isActive ? "page" : undefined}
                    className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isActive
                        ? "bg-background text-primary shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                )
              })}

              <div className="h-4 w-[1px] bg-border/70 mx-0.5" aria-hidden="true" />

              {/* Guest Theme Toggle */}
              <div className="flex items-center px-1">
                <ThemeToggle />
              </div>

              <div className="h-4 w-[1px] bg-border/70 mx-0.5" aria-hidden="true" />

              {/* Explicit Guest Login Option */}
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                LOGIN
              </button>

              {/* Single Solid High-Contrast CTA */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/register")}
                className="h-8 px-4 rounded-full bg-primary hover:bg-primary/95 text-primary-foreground text-[11px] font-semibold tracking-[0.12em] uppercase cursor-pointer transition-all shadow-xs flex items-center gap-1 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>GET STARTED</span>
                <ArrowRight className="size-3" />
              </motion.button>
            </nav>

            {/* Mobile guest compact login button */}
            <div className="flex md:hidden items-center gap-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="h-8 px-3 rounded-full bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1 shrink-0"
              >
                <span>Log In</span>
                <ArrowRight className="size-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
