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
import { Loader2, ArrowLeft, AlertCircle, Mail, CheckCircle2 } from "lucide-react"
import { pageTransitionVariants } from "@/lib/motion"

export function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth()
  const { navigate } = useRouter()

  const [email, setEmail] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isSuccess, setIsSuccess] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.")
      return
    }

    try {
      setIsSubmitting(true)
      await resetPasswordForEmail(email.trim().toLowerCase())
      setIsSuccess(true)
    } catch (err: any) {
      console.error("[ForgotPassword] Error:", err)
      setErrorMessage(err.message || "Failed to send reset email. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
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
        <div className="text-center space-y-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-block cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-1"
          >
            <ZenwayLogo size="lg" withBadge={false} />
          </button>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground pt-1">
            Reset your password
          </h1>
          <p className="text-xs text-muted-foreground">
            Enter your email to receive recovery instructions
          </p>
        </div>

        {errorMessage && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/10 text-destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs font-medium">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        {isSuccess ? (
          <Card className="border-border/80 shadow-md bg-card/95 text-center">
            <CardHeader className="space-y-3 pt-8 pb-4">
              <div className="size-14 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="size-7" />
              </div>
              <CardTitle className="font-heading text-xl font-bold text-foreground">
                Reset Link Dispatched
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                If an account exists for <span className="font-mono text-foreground font-semibold">{email}</span>, you will receive a secure password recovery email shortly.
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
        ) : (
          <Card className="border-border/80 shadow-sm bg-card/95">
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Account Email</Label>
                  <div className="relative">
                    <Input
                      id="forgot-email"
                      type="email"
                      required
                      placeholder="student@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isSubmitting}
                      className="pl-9 h-10 text-sm"
                    />
                    <Mail className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    We will send a one-time secure link to reset your account password.
                  </p>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-3 pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 min-h-[44px] font-semibold gap-2 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Sending Instructions...</span>
                    </>
                  ) : (
                    <span>Send Recovery Link</span>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate("/login")}
                  className="w-full h-9 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1.5"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Back to Sign In</span>
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </motion.div>
  )
}
