import * as React from "react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"

interface RouteGuardProps {
  children: React.ReactNode
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { user, profile, isLoading, isVerified, isPending, isUnverified, isSuspended, isAdmin, adminAccessKeyVerified } = useAuth()
  const { currentPath, navigate } = useRouter()

  const isExchangeRoute =
    currentPath === "/rent" ||
    currentPath === "/ride" ||
    currentPath === "/carry"

  const isAdminRoute = currentPath.startsWith("/admin")
  const isAdminLoginRoute = currentPath === "/admin/login"

  const isProtectedUserRoute =
    currentPath === "/activity" ||
    currentPath === "/profile" ||
    currentPath === "/verify-student" ||
    currentPath === "/verification-status"

  React.useEffect(() => {
    if (isLoading) return

    // 1. Admin login route handling
    if (isAdminLoginRoute) {
      if (user && isAdmin && adminAccessKeyVerified) {
        navigate("/admin/dashboard", { replace: true })
      }
      return
    }

    // 2. Admin portal routes (e.g. /admin/dashboard, /admin/registrations, etc.)
    if (isAdminRoute) {
      if (!user || !isAdmin || !adminAccessKeyVerified) {
        console.warn("[RouteGuard] Unauthorized attempt to access admin portal.")
        navigate("/admin/login", { replace: true })
        return
      }
      return
    }

    // 3. If logged out and trying to access any protected user or exchange route, redirect to /login
    if (!user && (isExchangeRoute || isProtectedUserRoute)) {
      navigate(`/login?redirect=${encodeURIComponent(currentPath)}`, { replace: true })
      return
    }

    // 4. If logged in and on regular auth page (login/register/forgot-password)
    if (user && (currentPath === "/login" || currentPath === "/register" || currentPath === "/forgot-password")) {
      if (isAdmin) {
        navigate(adminAccessKeyVerified ? "/admin/dashboard" : "/admin/login", { replace: true })
        return
      }
      if (isUnverified) {
        navigate("/verify-student", { replace: true })
      } else if (isPending) {
        navigate("/verification-status", { replace: true })
      } else {
        navigate("/", { replace: true })
      }
      return
    }

    // 5. If logged in but attempting an exchange route without being verified
    if (user && isExchangeRoute) {
      if (isSuspended) {
        navigate("/verification-status", { replace: true })
      } else if (isUnverified) {
        navigate("/verify-student", { replace: true })
      } else if (isPending) {
        navigate("/verification-status", { replace: true })
      }
    }
  }, [
    user,
    profile,
    isLoading,
    currentPath,
    isExchangeRoute,
    isProtectedUserRoute,
    isAdminRoute,
    isAdminLoginRoute,
    isVerified,
    isPending,
    isUnverified,
    isSuspended,
    isAdmin,
    adminAccessKeyVerified,
    navigate,
  ])

  // Initial loading state with elegant cinematic pulse
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="size-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
          Restoring Campus Session...
        </p>
      </div>
    )
  }

  return <>{children}</>
}
