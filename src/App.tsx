import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { AppShell } from "@/components/layout/AppShell"
import { RouteGuard } from "@/components/auth/RouteGuard"
import { HomeLanding } from "@/components/home/HomeLanding"
import { AuthenticatedHome } from "@/components/home/AuthenticatedHome"
import { ZenwayLogo } from "@/components/brand/ZenwayLogo"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { MascotLoader } from "@/components/ui/MascotLoader"
import { EntryIntro } from "@/components/ui/EntryIntro"
import { hasSeenIntro } from "@/components/ui/mascotConstants"
import { MascotNotificationToast } from "@/components/notifications/MascotNotificationToast"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import { pageTransitionVariants } from "@/lib/motion"

// Lazy-loaded auth, onboarding and profile pages
const LoginPage = React.lazy(() => import("@/pages/auth/LoginPage").then(m => ({ default: m.LoginPage })))
const RegisterPage = React.lazy(() => import("@/pages/auth/RegisterPage").then(m => ({ default: m.RegisterPage })))
const ForgotPasswordPage = React.lazy(() => import("@/pages/auth/ForgotPasswordPage").then(m => ({ default: m.ForgotPasswordPage })))
const AuthCallbackPage = React.lazy(() => import("@/pages/auth/AuthCallbackPage").then(m => ({ default: m.AuthCallbackPage })))
const VerifyStudentPage = React.lazy(() => import("@/pages/onboarding/VerifyStudentPage").then(m => ({ default: m.VerifyStudentPage })))
const VerificationStatusPage = React.lazy(() => import("@/pages/onboarding/VerificationStatusPage").then(m => ({ default: m.VerificationStatusPage })))
const StudentProfilePage = React.lazy(() => import("@/pages/profile/StudentProfilePage").then(m => ({ default: m.StudentProfilePage })))

// Eagerly imported core exchange tab pages to eliminate route-switch lag when jumping to middle/third navbar tabs
import { RentPage } from "@/pages/exchange/RentPage"
import { RidePage } from "@/pages/exchange/RidePage"
import { CarryPage } from "@/pages/exchange/CarryPage"
import { ActivityPage } from "@/pages/activity/ActivityPage"

// Support and Legal pages
const TermsPage = React.lazy(() => import("@/pages/legal/TermsPage").then(m => ({ default: m.TermsPage })))
const PrivacyPage = React.lazy(() => import("@/pages/legal/PrivacyPage").then(m => ({ default: m.PrivacyPage })))
const HelpPage = React.lazy(() => import("@/pages/support/HelpPage").then(m => ({ default: m.HelpPage })))
const ContactPage = React.lazy(() => import("@/pages/support/ContactPage").then(m => ({ default: m.ContactPage })))
const NotFoundPage = React.lazy(() => import("@/pages/support/NotFoundPage").then(m => ({ default: m.NotFoundPage })))

// Dedicated Admin Portal Pages
const AdminLoginPage = React.lazy(() => import("@/pages/admin/AdminLoginPage").then(m => ({ default: m.AdminLoginPage })))
const AdminDashboardPage = React.lazy(() => import("@/pages/admin/AdminDashboardPage").then(m => ({ default: m.AdminDashboardPage })))
const AdminRegistrationsPage = React.lazy(() => import("@/pages/admin/AdminRegistrationsPage").then(m => ({ default: m.AdminRegistrationsPage })))
const AdminVerificationsPage = React.lazy(() => import("@/pages/admin/AdminVerificationsPage").then(m => ({ default: m.AdminVerificationsPage })))
const AdminUsersPage = React.lazy(() => import("@/pages/admin/AdminUsersPage").then(m => ({ default: m.AdminUsersPage })))
const AdminModerationPage = React.lazy(() => import("@/pages/admin/AdminModerationPage").then(m => ({ default: m.AdminModerationPage })))
const AdminDisputesPage = React.lazy(() => import("@/pages/admin/AdminDisputesPage").then(m => ({ default: m.AdminDisputesPage })))
const AdminReportsPage = React.lazy(() => import("@/pages/admin/AdminReportsPage").then(m => ({ default: m.AdminReportsPage })))

function PageLoadingFallback() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-pulse py-6 px-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-muted/60 rounded-md" />
          <div className="h-4 w-72 bg-muted/40 rounded-md" />
        </div>
        <div className="h-9 w-32 bg-muted/60 rounded-md" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-44 rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-5 w-32 bg-muted/50 rounded" />
              <div className="h-5 w-16 bg-muted/50 rounded-full" />
            </div>
            <div className="h-4 w-full bg-muted/30 rounded" />
            <div className="h-4 w-2/3 bg-muted/30 rounded" />
            <div className="pt-4 flex justify-between items-center border-t border-border/20">
              <div className="h-6 w-20 bg-muted/50 rounded" />
              <div className="h-8 w-24 bg-muted/60 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function App() {
  const { user, isLoading } = useAuth()
  const { currentPath, currentTab, onTabChange } = useRouter()
  const [showIntro, setShowIntro] = React.useState(() => {
    try {
      return !hasSeenIntro()
    } catch {
      return false
    }
  })

  // Optional: Listen for manual replay requests from UI
  React.useEffect(() => {
    const handleReplay = () => setShowIntro(true)
    window.addEventListener("zenway:replay-intro", handleReplay)
    return () => window.removeEventListener("zenway:replay-intro", handleReplay)
  }, [])

  // 1. Persistent first-visit intro animation plays FIRST on site entry (never show MascotLoader before EntryIntro)
  if (showIntro) {
    return <EntryIntro onComplete={() => setShowIntro(false)} />
  }

  // 2. Auth hydration loader (renders genuinely while session is being verified, without artificial delays)
  if (isLoading) {
    return (
      <MascotLoader
        message="Restoring Campus Session..."
        fullscreen={true}
      />
    )
  }

  const isAdminPath = currentPath.startsWith("/admin")
  const isKnownAdminPath =
    currentPath === "/admin/login" ||
    currentPath === "/admin/dashboard" ||
    currentPath === "/admin/registrations" ||
    currentPath === "/admin/verifications" ||
    currentPath === "/admin/users" ||
    currentPath === "/admin/moderation" ||
    currentPath === "/admin/disputes" ||
    currentPath === "/admin/reports"

  const isAuthPath =
    currentPath === "/login" ||
    currentPath === "/register" ||
    currentPath === "/forgot-password" ||
    currentPath === "/auth/callback"

  const isKnownStudentPath =
    (currentPath === "/" && currentTab === "home") ||
    currentPath === "/rent" ||
    currentPath === "/ride" ||
    currentPath === "/carry" ||
    currentPath === "/activity" ||
    currentPath === "/profile" ||
    currentTab === "rent" ||
    currentTab === "ride" ||
    currentTab === "carry" ||
    currentTab === "activity" ||
    currentTab === "profile" ||
    currentPath === "/verify-student" ||
    currentPath === "/verification-status" ||
    currentPath === "/terms" ||
    currentPath === "/privacy" ||
    currentPath === "/help" ||
    currentPath === "/contact"

  // Render dedicated Admin portal routes outside the student AppShell
  if (isAdminPath) {
    return (
      <>
        <RouteGuard>
          <React.Suspense fallback={<PageLoadingFallback />}>
            <AnimatePresence mode="wait">
              {currentPath === "/admin/login" && (
                <motion.div key="admin-login" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                  <AdminLoginPage />
                </motion.div>
              )}

              {currentPath === "/admin/dashboard" && (
                <motion.div key="admin-dashboard" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                  <AdminDashboardPage />
                </motion.div>
              )}

              {currentPath === "/admin/registrations" && (
                <motion.div key="admin-registrations" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                  <AdminRegistrationsPage />
                </motion.div>
              )}

              {currentPath === "/admin/verifications" && (
                <motion.div key="admin-verifications" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                  <AdminVerificationsPage />
                </motion.div>
              )}

              {currentPath === "/admin/users" && (
                <motion.div key="admin-users" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                  <AdminUsersPage />
                </motion.div>
              )}

              {currentPath === "/admin/moderation" && (
                <motion.div key="admin-moderation" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                  <AdminModerationPage />
                </motion.div>
              )}

              {currentPath === "/admin/disputes" && (
                <motion.div key="admin-disputes" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                  <AdminDisputesPage />
                </motion.div>
              )}

              {currentPath === "/admin/reports" && (
                <motion.div key="admin-reports" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                  <AdminReportsPage />
                </motion.div>
              )}

              {currentPath === "/admin" && (
                <motion.div key="admin-root" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                  <AdminDashboardPage />
                </motion.div>
              )}

              {!isKnownAdminPath && currentPath !== "/admin" && (
                <motion.div key="admin-not-found" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                  <NotFoundPage />
                </motion.div>
              )}
            </AnimatePresence>
          </React.Suspense>
        </RouteGuard>
        <MascotNotificationToast />
      </>
    )
  }

  // Render dedicated Full-Screen Authentication routes outside the student AppShell
  if (isAuthPath) {
    return (
      <>
        <RouteGuard>
          <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
            <header className="w-full border-b border-border/60 bg-background/85 backdrop-blur-md sticky top-0 z-40">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onTabChange("home")}
                  className="group flex cursor-pointer items-center rounded-lg py-1 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-ring text-left"
                  aria-label="ZENWAY Campus Mobility Home"
                >
                  <ZenwayLogo size="md" withBadge={true} className="transition-transform duration-200 group-hover:scale-[1.02]" />
                </button>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                </div>
              </div>
            </header>

            <main className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
              <React.Suspense fallback={<PageLoadingFallback />}>
                <AnimatePresence mode="wait">
                  {currentPath === "/login" && (
                    <motion.div key="login" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                      <LoginPage />
                    </motion.div>
                  )}

                  {currentPath === "/register" && (
                    <motion.div key="register" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                      <RegisterPage />
                    </motion.div>
                  )}

                  {currentPath === "/forgot-password" && (
                    <motion.div key="forgot-password" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                      <ForgotPasswordPage />
                    </motion.div>
                  )}

                  {currentPath === "/auth/callback" && (
                    <motion.div key="auth-callback" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                      <AuthCallbackPage />
                    </motion.div>
                  )}
                </AnimatePresence>
              </React.Suspense>
            </main>
          </div>
        </RouteGuard>
        <MascotNotificationToast />
      </>
    )
  }

  // Student Application Routes with AppShell
  return (
    <>
      <RouteGuard>
        <AppShell currentTab={currentTab} onTabChange={onTabChange}>
          <div className="w-full">
            <React.Suspense fallback={<PageLoadingFallback />}>
              <AnimatePresence mode="wait">
                {/* 1. ONBOARDING ROUTES */}
                {currentPath === "/verify-student" && (
                  <motion.div key="verify-student" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                    <VerifyStudentPage />
                  </motion.div>
                )}

                {currentPath === "/verification-status" && (
                  <motion.div key="verification-status" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                    <VerificationStatusPage />
                  </motion.div>
                )}

                {/* 3. PROFILE ROUTE */}
                {(currentPath === "/profile" || currentTab === "profile") && (
                  <motion.div key="profile" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                    <StudentProfilePage />
                  </motion.div>
                )}

                {/* 4. HOME ROUTE: Authenticated Hub for Students, Marketing Landing for Guests */}
                {currentPath === "/" && currentTab === "home" && (
                  <motion.div
                    key={user ? "authenticated-home" : "guest-home"}
                    variants={pageTransitionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    {user ? (
                      <AuthenticatedHome onNavigate={onTabChange} />
                    ) : (
                      <HomeLanding onNavigate={onTabChange} />
                    )}
                  </motion.div>
                )}

                {/* 5. EXCHANGE SERVICE ROUTES */}
                {(currentPath === "/rent" || currentTab === "rent") && (
                  <motion.div key="rent" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                    <RentPage />
                  </motion.div>
                )}

                {(currentPath === "/ride" || currentTab === "ride") && (
                  <motion.div key="ride" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                    <RidePage />
                  </motion.div>
                )}

                {(currentPath === "/carry" || currentTab === "carry") && (
                  <motion.div key="carry" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                    <CarryPage />
                  </motion.div>
                )}

                {/* 6. UNIFIED ACTIVITY ROUTE */}
                {(currentPath === "/activity" || currentTab === "activity") && (
                  <motion.div key="activity" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                    <ActivityPage />
                  </motion.div>
                )}

                {/* 7. SUPPORT & LEGAL ROUTES */}
                {currentPath === "/terms" && (
                  <motion.div key="terms" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                    <TermsPage />
                  </motion.div>
                )}

                {currentPath === "/privacy" && (
                  <motion.div key="privacy" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                    <PrivacyPage />
                  </motion.div>
                )}

                {currentPath === "/help" && (
                  <motion.div key="help" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                    <HelpPage />
                  </motion.div>
                )}

                {currentPath === "/contact" && (
                  <motion.div key="contact" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                    <ContactPage />
                  </motion.div>
                )}

                {/* 8. 404 NOT FOUND FALLBACK */}
                {!isKnownStudentPath && (
                  <motion.div key="not-found" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                    <NotFoundPage />
                  </motion.div>
                )}
              </AnimatePresence>
            </React.Suspense>
          </div>
        </AppShell>
      </RouteGuard>
      <MascotNotificationToast />
    </>
  )
}

export default App
