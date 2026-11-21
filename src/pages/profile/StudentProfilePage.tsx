import * as React from "react"
import { motion } from "motion/react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  User,
  ShieldCheck,
  Clock,
  AlertCircle,
  ShieldAlert,
  Mail,
  Phone,
  GraduationCap,
  Save,
  Loader2,
  CheckCircle2,
  LogOut,
  FileCheck2,
  UserCheck,
  QrCode,
} from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"

export function StudentProfilePage() {
  const {
    user,
    profile,
    isLoading,
    latestVerification,
    refreshProfile,
    signOut,
    isVerified,
    isPending,
    isUnverified,
    isSuspended,
    isAdmin,
  } = useAuth()
  const { navigate } = useRouter()

  const [fullName, setFullName] = React.useState(profile?.full_name || "")
  const [phoneNumber, setPhoneNumber] = React.useState(profile?.phone_number || "")
  const [universityName, setUniversityName] = React.useState(profile?.university_name || "")
  const [bio, setBio] = React.useState(profile?.bio || "")
  const [upiId, setUpiId] = React.useState(profile?.upi_id || "")
  const [isSaving, setIsSaving] = React.useState(false)
  const [isSavingUpi, setIsSavingUpi] = React.useState(false)
  const [saveSuccess, setSaveSuccess] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "")
      setPhoneNumber(profile.phone_number ?? "")
      setUniversityName(profile.university_name ?? "")
      setBio(profile.bio ?? "")
      setUpiId(profile.upi_id ?? "")
    }
  }, [
    profile?.id,
    profile?.full_name,
    profile?.phone_number,
    profile?.university_name,
    profile?.bio,
    profile?.upi_id,
  ])

  const handleSaveUpi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!user) return

    const trimmed = upiId.trim()
    if (trimmed && !/^[a-zA-Z0-9._-]{2,32}@[a-zA-Z]{2,15}$/.test(trimmed)) {
      toast.error("Please enter a valid UPI ID (e.g. handle@okhdfcbank or 9876543210@paytm)")
      return
    }

    try {
      setIsSavingUpi(true)
      const { error: upiErr } = await supabase
        .from("profiles")
        .update({
          upi_id: trimmed || null,
        })
        .eq("id", user.id)

      if (upiErr) throw upiErr

      await refreshProfile()
      toast.success("UPI ID saved successfully")
    } catch (err: any) {
      console.error("[Profile] Update UPI error:", err)
      toast.error(err.message || "Failed to update UPI ID.")
    } finally {
      setIsSavingUpi(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setErrorMessage(null)
    setSaveSuccess(false)

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage("Full name must be at least 2 characters.")
      return
    }

    let cleanPhone: string | null = null
    if (phoneNumber.trim()) {
      const digits = phoneNumber.replace(/\D/g, "")
      const tenDigit = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits
      if (tenDigit.length !== 10) {
        setErrorMessage("Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).")
        return
      }
      cleanPhone = tenDigit
    }

    const trimmedUpi = upiId.trim()
    if (trimmedUpi && !/^[a-zA-Z0-9._-]{2,32}@[a-zA-Z]{2,15}$/.test(trimmedUpi)) {
      setErrorMessage("Please enter a valid UPI ID format (e.g. handle@bank).")
      return
    }

    try {
      setIsSaving(true)
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone_number: cleanPhone,
          university_name: universityName.trim() || null,
          bio: bio.trim() || null,
          upi_id: trimmedUpi || null,
        })
        .eq("id", user.id)

      if (updateErr) {
        throw updateErr
      }

      await refreshProfile()
      setSaveSuccess(true)
      toast.success("Profile details updated successfully")
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      console.error("[Profile] Update error:", err)
      setErrorMessage(err.message || "Failed to update profile.")
      toast.error("Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate("/")
  }

  if (!user && !isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3 text-center p-6">
        <AlertCircle className="size-8 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Please sign in to view your profile</h2>
        <Button size="sm" onClick={() => navigate("/login")} className="cursor-pointer">
          Go to Sign In
        </Button>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="size-8 text-primary animate-spin" />
        <span className="text-xs font-mono text-muted-foreground uppercase">
          Loading student profile...
        </span>
      </div>
    )
  }

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-3xl mx-auto space-y-6 pt-2 pb-12"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Student Profile
          </h1>
          <p className="text-xs text-muted-foreground">
            {profile?.university_name ? `${(profile?.university_name || "").trim()} • ` : ""}
            Manage your campus credentials and account preferences
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => navigate("/admin/registrations")}
              className="gap-1.5 text-xs h-8 cursor-pointer bg-primary text-primary-foreground shadow-xs font-semibold"
            >
              <UserCheck className="size-3.5" />
              <span>Admin Registrations</span>
            </Button>
          )}

          {isVerified && (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1.5 py-1 px-2.5">
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Verified Student</span>
            </Badge>
          )}

          {isPending && (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1.5 py-1 px-2.5">
              <Clock className="size-3.5 text-amber-600 dark:text-amber-400" />
              <span>Verification Pending</span>
            </Badge>
          )}

          {isUnverified && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(latestVerification?.status === "rejected" ? "/verification-status" : "/verify-student")}
              className="gap-1.5 text-xs h-8 cursor-pointer border-primary/30 text-primary hover:bg-primary/5"
            >
              <FileCheck2 className="size-3.5" />
              <span>Complete ID Verification</span>
            </Button>
          )}

          {isSuspended && (
            <Badge variant="destructive" className="gap-1.5 py-1 px-2.5">
              <ShieldAlert className="size-3.5" />
              <span>Account Suspended</span>
            </Badge>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleSignOut}
            className="gap-1.5 text-xs h-8 cursor-pointer text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            title="Sign out of student account"
          >
            <LogOut className="size-3.5" />
            <span>Sign Out</span>
          </Button>
        </div>
      </div>

      {saveSuccess && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          <AlertDescription className="text-xs">
            Your profile information has been saved to your account.
          </AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="size-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Main Profile Form */}
      <Card className="border-border/80 shadow-sm bg-card">
        <form onSubmit={handleSave}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm select-none">
                {((profile?.full_name || "ST").trim().substring(0, 2) || "ST").toUpperCase()}
              </div>
              <div>
                <CardTitle className="font-heading text-lg font-semibold text-foreground">
                  {profile?.full_name || "Account Information"}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  {profile?.university_name || "University contact information and public student details"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prof-fullname">Full Name *</Label>
                <div className="relative">
                  <Input
                    id="prof-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isSaving}
                    className="pl-9 h-10 text-sm"
                  />
                  <User className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-email">Registered Email (Auth Locked)</Label>
                <div className="relative">
                  <Input
                    id="prof-email"
                    type="email"
                    disabled
                    value={user?.email || ""}
                    className="pl-9 h-10 text-sm font-mono bg-muted/40 cursor-not-allowed"
                  />
                  <Mail className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prof-university">University Campus</Label>
                <div className="relative">
                  <Input
                    id="prof-university"
                    type="text"
                    placeholder="e.g. State University"
                    value={universityName}
                    onChange={(e) => setUniversityName(e.target.value)}
                    disabled={isSaving}
                    className="pl-9 h-10 text-sm"
                  />
                  <GraduationCap className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="prof-phone">WhatsApp & Calling Phone</Label>
                  <span className="text-[11px] text-muted-foreground font-medium">10-Digit Mobile</span>
                </div>
                <div className="relative flex items-center">
                  <div className="absolute left-3 flex items-center gap-1.5 pointer-events-none select-none text-muted-foreground">
                    <Phone className="size-3.5" />
                    <span className="text-xs font-semibold text-foreground font-mono">+91</span>
                  </div>
                  <Input
                    id="prof-phone"
                    type="tel"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phoneNumber}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, "")
                      setPhoneNumber(digitsOnly.slice(0, 10))
                    }}
                    disabled={isSaving}
                    className="pl-16 h-10 text-sm font-mono tracking-wide"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Shared securely via WhatsApp & Call only with confirmed exchange partners.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 p-3 rounded-xl border border-border/60 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="prof-upi" className="font-semibold text-foreground">UPI ID</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {profile?.upi_id ? `Linked: ${profile?.upi_id} • ` : ""}Used for peer settlements and direct UPI QR payments in RIDE and RENT.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleSaveUpi()}
                  disabled={isSaving || isSavingUpi}
                  className="h-7 px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer gap-1.5"
                >
                  {isSavingUpi ? (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="size-3" />
                      <span>Save UPI</span>
                    </>
                  )}
                </Button>
              </div>
              <div className="relative mt-2">
                <Input
                  id="prof-upi"
                  type="text"
                  placeholder="e.g. handle@okhdfcbank"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  disabled={isSaving || isSavingUpi}
                  className="pl-9 h-10 text-sm"
                />
                <QrCode className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prof-bio">Student Bio / Campus Dorm</Label>
              <Textarea
                id="prof-bio"
                placeholder="Senior Engineering major, West Campus dorms. Daily commute to Tech Center."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                disabled={isSaving}
                className="text-sm min-h-[80px]"
              />
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between pt-2 pb-6 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer gap-1.5"
            >
              <LogOut className="size-3.5" />
              <span>Sign Out</span>
            </Button>

            <Button
              type="submit"
              disabled={isSaving}
              className="h-10 text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  )
}
