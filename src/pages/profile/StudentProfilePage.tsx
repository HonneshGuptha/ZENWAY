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
} from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"

export function StudentProfilePage() {
  const { user, profile, latestVerification, refreshProfile, signOut, isVerified, isPending, isUnverified, isSuspended, isAdmin } = useAuth()
  const { navigate } = useRouter()

  const [fullName, setFullName] = React.useState(profile?.full_name || "")
  const [phoneNumber, setPhoneNumber] = React.useState(profile?.phone_number || "")
  const [universityName, setUniversityName] = React.useState(profile?.university_name || "")
  const [bio, setBio] = React.useState(profile?.bio || "")
  const [isSaving, setIsSaving] = React.useState(false)
  const [saveSuccess, setSaveSuccess] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "")
      setPhoneNumber(profile.phone_number || "")
      setUniversityName(profile.university_name || "")
      setBio(profile.bio || "")
    }
  }, [profile])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setErrorMessage(null)
    setSaveSuccess(false)

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage("Full name must be at least 2 characters.")
      return
    }

    try {
      setIsSaving(true)
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone_number: phoneNumber.trim() || null,
          university_name: universityName.trim() || null,
          bio: bio.trim() || null,
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
            <CardTitle className="font-heading text-lg font-semibold text-foreground">
              Account Information
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              University contact information and public student details
            </CardDescription>
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
                <Label htmlFor="prof-phone">Contact Phone</Label>
                <div className="relative">
                  <Input
                    id="prof-phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={isSaving}
                    className="pl-9 h-10 text-sm"
                  />
                  <Phone className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                </div>
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
