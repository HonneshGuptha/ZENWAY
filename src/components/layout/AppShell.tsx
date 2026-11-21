import * as React from "react"
import { Header, type NavTab } from "./Header"
import { MobileNav } from "./MobileNav"
import { BottomDock } from "./BottomDock"
import { useAuth } from "@/context/AuthContext"

interface AppShellProps {
  children?: React.ReactNode
  currentTab?: NavTab
  onTabChange?: (tab: NavTab) => void
}

export function AppShell({
  children,
  currentTab: controlledTab,
  onTabChange: setControlledTab,
}: AppShellProps) {
  const { user } = useAuth()
  const [internalTab, setInternalTab] = React.useState<NavTab>("home")
  const currentTab = controlledTab ?? internalTab

  const handleTabChange = (tab: NavTab) => {
    if (setControlledTab) {
      setControlledTab(tab)
    } else {
      setInternalTab(tab)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
      {/* Global Header */}
      <Header currentTab={currentTab} onTabChange={handleTabChange} />

      {/* Main Content Area: pb-28 when logged in ensures page content is never hidden behind floating bottom dock */}
      <main className={`flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 ${user ? "pb-28" : "pb-20 md:pb-8"}`}>
        {children}
      </main>

      {/* Post-Login Centered Floating Bottom Glass Dock (Desktop & Mobile) */}
      {user && (
        <BottomDock currentTab={currentTab} onTabChange={handleTabChange} />
      )}

      {/* Guest Mobile Bottom Navigation */}
      {!user && (
        <MobileNav currentTab={currentTab} onTabChange={handleTabChange} />
      )}
    </div>
  )
}
