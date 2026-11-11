import * as React from "react"
import type { NavTab } from "@/components/layout/Header"

interface RouterContextType {
  currentPath: string
  navigate: (to: string, options?: { replace?: boolean }) => void
  currentTab: NavTab
  onTabChange: (tab: NavTab) => void
  queryParams: URLSearchParams
}

const RouterContext = React.createContext<RouterContextType | null>(null)

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [currentPath, setCurrentPath] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.location.pathname || "/"
    }
    return "/"
  })

  const [queryParams, setQueryParams] = React.useState<URLSearchParams>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search)
    }
    return new URLSearchParams()
  })

  // Synchronize on browser Back / Forward
  React.useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || "/")
      setQueryParams(new URLSearchParams(window.location.search))
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const navigate = React.useCallback(
    (to: string, options?: { replace?: boolean }) => {
      const url = new URL(to, window.location.origin)
      const pathWithSearch = url.pathname + url.search + url.hash

      if (options?.replace) {
        window.history.replaceState(null, "", pathWithSearch)
      } else {
        window.history.pushState(null, "", pathWithSearch)
      }

      setCurrentPath(url.pathname)
      setQueryParams(new URLSearchParams(url.search))

      // Scroll to top on page change if not an anchor link
      if (!url.hash) {
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    },
    []
  )

  // Map path to active navigation tab
  const currentTab: NavTab = React.useMemo(() => {
    if (currentPath === "/rent") return "rent"
    if (currentPath === "/ride") return "ride"
    if (currentPath === "/carry") return "carry"
    if (currentPath === "/activity") return "activity"
    if (currentPath === "/profile") return "profile"
    return "home"
  }, [currentPath])

  const onTabChange = React.useCallback(
    (tab: NavTab) => {
      switch (tab) {
        case "home":
          navigate("/")
          break
        case "rent":
          navigate("/rent")
          break
        case "ride":
          navigate("/ride")
          break
        case "carry":
          navigate("/carry")
          break
        case "activity":
          navigate("/activity")
          break
        case "profile":
          navigate("/profile")
          break
        default:
          navigate("/")
      }
    },
    [navigate]
  )

  const value = React.useMemo(
    () => ({
      currentPath,
      navigate,
      currentTab,
      onTabChange,
      queryParams,
    }),
    [currentPath, navigate, currentTab, onTabChange, queryParams]
  )

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter() {
  const context = React.useContext(RouterContext)
  if (!context) {
    throw new Error("useRouter must be used within a RouterProvider")
  }
  return context
}
