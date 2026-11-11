import * as React from "react"
import { motion } from "motion/react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import { ZenwayLogo } from "@/components/brand/ZenwayLogo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Shield, KeyRound, Mail, Lock, Loader2, ArrowLeft, ShieldAlert } from "lucide-react"
import { pageTransitionVariants } from "@/lib/motion"

export function AdminLoginPage() {
  const { signIn, verifyAdminAccessKey, signOut } = useAuth()
  const { navigate } = useRouter()

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [accessKey, setAccessKey] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!email.trim() || !password || !accessKey.trim()) {
      setErrorMsg("Please enter email, password, and the Admin Access Key.")
      return
    }

    try {
      setIsSubmitting(true)

      // 1. Supabase credentials sign in
      const { user } = await signIn(email.trim(), password)
      if (!user) {
        throw new Error("Invalid administrator credentials.")
      }

      // 2. Server-side Access Key verification via RPC
      // The RPC checks both caller is_admin() AND the blowfish crypt hash
      const isValidKey = await verifyAdminAccessKey(accessKey.trim())
      if (!isValidKey) {
        // Access key invalid: immediately tear down session
        await signOut()
        throw new Error("Invalid Admin Access Key. Access denied to campus operations.")
      }

      // 3. Navigate directly to admin dashboard
      navigate("/admin/dashboard", { replace: true })
    } catch (err: any) {
      console.error("[AdminLogin] Authentication failure:", err)
      // If error indicates unauthorized role
      const msg = err.message || "Failed to authenticate administrator."
      setErrorMsg(msg)
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
      className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/40"
    >
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <ZenwayLogo size="lg" withBadge={false} />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold tracking-wide">
            <Shield className="size-3.5" />
            <span>CAMPUS OPERATIONS PORTAL</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-xs">
            Restricted administrative system. All access attempts and security events are logged with audit trails.
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-border/80 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold tracking-tight">Admin Sign In</CardTitle>
            <CardDescription className="text-xs">
              Authenticate with your provisioned campus administrator credentials and security key.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {errorMsg && (
                <Alert variant="destructive" className="py-2.5">
                  <ShieldAlert className="size-4" />
                  <AlertTitle className="text-xs font-semibold">Authentication Failed</AlertTitle>
                  <AlertDescription className="text-xs mt-0.5">
                    {errorMsg}
                  </AlertDescription>
                </Alert>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="admin-email" className="text-xs font-medium">
                  Administrator Email
                </Label>
                <div className="relative">
                  <Input
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    placeholder="admin@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="pl-9 h-10 text-sm"
                    required
                  />
                  <Mail className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="admin-password" className="text-xs font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="pl-9 h-10 text-sm"
                    required
                  />
                  <Lock className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Admin Access Key */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="admin-access-key" className="text-xs font-medium flex items-center gap-1.5">
                    <KeyRound className="size-3.5 text-primary" />
                    <span>Admin Access Key</span>
                  </Label>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Default: 2077
                  </span>
                </div>
                <Input
                  id="admin-access-key"
                  type="password"
                  placeholder="Enter secure access key"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  disabled={isSubmitting}
                  className="h-10 text-sm font-mono tracking-widest text-center"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Access keys are cryptographically hashed and verified server-side.
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2 pb-6">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 font-medium cursor-pointer shadow-xs gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <Shield className="size-4" />
                    <span>Enter Admin Portal</span>
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer pt-1"
              >
                <ArrowLeft className="size-3.5" />
                <span>Return to Student Sign In</span>
              </button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </motion.div>
  )
}
