import * as React from "react"
import { motion } from "motion/react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ShieldCheck,
  Clock,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  FileCheck2,
  RefreshCw,
  LogOut,
  KeyRound,
  Car,
  Package,
} from "lucide-react"
import { pageTransitionVariants } from "@/lib/motion"

export function VerificationStatusPage() {
  const { profile, latestVerification, refreshProfile, signOut } = useAuth()
  const { navigate } = useRouter()
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshProfile()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate("/")
  }

  const status = profile?.verification_status || (latestVerification?.status === "pending" ? "pending" : "unverified")

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-[75vh] flex items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Verification Standing
            </h1>
            <p className="text-xs text-muted-foreground">
              Campus trust and student accreditation status
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-1.5 text-xs h-8 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Check Updates</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="gap-1.5 text-xs h-8 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="Sign Out"
            >
              <LogOut className="size-3.5" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>

        {/* 1. VERIFIED STATE */}
        {status === "verified" && (
          <Card className="border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-sm">
            <CardHeader className="text-center space-y-3 pt-8 pb-4">
              <div className="size-16 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-xs">
                <ShieldCheck className="size-9" />
              </div>
              <div className="space-y-1">
                <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 uppercase tracking-wider text-[10px]">
                  Accredited Student
                </Badge>
                <CardTitle className="font-heading text-2xl font-bold text-foreground pt-1">
                  Verified Campus Member
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Your student credentials have been confirmed by campus administration.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 text-xs text-muted-foreground pb-6">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-card border border-border/80">
                <div>
                  <span className="text-[10px] uppercase font-mono text-muted-foreground">Student Name</span>
                  <p className="font-semibold text-foreground">{profile?.full_name}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-muted-foreground">Campus Trust</span>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">High Trust Standing</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-foreground">Unlocked Platform Capabilities:</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div
                    onClick={() => navigate("/rent")}
                    className="p-3 rounded-lg border border-border/70 bg-card hover:border-primary/50 transition-colors cursor-pointer space-y-1"
                  >
                    <KeyRound className="size-4 text-primary mx-auto" />
                    <p className="font-semibold text-[11px] text-foreground">RENT</p>
                    <p className="text-[9px] text-muted-foreground">List & Rent</p>
                  </div>
                  <div
                    onClick={() => navigate("/ride")}
                    className="p-3 rounded-lg border border-border/70 bg-card hover:border-primary/50 transition-colors cursor-pointer space-y-1"
                  >
                    <Car className="size-4 text-primary mx-auto" />
                    <p className="font-semibold text-[11px] text-foreground">RIDE</p>
                    <p className="text-[9px] text-muted-foreground">Carpool Hub</p>
                  </div>
                  <div
                    onClick={() => navigate("/carry")}
                    className="p-3 rounded-lg border border-border/70 bg-card hover:border-accent/50 transition-colors cursor-pointer space-y-1"
                  >
                    <Package className="size-4 text-accent mx-auto" />
                    <p className="font-semibold text-[11px] text-foreground">CARRY</p>
                    <p className="text-[9px] text-muted-foreground">Peer Delivery</p>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-2 pb-6">
              <Button
                onClick={() => navigate("/")}
                className="w-full h-10 font-semibold gap-2 cursor-pointer shadow-xs"
              >
                <span>Return to Campus Hub</span>
                <ArrowRight className="size-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* 2. PENDING REVIEW STATE */}
        {status === "pending" && (
          <Card className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 shadow-sm">
            <CardHeader className="text-center space-y-3 pt-8 pb-4">
              <div className="size-16 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                <Clock className="size-8 animate-pulse" />
              </div>
              <div className="space-y-1">
                <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/30 uppercase tracking-wider text-[10px]">
                  Under Admin Review
                </Badge>
                <CardTitle className="font-heading text-2xl font-bold text-foreground pt-1">
                  Review in Progress
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Your student credentials were submitted and are queued for campus administration verification.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 text-xs pb-6">
              <div className="p-4 rounded-xl bg-card border border-border/80 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="text-muted-foreground">Submission Reference</span>
                  <span className="font-mono font-semibold text-foreground">
                    #{latestVerification?.id.slice(0, 8)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Student ID Number</span>
                  <span className="font-mono text-foreground">{latestVerification?.student_id_number || "Provided"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Document Type</span>
                  <span className="capitalize text-foreground">
                    {latestVerification?.document_type.replace(/_/g, " ") || "Student ID Card"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Submitted At</span>
                  <span className="text-foreground">
                    {latestVerification?.created_at
                      ? new Date(latestVerification.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Recently"}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border/60 bg-muted/20 text-[11px] text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">What happens next?</p>
                <p>
                  Campus administrators review enrollment records within 12–24 business hours. You will receive an in-app notification as soon as verification completes.
                </p>
              </div>
            </CardContent>

            <CardFooter className="pt-2 pb-6">
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="w-full h-10 cursor-pointer"
              >
                Browse Public Exchange Listings
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* 3. REJECTED STATE */}
        {status === "unverified" && latestVerification?.status === "rejected" && (
          <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
            <CardHeader className="text-center space-y-3 pt-8 pb-4">
              <div className="size-16 rounded-2xl bg-destructive/15 text-destructive mx-auto flex items-center justify-center">
                <AlertCircle className="size-8" />
              </div>
              <div className="space-y-1">
                <Badge variant="destructive" className="uppercase tracking-wider text-[10px]">
                  Action Required
                </Badge>
                <CardTitle className="font-heading text-2xl font-bold text-foreground pt-1">
                  Verification Needs Attention
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Your previous student documentation could not be confirmed.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 text-xs pb-6">
              <div className="p-4 rounded-xl bg-card border border-destructive/20 space-y-2">
                <p className="text-[10px] uppercase font-mono text-destructive font-semibold">
                  Administrator Rejection Reason:
                </p>
                <p className="text-sm font-medium text-foreground bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                  {latestVerification.rejection_reason || "Document was blurry or could not confirm current semester enrollment."}
                </p>
                <p className="text-[11px] text-muted-foreground pt-1">
                  Please upload a clearer copy of your student card or an official enrollment certificate.
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-2 pt-2 pb-6">
              <Button
                onClick={() => navigate("/verify-student")}
                className="w-full h-10 font-semibold gap-2 cursor-pointer shadow-xs"
              >
                <FileCheck2 className="size-4" />
                <span>Resubmit Verification Document</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate("/")}
                className="w-full h-9 text-xs text-muted-foreground cursor-pointer"
              >
                Return to Home
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* 4. SUSPENDED STATE */}
        {status === "suspended" && (
          <Card className="border-destructive/40 bg-destructive/10 shadow-sm">
            <CardHeader className="text-center space-y-3 pt-8 pb-4">
              <div className="size-16 rounded-2xl bg-destructive/20 text-destructive mx-auto flex items-center justify-center">
                <ShieldAlert className="size-8" />
              </div>
              <div className="space-y-1">
                <Badge variant="destructive" className="uppercase tracking-wider text-[10px]">
                  Account Suspended
                </Badge>
                <CardTitle className="font-heading text-2xl font-bold text-foreground pt-1">
                  Access Restricted
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Your campus mobility privileges have been paused by campus administration.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 text-xs text-muted-foreground pb-6">
              <p>
                Participation in RENT, RIDE, and CARRY is temporarily locked for your profile. This may be due to a safety review, expired campus enrollment, or an unresolved community report.
              </p>
              <div className="p-3 rounded-lg bg-card border border-destructive/20 text-[11px]">
                <p className="font-semibold text-foreground">Support & Appeals:</p>
                <p>Contact your campus transportation coordinator or email compliance@campus.edu to resolve this restriction.</p>
              </div>
            </CardContent>

            <CardFooter className="pb-6">
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="w-full h-10 cursor-pointer"
              >
                Return to Home
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* 5. INITIAL UNVERIFIED (Never submitted) */}
        {status === "unverified" && !latestVerification && (
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="text-center space-y-3 pt-8 pb-4">
              <div className="size-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <FileCheck2 className="size-7" />
              </div>
              <CardTitle className="font-heading text-xl font-bold text-foreground">
                Verification Required
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                You haven't submitted your student credentials yet.
              </CardDescription>
            </CardHeader>

            <CardFooter className="pt-2 pb-6">
              <Button
                onClick={() => navigate("/verify-student")}
                className="w-full h-10 font-semibold gap-2 cursor-pointer shadow-xs"
              >
                <span>Begin Student Verification</span>
                <ArrowRight className="size-4" />
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </motion.div>
  )
}
