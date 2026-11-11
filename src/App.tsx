import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { AppShell } from "@/components/layout/AppShell"
import { RouteGuard } from "@/components/auth/RouteGuard"
import { HomeLanding } from "@/components/home/HomeLanding"
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

// Exchange modules
const RentPage = React.lazy(() => import("@/pages/exchange/RentPage").then(m => ({ default: m.RentPage })))
const RidePage = React.lazy(() => import("@/pages/exchange/RidePage").then(m => ({ default: m.RidePage })))
const CarryPage = React.lazy(() => import("@/pages/exchange/CarryPage").then(m => ({ default: m.CarryPage })))
const ActivityPage = React.lazy(() => import("@/pages/activity/ActivityPage").then(m => ({ default: m.ActivityPage })))

// Support and Legal pages
const TermsPage = React.lazy(() => import("@/pages/legal/TermsPage").then(m => ({ default: m.TermsPage })))
const PrivacyPage = React.lazy(() => import("@/pages/legal/PrivacyPage").then(m => ({ default: m.PrivacyPage })))
const HelpPage = React.lazy(() => import("@/pages/support/HelpPage").then(m => ({ default: m.HelpPage })))
const ContactPage = React.lazy(() => import("@/pages/support/ContactPage").then(m => ({ default: m.ContactPage })))

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
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
      <div className="size-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      <span className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
        Loading...
      </span>
    </div>
  )
}

function App() {
  const { currentPath, currentTab, onTabChange } = useRouter()

  const isAdminPath = currentPath.startsWith("/admin")

  // Render dedicated Admin portal routes outside the student AppShell
  if (isAdminPath) {
    return (
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
          </AnimatePresence>
        </React.Suspense>
      </RouteGuard>
    )
  }

  // Student Application Routes with AppShell
  return (
    <RouteGuard>
      <AppShell currentTab={currentTab} onTabChange={onTabChange}>
        <div className="w-full">
          <React.Suspense fallback={<PageLoadingFallback />}>
            <AnimatePresence mode="wait">
              {/* 1. AUTHENTICATION ROUTES */}
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

              {/* 2. ONBOARDING ROUTES */}
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

              {/* 4. HOME ROUTE */}
              {currentPath === "/" && currentTab === "home" && (
                <motion.div key="home" variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                  <HomeLanding onNavigate={onTabChange} />
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
            </AnimatePresence>
          </React.Suspense>
        </div>
      </AppShell>
    </RouteGuard>
  )
}

export default App
