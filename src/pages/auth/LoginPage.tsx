import * as React from "react"
import { motion } from "motion/react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import { ZenwayLogo } from "@/components/brand/ZenwayLogo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Loader2,
  ArrowRight,
  AlertCircle,
  KeyRound,
  Mail,
  CheckCircle2,
  Eye,
  EyeOff,
  Clock,
  ShieldAlert,
  Shield,
} from "lucide-react"
import { pageTransitionVariants } from "@/lib/motion"
import { MascotLoader } from "@/components/ui/MascotLoader"

export function LoginPage() {
  const { user, signIn } = useAuth()
  const { navigate, queryParams } = useRouter()

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isLoginTransitioning, setIsLoginTransitioning] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [pendingApprovalMsg, setPendingApprovalMsg] = React.useState<string | null>(null)
  const [rejectedMsg, setRejectedMsg] = React.useState<string | null>(null)

  const redirectTarget = queryParams.get("redirect") || "/"
  const isConfirmed = queryParams.get("confirmed") === "true"
  const isResetSuccess = queryParams.get("reset") === "success"
  const transitionTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up transition state and pending timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current)
      }
      try {
        sessionStorage.removeItem("zenway_auth_transition")
      } catch {
        // ignore
      }
    }
  }, [])

  // Automatically redirect already authenticated users who land on /login directly
  React.useEffect(() => {
    const isTransitioning = (() => {
      try {
        return sessionStorage.getItem("zenway_auth_transition") === "true"
      } catch {
        return false
      }
    })()

    if (user && !isSubmitting && !isLoginTransitioning && !isTransitioning) {
      navigate(redirectTarget, { replace: true })
    }
  }, [user, navigate, redirectTarget, isSubmitting, isLoginTransitioning])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setPendingApprovalMsg(null)
    setRejectedMsg(null)

    if (!email || !password) {
      setErrorMessage("Please enter both your email address and password.")
      return
    }

    try {
      setIsSubmitting(true)
      try {
        sessionStorage.setItem("zenway_auth_transition", "true")
      } catch {
        // ignore
      }
      const data = await signIn(email.trim(), password)
      setIsLoginTransitioning(true)
      let target = redirectTarget
      if (target === "/") {
        try {
          const parts = data?.session?.access_token?.split(".")
          if (parts && parts.length >= 2) {
            const claims = JSON.parse(atob(parts[1]))
            if (claims.user_role === "admin" || claims.role === "admin") {
              target = "/admin/registrations"
            }
          }
        } catch {
          // fallback to default target
        }
      }
      // Hold smooth transition window (2200ms) with MascotLoader to ensure auth session and profile hydrate seamlessly
      await new Promise<void>((resolve) => {
        transitionTimeoutRef.current = setTimeout(() => {
          resolve()
        }, 2200)
      })
      try {
        sessionStorage.removeItem("zenway_auth_transition")
      } catch {
        // ignore
      }
      navigate(target)
    } catch (err: any) {
      try {
        sessionStorage.removeItem("zenway_auth_transition")
      } catch {
        // ignore
      }
      setIsLoginTransitioning(false)
      console.error("[Login] Error:", err)
      const msg = err.message || ""

      if (msg.includes("REGISTRATION_PENDING") || msg.includes("Error running hook URI") || msg.includes("custom_access_token_hook")) {
        const cleanMsg = msg.replace(/^.*REGISTRATION_PENDING:\s*/, "")
        setPendingApprovalMsg(
          cleanMsg.includes("hook URI") || cleanMsg.includes("custom_access_token_hook")
            ? "Your registration is currently pending administrator review and approval. You will receive platform access once an administrator approves your account."
            : (cleanMsg || "Your registration is currently pending administrator review and approval. You will receive platform access once an administrator approves your account.")
        )
      } else if (msg.includes("REGISTRATION_REJECTED")) {
        const cleanMsg = msg.replace(/^.*REGISTRATION_REJECTED:\s*/, "")
        setRejectedMsg(
          cleanMsg ||
          "Your registration was rejected by campus administration."
        )
      } else if (msg.includes("Invalid login credentials")) {
        setErrorMessage("Invalid email or password. Please verify your credentials.")
      } else if (msg.includes("Email not confirmed")) {
        setErrorMessage("Please confirm your email address via the link sent to your inbox before logging in.")
      } else {
        setErrorMessage(msg || "Failed to sign in. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoginTransitioning) {
    return (
      <MascotLoader
        message="Setting up your campus commute hub..."
        fullscreen={true}
      />
    )
  }

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-[75vh] flex items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-block cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-1"
          >
            <ZenwayLogo size="lg" withBadge={false} />
          </button>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground pt-1">
            Welcome back
          </h1>
          <p className="text-xs text-muted-foreground">
            Sign in to your campus mobility account
          </p>
        </div>

        {/* Auth Mode Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-muted/60 border border-border/60 text-xs font-semibold">
          <button
            type="button"
            className="py-2.5 rounded-lg bg-card text-foreground shadow-xs text-center cursor-default font-bold"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => navigate("/register")}
            className="py-2.5 rounded-lg text-muted-foreground hover:text-foreground text-center cursor-pointer transition-colors"
          >
            Create Account
          </button>
        </div>

        {/* Pending Registration Approval Alert */}
        {pendingApprovalMsg && (
          <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200">
            <Clock className="size-4 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <AlertTitle className="text-xs font-semibold">
                Registration Pending Administrator Approval
              </AlertTitle>
              <AlertDescription className="text-xs leading-relaxed">
                {pendingApprovalMsg}
              </AlertDescription>
            </div>
          </Alert>
        )}

        {/* Rejected Registration Alert */}
        {rejectedMsg && (
          <Alert variant="destructive" className="border-destructive/40 bg-destructive/10 text-destructive">
            <ShieldAlert className="size-4 mt-0.5" />
            <div className="space-y-1">
              <AlertTitle className="text-xs font-semibold">
                Registration Rejected
              </AlertTitle>
              <AlertDescription className="text-xs leading-relaxed">
                {rejectedMsg}
              </AlertDescription>
            </div>
          </Alert>
        )}

        {/* Email confirmed notice */}
        {isConfirmed && (
          <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            <AlertDescription className="text-xs">
              Email confirmed successfully! Your registration is now pending administrator review.
            </AlertDescription>
          </Alert>
        )}

        {/* Password reset success notice */}
        {isResetSuccess && (
          <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            <AlertDescription className="text-xs">
              Password has been successfully reset. Please log in with your new password.
            </AlertDescription>
          </Alert>
        )}

        {/* Standard error notice */}
        {errorMessage && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/10 text-destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs font-medium">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Form Card */}
        <Card className="border-border/80 shadow-sm bg-card/95 backdrop-blur-xs">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Email Address</Label>
                <div className="relative">
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="student@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="pl-9 h-10 text-sm"
                  />
                  <Mail className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Password</Label>
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-xs text-primary hover:underline cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="pl-9 pr-10 h-10 text-sm font-mono"
                  />
                  <KeyRound className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-1 top-1 size-8 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 min-h-[44px] font-semibold gap-2 cursor-pointer shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              <div className="text-center text-xs text-muted-foreground">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/register")}
                  className="font-semibold text-primary hover:underline cursor-pointer"
                >
                  Create student account
                </button>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Security badge footer */}
        <div className="space-y-2 text-center">
          <p className="text-[11px] text-muted-foreground">
            Protected by Supabase Auth with Row Level Security.
          </p>
          <div>
            <button
              type="button"
              onClick={() => navigate("/admin/login")}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Shield className="size-3 text-destructive" />
              <span>Campus Administrator Portal</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
