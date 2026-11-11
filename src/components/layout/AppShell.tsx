import * as React from "react"
import { Header, type NavTab } from "./Header"
import { MobileNav } from "./MobileNav"

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
      {/* Global Desktop & Responsive Header */}
      <Header currentTab={currentTab} onTabChange={handleTabChange} />

      {/* Main Content Area: pb-24 on mobile prevents bottom nav overlap */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
        {children}
      </main>

      {/* Fixed Mobile Bottom Navigation */}
      <MobileNav currentTab={currentTab} onTabChange={handleTabChange} />
    </div>
  )
}
