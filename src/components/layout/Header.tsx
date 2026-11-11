import * as React from "react"
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  User,
  LogOut,
  ShieldAlert,
  FileCheck2,
  UserCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { ZenwayLogo } from "@/components/brand/ZenwayLogo"
import { NotificationsDropdown } from "@/components/notifications/NotificationsDropdown"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"

export type NavTab = "home" | "rent" | "ride" | "carry" | "activity" | "profile"

interface HeaderProps {
  currentTab: NavTab
  onTabChange: (tab: NavTab) => void
}

const navItems: { id: NavTab; label: string; badge?: string }[] = [
  { id: "home", label: "Home" },
  { id: "rent", label: "RENT", badge: "Vehicles" },
  { id: "ride", label: "RIDE", badge: "Carpool" },
  { id: "carry", label: "CARRY", badge: "Peer Drop" },
  { id: "activity", label: "My Activity" },
]

export function Header({ currentTab, onTabChange }: HeaderProps) {
  const { user, profile, latestVerification, signOut, isVerified, isPending, isUnverified, isSuspended, isAdmin } = useAuth()
  const { navigate } = useRouter()

  // Compute student initials from profile or email
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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Area: Official Concept 4 Logo */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => onTabChange("home")}
            className="group flex cursor-pointer items-center rounded-lg py-1 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-ring text-left"
            aria-label="ZENWAY Campus Mobility Home"
          >
            <ZenwayLogo
              size="md"
              withBadge={true}
              className="transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </button>

          {/* Desktop Navigation Links */}
          <nav
            className="hidden md:flex items-center gap-1 ml-2"
            aria-label="Main Navigation"
          >
            {navItems.map((item) => {
              const isActive = currentTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive
                      ? "text-primary bg-primary/10 font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] uppercase tracking-wider px-1 py-0.2 rounded font-semibold transition-opacity ${
                        isActive
                          ? "bg-primary text-primary-foreground opacity-90"
                          : "bg-muted text-muted-foreground opacity-60 group-hover:opacity-100"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute -bottom-2.5 inset-x-3 h-0.5 bg-primary rounded-full transition-all" />
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Right Action Cluster */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              {/* Admin Registration Approvals Quick Pill */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => navigate("/admin/registrations")}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Admin registration approval queue"
                >
                  <UserCheck className="size-3.5" />
                  <span className="hidden sm:inline">Admin Approvals</span>
                  <span className="inline sm:hidden">Admin</span>
                </button>
              )}

              {/* Student Verification Indicator */}
              {isVerified && (
                <button
                  type="button"
                  onClick={() => navigate("/verification-status")}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 transition-colors hover:bg-emerald-500/20 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Student verification status: Verified"
                >
                  <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Verified Student</span>
                  <span className="inline sm:hidden">Verified</span>
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </button>
              )}

              {isPending && (
                <button
                  type="button"
                  onClick={() => navigate("/verification-status")}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 transition-colors hover:bg-amber-500/20 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Student verification status: Pending review"
                >
                  <Clock className="size-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
                  <span className="hidden sm:inline">Review Pending</span>
                  <span className="inline sm:hidden">Pending</span>
                </button>
              )}

              {isUnverified && (
                <button
                  type="button"
                  onClick={() => navigate(latestVerification?.status === "rejected" ? "/verification-status" : "/verify-student")}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Student verification status: Unverified"
                >
                  <FileCheck2 className="size-3.5" />
                  <span className="hidden sm:inline">Verify Student ID</span>
                  <span className="inline sm:hidden">Verify</span>
                </button>
              )}

              {isSuspended && (
                <button
                  type="button"
                  onClick={() => navigate("/verification-status")}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Student verification status: Suspended"
                >
                  <ShieldAlert className="size-3.5" />
                  <span className="hidden sm:inline">Suspended</span>
                </button>
              )}

              {/* Notifications Dropdown */}
              <NotificationsDropdown />

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Profile Avatar with Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="rounded-full ring-2 ring-primary/20 hover:ring-primary/50 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                      aria-label="Student account menu"
                    >
                      <Avatar className="size-9 border border-border">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  }
                />
                <DropdownMenuContent align="end" sideOffset={6} className="w-64">
                  <DropdownMenuLabel className="font-normal px-2 py-1.5">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold leading-none text-foreground truncate max-w-[150px]">
                          {profile?.full_name || "Campus Student"}
                        </p>
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[9px] font-semibold capitalize ${
                            isVerified
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : isPending
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : isSuspended
                              ? "bg-destructive/10 text-destructive"
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

              {/* Direct Quick Sign Out Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="h-8.5 px-2.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive gap-1.5 cursor-pointer shadow-2xs font-medium"
                aria-label="Sign out of account"
                title="Sign Out"
              >
                <LogOut className="size-3.5" />
                <span className="inline">Sign Out</span>
              </Button>
            </>
          ) : (
            <>
              {/* Logged Out Controls */}
              <ThemeToggle />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/login")}
                className="text-xs font-semibold cursor-pointer h-9 px-3 hover:bg-muted/70 text-foreground"
              >
                Log In
              </Button>

              <Button
                size="sm"
                onClick={() => navigate("/register")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold cursor-pointer h-9 px-3.5 shadow-xs"
              >
                Get Started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
