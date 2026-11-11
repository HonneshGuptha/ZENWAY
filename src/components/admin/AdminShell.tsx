import * as React from "react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import { ZenwayLogo } from "@/components/brand/ZenwayLogo"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  UserCheck,
  FileCheck2,
  Users,
  ShieldAlert,
  FileText,
  LogOut,
  ExternalLink,
  Shield,
} from "lucide-react"

interface AdminShellProps {
  children: React.ReactNode
  currentSection: "dashboard" | "registrations" | "verifications" | "users" | "moderation" | "disputes" | "reports"
}

const adminNavItems = [
  { id: "dashboard", label: "Overview", path: "/admin/dashboard", icon: LayoutDashboard },
  { id: "registrations", label: "Registrations", path: "/admin/registrations", icon: UserCheck },
  { id: "verifications", label: "Student IDs", path: "/admin/verifications", icon: FileCheck2 },
  { id: "users", label: "User Directory", path: "/admin/users", icon: Users },
  { id: "moderation", label: "Moderation", path: "/admin/moderation", icon: ShieldAlert },
  { id: "disputes", label: "Disputes", path: "/admin/disputes", icon: Shield },
  { id: "reports", label: "Audit Reports", path: "/admin/reports", icon: FileText },
]

export function AdminShell({ children, currentSection }: AdminShellProps) {
  const { user, profile, adminSignOut } = useAuth()
  const { navigate } = useRouter()

  const handleSignOut = async () => {
    try {
      await adminSignOut()
      navigate("/admin/login")
    } catch (err) {
      console.error("[AdminShell] Sign out error:", err)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate("/admin/dashboard")}
              className="flex items-center gap-2 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-1 pr-2"
            >
              <ZenwayLogo size="sm" withBadge={false} />
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-destructive/15 text-destructive font-mono text-[11px] font-bold uppercase tracking-wider">
                <Shield className="size-3" />
                Admin Portal
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Environment Badge */}
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-border bg-muted/60 text-[11px] font-mono text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              CAMPUS OPS SECURE
            </span>

            {/* Admin identity */}
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-semibold text-foreground">
                {profile?.full_name || "Campus Admin"}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {user?.email}
              </span>
            </div>

            {/* Switch to Student View */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/")}
              className="hidden sm:inline-flex gap-1.5 text-xs h-8 cursor-pointer"
            >
              <ExternalLink className="size-3" />
              <span>Student App</span>
            </Button>

            <ThemeToggle />

            {/* Admin Sign Out */}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleSignOut}
              className="gap-1.5 text-xs h-8 px-2.5 cursor-pointer shadow-xs font-semibold"
            >
              <LogOut className="size-3" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>

        {/* Admin Navigation Ribbon */}
        <div className="border-t border-border/60 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
            {adminNavItems.map((item) => {
              const Icon = item.icon
              const isActive = currentSection === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* Main Admin Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}
