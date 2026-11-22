import * as React from "react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import { ZenwayLogo } from "@/components/brand/ZenwayLogo"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  UserCheck,
  FileCheck2,
  Users,
  ShieldAlert,
  FileText,
  LogOut,
  ArrowLeft,
  Activity,
  AlertTriangle,
  Terminal,
} from "lucide-react"

interface AdminShellProps {
  children: React.ReactNode
  currentSection: "dashboard" | "registrations" | "verifications" | "users" | "moderation" | "disputes" | "reports" | "reset"
}

const adminNavItems = [
  { id: "dashboard", label: "OVERVIEW", path: "/admin/dashboard", icon: LayoutDashboard },
  { id: "verifications", label: "VERIFICATION QUEUE", path: "/admin/verifications", icon: FileCheck2 },
  { id: "moderation", label: "LIVE EXCHANGES", path: "/admin/moderation", icon: Activity },
  { id: "users", label: "USER DIRECTORY", path: "/admin/users", icon: Users },
  { id: "registrations", label: "REGISTRATIONS", path: "/admin/registrations", icon: UserCheck },
  { id: "disputes", label: "DISPUTES", path: "/admin/disputes", icon: ShieldAlert },
  { id: "reports", label: "AUDIT LOGS", path: "/admin/reports", icon: FileText },
]

/**
 * AdminShell:
 * Scoped "Obsidian Ops" Command Center Console:
 * - Pure matte black (#09090B) operations canvas
 * - Deep elevated panels (#121215) with 1px rgba(255,255,255,0.08) hairline borders
 * - Monospace telemetry, live emerald pulse dot (#10B981) and Vermilion alerts (#EA2E00)
 * - Prominent "← Exit to Student View" quick-switch button
 */
export function AdminShell({ children, currentSection }: AdminShellProps) {
  const { user, profile, adminSignOut } = useAuth()
  const { currentPath, navigate } = useRouter()

  // Derive active section reliably from current URL path with currentSection fallback
  const activeSection = React.useMemo(() => {
    if (currentPath.startsWith("/admin/disputes")) return "disputes"
    if (currentPath.startsWith("/admin/verifications")) return "verifications"
    if (currentPath.startsWith("/admin/moderation")) return "moderation"
    if (currentPath.startsWith("/admin/users")) return "users"
    if (currentPath.startsWith("/admin/registrations")) return "registrations"
    if (currentPath.startsWith("/admin/reports")) return "reports"
    if (currentPath.startsWith("/admin/dashboard")) return "dashboard"
    return currentSection || "dashboard"
  }, [currentPath, currentSection])

  const handleSignOut = async () => {
    try {
      await adminSignOut()
      navigate("/admin/login")
    } catch (err) {
      console.error("[AdminShell] Sign out error:", err)
    }
  }

  const scrollToDangerZone = () => {
    if (window.location.pathname !== "/admin/dashboard") {
      navigate("/admin/dashboard")
      setTimeout(() => {
        const el = document.getElementById("danger-zone")
        if (el) el.scrollIntoView({ behavior: "smooth" })
      }, 150)
    } else {
      const el = document.getElementById("danger-zone")
      if (el) el.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <div
      className="dark min-h-screen bg-[#09090B] text-[#FAFAFA] flex flex-col font-sans antialiased selection:bg-[#EA2E00] selection:text-white"
      style={{
        "--bg-canvas": "#09090B",
        "--bg-surface": "#121215",
        "--bg-surface-muted": "#1C1C21",
        "--text-primary": "#FAFAFA",
        "--text-muted": "#A1A1AA",
        "--border-subtle": "rgba(255, 255, 255, 0.12)",
        "--background": "#09090B",
        "--foreground": "#FAFAFA",
        "--card": "#121215",
        "--card-foreground": "#FAFAFA",
        "--popover": "#121215",
        "--popover-foreground": "#FAFAFA",
        "--muted": "#1C1C21",
        "--muted-foreground": "#A1A1AA",
        "--border": "rgba(255, 255, 255, 0.12)",
        "--input": "rgba(255, 255, 255, 0.15)",
      } as React.CSSProperties}
    >
      {/* Top Ops Header */}
      <header className="sticky top-0 z-50 border-b border-[rgba(255,255,255,0.08)] bg-[#09090B]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand & Command Center Tag */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin/dashboard")}
              className="flex items-center gap-2.5 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-md py-1 pr-2"
              aria-label="Zenway Command Center"
            >
              <ZenwayLogo size="sm" withBadge={false} className="text-[#FAFAFA]" />
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#18181B] border border-[rgba(255,255,255,0.1)] text-[#EA2E00] font-mono text-[10px] font-bold uppercase tracking-widest shadow-xs">
                <Terminal className="size-3" />
                <span>COMMAND CENTER</span>
              </div>
            </button>
          </div>

          {/* Telemetry Indicator & Actions */}
          <div className="flex items-center gap-3">
            {/* Live Telemetry Status */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#121215] text-[11px] font-mono text-zinc-400">
              <span className="size-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>SYS.TELEMETRY:</span>
              <span className="text-[#10B981] font-bold">ONLINE</span>
            </div>

            {/* Quick Switch to Student View */}
            <button
              type="button"
              onClick={() => navigate("/")}
              aria-label="Exit to Student View"
              title="Exit to Student View"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#18181B] hover:bg-[#27272A] text-zinc-200 hover:text-white text-xs font-mono font-medium transition-colors cursor-pointer"
            >
              <ArrowLeft className="size-3.5 text-[#EA2E00]" />
              <span className="hidden sm:inline">Exit to Student View</span>
            </button>

            {/* Admin identity */}
            <div className="hidden lg:flex flex-col text-right pl-2 border-l border-[rgba(255,255,255,0.08)]">
              <span className="text-xs font-medium text-zinc-200">
                {profile?.full_name || "Operations Admin"}
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {user?.email}
              </span>
            </div>

            {/* Admin Sign Out */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="border-red-950/60 bg-red-950/20 hover:bg-red-900/40 text-red-400 hover:text-red-200 gap-1.5 text-xs h-8 px-3 cursor-pointer font-mono font-semibold"
            >
              <LogOut className="size-3" />
              <span className="hidden sm:inline">DISCONNECT</span>
            </Button>
          </div>
        </div>

        {/* Ops Command Navigation Bar */}
        <div className="border-t border-[rgba(255,255,255,0.06)] bg-[#0C0C0E]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-1 overflow-x-auto py-1 scrollbar-none">
            <div className="flex items-center gap-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon
                const isActive = activeSection === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-mono font-semibold tracking-wider whitespace-nowrap transition-colors cursor-pointer outline-none ${
                      isActive
                        ? "bg-[#1C1C22] text-[#FAFAFA] border border-[rgba(255,255,255,0.15)] shadow-xs"
                        : "text-zinc-400 hover:bg-[#18181B] hover:text-zinc-200"
                    }`}
                  >
                    <Icon className={`size-3.5 ${isActive ? "text-[#EA2E00]" : "text-zinc-500"}`} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Direct Danger Zone Link */}
            <button
              type="button"
              onClick={scrollToDangerZone}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono font-semibold tracking-wider text-red-400/90 hover:text-red-300 hover:bg-red-950/30 transition-colors cursor-pointer shrink-0"
            >
              <AlertTriangle className="size-3 text-red-500" />
              <span>SYSTEM & RESET</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Subtle Admin Architect Monospace Footer */}
      <footer className="border-t border-[rgba(255,255,255,0.06)] py-4 text-center">
        <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
          SYS.ARCHITECT // HONNESH N GUPTHA
        </p>
      </footer>
    </div>
  )
}
