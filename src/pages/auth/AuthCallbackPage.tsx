import * as React from "react"
import { motion } from "motion/react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import { ZenwayLogo } from "@/components/brand/ZenwayLogo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2, AlertCircle, KeyRound, ArrowRight } from "lucide-react"
import { pageTransitionVariants } from "@/lib/motion"

export function AuthCallbackPage() {
  const { updatePassword, refreshProfile } = useAuth()
  const { navigate, queryParams } = useRouter()

  const [status, setStatus] = React.useState<"processing" | "recovery" | "error" | "complete">("processing")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Password reset state (when type === 'recovery')
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false)

  React.useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check hash fragments first
        const hash = window.location.hash
        const hashParams = new URLSearchParams(hash.replace(/^#/, ""))

        const error = hashParams.get("error_description") || queryParams.get("error_description")
        if (error) {
          setErrorMessage(decodeURIComponent(error))
          setStatus("error")
          return
        }

        const type = hashParams.get("type") || queryParams.get("type")
        if (type === "recovery") {
          setStatus("recovery")
          return
        }

        // Check for PKCE code in search parameters
        const code = queryParams.get("code")
        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeErr) {
            console.error("[AuthCallback] Exchange error:", exchangeErr)
            setErrorMessage(exchangeErr.message)
            setStatus("error")
            return
          }
        }

        // Wait for session to settle
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
          // Check profile registration approval status
          const { data: prof } = await supabase
            .from("profiles")
            .select("role, registration_status, verification_status")
            .eq("id", session.user.id)
            .maybeSingle()

          const isAdmin = prof?.role === "admin"
          const isApproved = prof?.registration_status === "approved"

          if (!isAdmin && !isApproved) {
            // Unapproved student registrations must NOT retain an active session
            await supabase.auth.signOut()
            setStatus("complete")
            setTimeout(() => {
              navigate("/login?confirmed=true&pending=approval", { replace: true })
            }, 1200)
            return
          }

          await refreshProfile()
          setStatus("complete")

          // Direct redirect based on approved standing
          setTimeout(() => {
            if (isAdmin) {
              navigate("/admin/registrations", { replace: true })
            } else if (prof?.verification_status === "verified") {
              navigate("/", { replace: true })
            } else {
              navigate("/verify-student", { replace: true })
            }
          }, 1200)
        } else {
          // If no session found and not recovery, redirect to login
          navigate("/login?confirmed=true", { replace: true })
        }
      } catch (err: any) {
        console.error("[AuthCallback] Exception:", err)
        setErrorMessage(err.message || "Authentication callback encountered an error.")
        setStatus("error")
      }
    }

    handleAuthCallback()
  }, [queryParams, refreshProfile, navigate])

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.")
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.")
      return
    }

    try {
      setIsUpdatingPassword(true)
      await updatePassword(newPassword)
      navigate("/login?reset=success", { replace: true })
    } catch (err: any) {
      console.error("[AuthCallback] Password update error:", err)
      setErrorMessage(err.message || "Failed to update password. Link may have expired.")
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  // 1. Password Recovery Flow
  if (status === "recovery") {
    return (
      <motion.div
        variants={pageTransitionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="min-h-[75vh] flex items-center justify-center px-4 py-12"
      >
        <Card className="w-full max-w-md border-border/80 shadow-md bg-card/95">
          <CardHeader className="text-center space-y-2 pt-8 pb-4">
            <ZenwayLogo size="md" withBadge={true} className="mx-auto" />
            <CardTitle className="font-heading text-xl font-bold text-foreground">
              Set New Password
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Please enter your new account password below
            </CardDescription>
          </CardHeader>

          <form onSubmit={handlePasswordResetSubmit}>
            <CardContent className="space-y-4">
              {errorMessage && (
                <Alert variant="destructive" className="border-destructive/30 bg-destructive/10 text-destructive text-xs">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="reset-new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="reset-new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Min 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isUpdatingPassword}
                    className="pl-9 h-10 text-sm font-mono"
                  />
                  <KeyRound className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reset-confirm-password">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="reset-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isUpdatingPassword}
                    className="pl-9 h-10 text-sm font-mono"
                  />
                  <KeyRound className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-2 pb-8">
              <Button
                type="submit"
                disabled={isUpdatingPassword}
                className="w-full h-10 font-semibold gap-2 cursor-pointer shadow-xs"
              >
                {isUpdatingPassword ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <span>Save New Password</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    )
  }

  // 2. Error State
  if (status === "error") {
    return (
      <motion.div
        variants={pageTransitionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="min-h-[75vh] flex items-center justify-center px-4 py-12"
      >
        <Card className="w-full max-w-md border-border/80 shadow-md bg-card/95 text-center">
          <CardHeader className="space-y-3 pt-8 pb-4">
            <div className="size-14 rounded-2xl bg-destructive/15 text-destructive mx-auto flex items-center justify-center">
              <AlertCircle className="size-7" />
            </div>
            <CardTitle className="font-heading text-xl font-bold text-foreground">
              Verification Link Problem
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground max-w-xs mx-auto">
              {errorMessage || "The link may have expired or has already been used."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-2 pb-8">
            <Button
              variant="outline"
              onClick={() => navigate("/login")}
              className="w-full cursor-pointer h-10"
            >
              Return to Login
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    )
  }

  // 3. Processing or Completed
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center space-y-4">
      {status === "complete" ? (
        <>
          <div className="size-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="size-6" />
          </div>
          <p className="font-heading text-base font-semibold text-foreground">
            Session Confirmed! Redirecting to student verification...
          </p>
        </>
      ) : (
        <>
          <div className="size-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
            Completing secure student authentication...
          </p>
        </>
      )}
    </div>
  )
}
