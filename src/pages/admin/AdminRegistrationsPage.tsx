import * as React from "react"
import { motion } from "motion/react"
import { useAuth, type AdminRegistrationRecord } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import { AdminShell } from "@/components/admin/AdminShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Mail,
  Phone,
  GraduationCap,
  Calendar,
  Loader2,
  Filter,
  UserCheck,
} from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"

export function AdminRegistrationsPage() {
  const { isAdmin, approveRegistration, rejectRegistration, getAdminRegistrations } = useAuth()
  const { navigate } = useRouter()

  const [registrations, setRegistrations] = React.useState<AdminRegistrationRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<"all" | "pending" | "approved" | "rejected">("pending")
  const [searchQuery, setSearchQuery] = React.useState("")

  // Action states
  const [processingId, setProcessingId] = React.useState<string | null>(null)
  const [rejectDialogUser, setRejectDialogUser] = React.useState<AdminRegistrationRecord | null>(null)
  const [rejectionReason, setRejectionReason] = React.useState("")
  const [isSubmittingReject, setIsSubmittingReject] = React.useState(false)

  // Fetch registrations
  const fetchRegistrations = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await getAdminRegistrations()
      setRegistrations(data)
    } catch (err: any) {
      console.error("[AdminRegistrations] Error loading records:", err)
      toast.error(err.message || "Failed to load registrations")
    } finally {
      setIsLoading(false)
    }
  }, [getAdminRegistrations])

  React.useEffect(() => {
    if (isAdmin) {
      fetchRegistrations()
    }
  }, [isAdmin, fetchRegistrations])

  // Handle Approve
  const handleApprove = async (userRecord: AdminRegistrationRecord) => {
    try {
      setProcessingId(userRecord.id)
      await approveRegistration(userRecord.id)
      toast.success(`Registration approved for ${userRecord.full_name}`)
      await fetchRegistrations()
    } catch (err: any) {
      console.error("[AdminRegistrations] Approve error:", err)
      toast.error(err.message || "Failed to approve registration")
    } finally {
      setProcessingId(null)
    }
  }

  // Handle Reject Submit
  const handleConfirmReject = async () => {
    if (!rejectDialogUser) return
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason.")
      return
    }

    try {
      setIsSubmittingReject(true)
      await rejectRegistration(rejectDialogUser.id, rejectionReason.trim())
      toast.success(`Registration rejected for ${rejectDialogUser.full_name}`)
      setRejectDialogUser(null)
      setRejectionReason("")
      await fetchRegistrations()
    } catch (err: any) {
      console.error("[AdminRegistrations] Reject error:", err)
      toast.error(err.message || "Failed to reject registration")
    } finally {
      setIsSubmittingReject(false)
    }
  }

  // Non-admin Access Denied Barrier
  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-destructive/30 bg-card text-center p-6 space-y-4">
          <div className="size-14 rounded-2xl bg-destructive/15 text-destructive mx-auto flex items-center justify-center">
            <ShieldAlert className="size-7" />
          </div>
          <CardTitle className="font-heading text-xl font-bold text-foreground">
            Administrative Access Required
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            This module is strictly restricted to verified ZENWAY campus administrators.
          </CardDescription>
          <Button onClick={() => navigate("/")} className="w-full cursor-pointer">
            Return to Campus Hub
          </Button>
        </Card>
      </div>
    )
  }

  // Filter & Search Logic
  const filteredRegistrations = registrations.filter((reg) => {
    const matchesTab =
      activeTab === "all" ? true : (reg.registration_status || "pending") === activeTab

    const q = searchQuery.toLowerCase().trim()
    const matchesSearch =
      !q ||
      reg.full_name?.toLowerCase().includes(q) ||
      reg.email?.toLowerCase().includes(q) ||
      reg.university_name?.toLowerCase().includes(q) ||
      reg.phone_number?.includes(q)

    return matchesTab && matchesSearch
  })

  // Summary Metrics
  const totalCount = registrations.length
  const pendingCount = registrations.filter((r) => (r.registration_status || "pending") === "pending").length
  const approvedCount = registrations.filter((r) => r.registration_status === "approved").length
  const rejectedCount = registrations.filter((r) => r.registration_status === "rejected").length

  return (
    <AdminShell currentSection="registrations">
      <motion.div
        variants={pageTransitionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="max-w-6xl mx-auto space-y-6 pt-2 pb-16"
      >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-[11px] font-semibold">
            <UserCheck className="size-3.5" />
            <span>Campus Administrator Portal</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Student Registration Approvals
          </h1>
          <p className="text-xs text-muted-foreground">
            Review and approve pending student accounts before campus platform access activates.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchRegistrations}
          disabled={isLoading}
          className="gap-2 text-xs h-9 cursor-pointer"
        >
          <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Queue</span>
        </Button>
      </div>

      {/* Metrics Row (Compact Density) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div
          onClick={() => setActiveTab("pending")}
          className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer bg-card shadow-xs ${
            activeTab === "pending"
              ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20"
              : "border-border/80 hover:border-border"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Pending Review</span>
            <Clock className="size-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-foreground mt-1 font-mono">{pendingCount}</p>
          <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">Requires approval</span>
        </div>

        <div
          onClick={() => setActiveTab("approved")}
          className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer bg-card shadow-xs ${
            activeTab === "approved"
              ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20"
              : "border-border/80 hover:border-border"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Approved Members</span>
            <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-foreground mt-1 font-mono">{approvedCount}</p>
          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">Login enabled</span>
        </div>

        <div
          onClick={() => setActiveTab("rejected")}
          className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer bg-card shadow-xs ${
            activeTab === "rejected"
              ? "border-destructive/50 bg-destructive/5 ring-1 ring-destructive/20"
              : "border-border/80 hover:border-border"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Rejected</span>
            <XCircle className="size-3.5 text-destructive" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-foreground mt-1 font-mono">{rejectedCount}</p>
          <span className="text-[10px] text-destructive font-medium">Access blocked</span>
        </div>

        <div
          onClick={() => setActiveTab("all")}
          className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer bg-card shadow-xs ${
            activeTab === "all"
              ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
              : "border-border/80 hover:border-border"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Total Registered</span>
            <Filter className="size-3.5 text-primary" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-foreground mt-1 font-mono">{totalCount}</p>
          <span className="text-[10px] text-muted-foreground font-medium">All accounts</span>
        </div>
      </div>

      {/* Control Bar: Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/40 border border-border/60 self-start">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === "pending"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approved")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === "approved"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rejected")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === "rejected"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Rejected ({rejectedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === "all"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({totalCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Input
            placeholder="Search student or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
          <Search className="size-3.5 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
        </div>
      </div>

      {/* Registrations List */}
      <div className="space-y-3 pt-1">
        {isLoading ? (
          <div className="p-12 text-center space-y-3 rounded-xl border border-border/80 bg-card">
            <Loader2 className="size-6 text-primary animate-spin mx-auto" />
            <p className="text-xs text-muted-foreground font-mono">Loading registration queue...</p>
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="p-12 text-center space-y-2 rounded-xl border border-dashed border-border/80 bg-card">
            <UserCheck className="size-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold text-foreground">No registrations found</p>
            <p className="text-xs text-muted-foreground">
              {searchQuery ? "No records match your search criteria." : `There are no ${activeTab} student registrations at this time.`}
            </p>
          </div>
        ) : (
          filteredRegistrations.map((student) => {
            const status = student.registration_status || "pending"
            const isProcessing = processingId === student.id

            return (
              <div
                key={student.id}
                className="p-4 sm:p-5 rounded-xl border border-border/80 bg-card hover:border-border transition-all space-y-4 shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Student Identity */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-heading text-base font-semibold text-foreground">
                        {student.full_name}
                      </h3>
                      <Badge
                        className={`capitalize text-[10px] font-mono tracking-wider ${
                          status === "approved"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            : status === "rejected"
                            ? "bg-destructive/15 text-destructive border-destructive/30"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                        }`}
                      >
                        {status}
                      </Badge>
                      {student.role === "admin" && (
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-primary/20 text-primary px-1.5 py-0.2 rounded">
                          Admin
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-0.5">
                      {student.email && (
                        <div className="flex items-center gap-1.5 font-mono">
                          <Mail className="size-3 text-muted-foreground" />
                          <span>{student.email}</span>
                        </div>
                      )}
                      {student.phone_number && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="size-3 text-muted-foreground" />
                          <span>{student.phone_number}</span>
                        </div>
                      )}
                      {student.university_name && (
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="size-3.5 text-muted-foreground" />
                          <span>{student.university_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3 text-muted-foreground" />
                        <span>Registered {new Date(student.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => handleApprove(student)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 sm:h-8 px-3.5 gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
                        >
                          {isProcessing ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-3.5" />
                          )}
                          <span>Approve</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isProcessing}
                          onClick={() => {
                            setRejectDialogUser(student)
                            setRejectionReason("")
                          }}
                          className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs h-9 sm:h-8 px-3.5 gap-1.5 cursor-pointer active:scale-[0.98]"
                        >
                          <XCircle className="size-3.5" />
                          <span>Reject</span>
                        </Button>
                      </>
                    )}

                    {status === "rejected" && (
                      <Button
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => handleApprove(student)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 sm:h-8 px-3.5 gap-1.5 cursor-pointer active:scale-[0.98]"
                      >
                        <CheckCircle2 className="size-3.5" />
                        <span>Reconsider & Approve</span>
                      </Button>
                    )}

                    {status === "approved" && student.role !== "admin" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isProcessing}
                        onClick={() => {
                          setRejectDialogUser(student)
                          setRejectionReason("")
                        }}
                        className="text-xs h-8 text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        Revoke Approval
                      </Button>
                    )}
                  </div>
                </div>

                {/* Rejection Details if rejected */}
                {status === "rejected" && student.registration_rejection_reason && (
                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-destructive text-[11px] uppercase font-mono">
                      Rejection Reason Provided:
                    </p>
                    <p className="text-foreground">{student.registration_rejection_reason}</p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Reject Reason Dialog */}
      <Dialog open={!!rejectDialogUser} onOpenChange={(open) => !open && setRejectDialogUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-foreground">
              Reject Student Registration
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Specify the reason for rejecting <strong className="text-foreground">{rejectDialogUser?.full_name}</strong>. This feedback will be displayed to the student when they attempt to log in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reject-reason">Reason for Rejection *</Label>
              <Textarea
                id="reject-reason"
                required
                placeholder="e.g. Ineligible campus affiliation, duplicate registration, or incomplete name information."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                disabled={isSubmittingReject}
                className="text-xs min-h-[90px]"
              />
            </div>

            {/* Quick Preset Buttons */}
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Quick Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Unrecognized university enrollment",
                  "Duplicate student registration account",
                  "Incomplete legal name on registration",
                  "Suspicious activity or terms violation",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectionReason(preset)}
                    className="text-[10px] border border-border/80 hover:border-primary/50 bg-muted/40 hover:bg-muted px-2 py-0.5 rounded cursor-pointer transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectDialogUser(null)}
              disabled={isSubmittingReject}
              className="text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={isSubmittingReject || !rejectionReason.trim()}
              className="text-xs h-9 font-semibold gap-1.5 cursor-pointer"
            >
              {isSubmittingReject ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Rejecting...</span>
                </>
              ) : (
                <span>Confirm Rejection</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
    </AdminShell>
  )
}
