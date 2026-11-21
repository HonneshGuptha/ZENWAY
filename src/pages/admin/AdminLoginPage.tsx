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
      className="dark min-h-screen flex flex-col items-center justify-center p-4 bg-[#09090B] text-[#FAFAFA]"
      style={{
        "--bg-canvas": "#09090B",
        "--bg-surface": "#121215",
        "--bg-surface-muted": "#1C1C21",
        "--text-primary": "#FAFAFA",
        "--text-muted": "#A1A1AA",
        "--border-subtle": "rgba(255, 255, 255, 0.12)",
        "--background": "#09090B",
        "--foreground": "#FAFAFA",
        "--card": "#121215",
        "--card-foreground": "#FAFAFA",
        "--popover": "#121215",
        "--popover-foreground": "#FAFAFA",
        "--muted": "#1C1C21",
        "--muted-foreground": "#A1A1AA",
        "--border": "rgba(255, 255, 255, 0.12)",
        "--input": "rgba(255, 255, 255, 0.15)",
      } as React.CSSProperties}
    >
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <ZenwayLogo size="lg" withBadge={false} className="text-[#FAFAFA]" />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EA2E00]/15 text-[#EA2E00] border border-[#EA2E00]/30 text-xs font-mono font-bold tracking-wide">
            <Shield className="size-3.5" />
            <span>CAMPUS OPERATIONS PORTAL</span>
          </div>
          <p className="text-xs text-zinc-400 max-w-xs">
            Restricted administrative system. All access attempts and security events are logged with audit trails.
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-[rgba(255,255,255,0.08)] bg-[#121215] text-[#FAFAFA] shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold tracking-tight text-[#FAFAFA]">Admin Sign In</CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Authenticate with your provisioned campus administrator credentials and security key.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {errorMsg && (
                <Alert variant="destructive" className="py-2.5 bg-red-950/30 border-red-900/50 text-red-300">
                  <ShieldAlert className="size-4 text-red-400" />
                  <AlertTitle className="text-xs font-semibold text-red-300">Authentication Failed</AlertTitle>
                  <AlertDescription className="text-xs mt-0.5 text-red-200">
                    {errorMsg}
                  </AlertDescription>
                </Alert>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="admin-email" className="text-xs font-mono text-zinc-300">
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
                    className="pl-9 h-10 text-sm bg-[#18181B] border-[rgba(255,255,255,0.12)] text-[#FAFAFA] placeholder:text-zinc-600"
                    required
                  />
                  <Mail className="size-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="admin-password" className="text-xs font-mono text-zinc-300">
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
                    className="pl-9 h-10 text-sm bg-[#18181B] border-[rgba(255,255,255,0.12)] text-[#FAFAFA] placeholder:text-zinc-600"
                    required
                  />
                  <Lock className="size-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Admin Access Key */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="admin-access-key" className="text-xs font-mono text-zinc-300 flex items-center gap-1.5">
                    <KeyRound className="size-3.5 text-[#EA2E00]" />
                    <span>Admin Access Key</span>
                  </Label>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Required 2FA
                  </span>
                </div>
                <Input
                  id="admin-access-key"
                  type="password"
                  placeholder="Enter secure access key"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  disabled={isSubmitting}
                  className="h-10 text-sm font-mono tracking-widest text-center bg-[#18181B] border-[rgba(255,255,255,0.12)] text-[#FAFAFA] placeholder:text-zinc-600"
                  required
                />
                <p className="text-[11px] text-zinc-400">
                  Access keys are cryptographically hashed and verified server-side.
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2 pb-6">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 min-h-[44px] font-mono font-bold cursor-pointer shadow-xs gap-2 bg-[#EA2E00] hover:bg-[#CC2800] text-white border-0"
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
                className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer pt-1 font-mono"
              >
                <ArrowLeft className="size-3.5 text-[#EA2E00]" />
                <span>Return to Student Sign In</span>
              </button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </motion.div>
  )
}
