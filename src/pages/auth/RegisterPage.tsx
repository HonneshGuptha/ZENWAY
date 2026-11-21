import * as React from "react"
import { motion } from "motion/react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import { ZenwayLogo } from "@/components/brand/ZenwayLogo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Loader2,
  ArrowRight,
  AlertCircle,
  KeyRound,
  Mail,
  User,
  Phone,
  GraduationCap,
  ShieldCheck,
  Eye,
  EyeOff,
  Clock,
  CheckCircle2,
} from "lucide-react"
import { pageTransitionVariants } from "@/lib/motion"

export function RegisterPage() {
  const { user, signUp } = useAuth()
  const { navigate } = useRouter()

  const [fullName, setFullName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [phoneNumber, setPhoneNumber] = React.useState("")
  const [universityName, setUniversityName] = React.useState("")

  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)

  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [confirmationEmail, setConfirmationEmail] = React.useState("")

  // Automatically redirect already authenticated users
  React.useEffect(() => {
    if (user) {
      navigate("/rent", { replace: true })
    }
  }, [user, navigate])

  // Real-time validation checks
  const isPasswordTooShort = password.length > 0 && password.length < 8
  const isPasswordMismatch = confirmPassword.length > 0 && password !== confirmPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    // Form validation
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage("Please enter your full name (minimum 2 characters).")
      return
    }

    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter a valid personal email address.")
      return
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.")
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please ensure both password fields are identical.")
      return
    }

    try {
      setIsSubmitting(true)
      await signUp({
        email: email.trim().toLowerCase(),
        password,
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        universityName: universityName.trim() || undefined,
      })

      setConfirmationEmail(email.trim())
      setIsSuccess(true)
    } catch (err: any) {
      console.error("[Register] Error:", err)
      if (err.message?.includes("User already registered") || err.message?.includes("already exists")) {
        setErrorMessage("An account with this email address already exists. Please log in instead.")
      } else {
        setErrorMessage(err.message || "Failed to create account. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <motion.div
        variants={pageTransitionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="min-h-[75vh] flex items-center justify-center px-4 py-12"
      >
        <Card className="w-full max-w-lg border-border/80 shadow-md bg-card/95 backdrop-blur-xs text-center">
          <CardHeader className="space-y-3 pt-8 pb-4">
            <div className="size-14 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <Mail className="size-7" />
            </div>
            <CardTitle className="font-heading text-2xl font-bold text-foreground">
              Registration Received!
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground max-w-sm mx-auto">
              We've dispatched an email confirmation link to:
            </CardDescription>
            <p className="font-mono text-xs font-semibold text-foreground bg-muted/60 py-1.5 px-3 rounded-md max-w-sm mx-auto">
              {confirmationEmail}
            </p>
          </CardHeader>

          <CardContent className="space-y-4 text-xs text-muted-foreground pb-6">
            <div className="p-4 rounded-xl border border-border/70 bg-muted/30 text-left space-y-3">
              <p className="font-semibold text-foreground text-xs">
                Two-Stage Approval Sequence:
              </p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="p-1 rounded-md bg-primary/10 text-primary mt-0.5 shrink-0">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <div>
                    <span className="font-medium text-foreground">1. Email Confirmation:</span>
                    <p className="text-[11px] text-muted-foreground">Click the confirmation link sent to your inbox.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0">
                    <Clock className="size-3.5" />
                  </div>
                  <div>
                    <span className="font-medium text-foreground">2. Administrator Registration Approval:</span>
                    <p className="text-[11px] text-muted-foreground">
                      A campus administrator will review and approve your new student account before login is permitted.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0">
                    <ShieldCheck className="size-3.5" />
                  </div>
                  <div>
                    <span className="font-medium text-foreground">3. Student ID Verification:</span>
                    <p className="text-[11px] text-muted-foreground">
                      Once approved and logged in, upload your college ID to unlock RENT, RIDE, and CARRY.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 pb-8">
            <Button
              variant="outline"
              onClick={() => navigate("/login")}
              className="w-full cursor-pointer h-10 font-semibold"
            >
              Go to Sign In
            </Button>
            <button
              type="button"
              onClick={() => setIsSuccess(false)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer pt-1"
            >
              Need to register with a different email? Click here
            </button>
          </CardFooter>
        </Card>
      </motion.div>
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
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-block cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-1"
          >
            <ZenwayLogo size="lg" withBadge={false} />
          </button>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground pt-1">
            Join the Student Mobility Exchange
          </h1>
          <p className="text-xs text-muted-foreground">
            Register with your personal email to get started
          </p>
        </div>

        {/* Auth Mode Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-muted/60 border border-border/60 text-xs font-semibold">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="py-2.5 rounded-lg text-muted-foreground hover:text-foreground text-center cursor-pointer transition-colors"
          >
            Sign In
          </button>
          <button
            type="button"
            className="py-2.5 rounded-lg bg-card text-foreground shadow-xs text-center cursor-default font-bold"
          >
            Create Account
          </button>
        </div>

        {errorMessage && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/10 text-destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs font-medium">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Registration Card */}
        <Card className="border-border/80 shadow-sm bg-card/95 backdrop-blur-xs">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-6">
              {/* Full Name */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-fullname">Full Legal Name *</Label>
                <div className="relative">
                  <Input
                    id="reg-fullname"
                    type="text"
                    required
                    placeholder="Alex Morgan"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isSubmitting}
                    className="pl-9 h-10 text-sm"
                  />
                  <User className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Must match the name on your official student ID.
                </p>
              </div>

              {/* Personal Email */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-email">Personal Email Address *</Label>
                <div className="relative">
                  <Input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="alex.morgan@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="pl-9 h-10 text-sm"
                  />
                  <Mail className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  You can register with any personal email; university status is verified separately.
                </p>
              </div>

              {/* Passwords (2-col on sm) with Visibility Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      placeholder="Min 8 characters"
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
                  {isPasswordTooShort && (
                    <p className="text-[11px] text-destructive font-medium">
                      Password must be at least 8 characters.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-confirm-password">Confirm Password *</Label>
                  <div className="relative">
                    <Input
                      id="reg-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isSubmitting}
                      className="pl-9 pr-10 h-10 text-sm font-mono"
                    />
                    <KeyRound className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      className="absolute right-1 top-1 size-8 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {isPasswordMismatch && (
                    <p className="text-[11px] text-destructive font-medium">
                      Passwords do not match.
                    </p>
                  )}
                </div>
              </div>

              {/* Phone & University (2-col on sm) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-phone">Phone Number (Optional)</Label>
                  <div className="relative">
                    <Input
                      id="reg-phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="+1 (555) 019-2834"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      disabled={isSubmitting}
                      className="pl-9 h-10 text-sm"
                    />
                    <Phone className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-university">University Name (Optional)</Label>
                  <div className="relative">
                    <Input
                      id="reg-university"
                      type="text"
                      placeholder="State University"
                      value={universityName}
                      onChange={(e) => setUniversityName(e.target.value)}
                      disabled={isSubmitting}
                      className="pl-9 h-10 text-sm"
                    />
                    <GraduationCap className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Two-Tier Admin Approval Notice */}
              <div className="pt-2 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2 border-t border-border/60">
                <Clock className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Admin Approval Required:</strong> All student registrations require campus administrator approval. You will be able to log in after email confirmation and administrative sign-off.
                </span>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting || password.length < 8 || password !== confirmPassword}
                className="w-full h-11 min-h-[44px] font-semibold gap-2 cursor-pointer shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Submitting Registration...</span>
                  </>
                ) : (
                  <>
                    <span>Submit for Admin Approval</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              <div className="text-center text-xs text-muted-foreground">
                Already registered?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="font-semibold text-primary hover:underline cursor-pointer"
                >
                  Sign in here
                </button>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </motion.div>
  )
}
