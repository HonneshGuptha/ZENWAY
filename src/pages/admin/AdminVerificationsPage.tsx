import * as React from "react"
import { motion } from "motion/react"
import { supabase } from "@/lib/supabase"
import { AdminShell } from "@/components/admin/AdminShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Eye,
  ExternalLink,
  GraduationCap,
  Calendar,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"

interface StudentVerificationRecord {
  id: string
  user_id: string
  student_id_number: string
  id_document_path: string
  document_type: string
  status: "pending" | "approved" | "rejected"
  rejection_reason: string | null
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  full_name: string
  email: string
  university_name: string | null
}

export function AdminVerificationsPage() {
  const [verifications, setVerifications] = React.useState<StudentVerificationRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<"all" | "pending" | "approved" | "rejected">("pending")
  const [searchQuery, setSearchQuery] = React.useState("")

  // Modal actions
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [previewDocTitle, setPreviewDocTitle] = React.useState<string>("")
  const [loadingPreview, setLoadingPreview] = React.useState(false)

  const [processingId, setProcessingId] = React.useState<string | null>(null)
  const [rejectDialogRecord, setRejectDialogRecord] = React.useState<StudentVerificationRecord | null>(null)
  const [rejectionReason, setRejectionReason] = React.useState("")
  const [isSubmittingReject, setIsSubmittingReject] = React.useState(false)

  const fetchVerifications = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await (supabase.rpc as any)("get_admin_verifications", {
        p_status: activeTab === "all" ? null : activeTab,
      })
      if (!error && data) {
        setVerifications((data || []) as StudentVerificationRecord[])
        return
      }

      // Fallback: direct table query
      console.warn("[AdminVerifications] get_admin_verifications RPC fallback:", error)
      let query = supabase
        .from("student_verifications")
        .select(`
          id,
          user_id,
          student_id_number,
          id_document_path,
          document_type,
          status,
          rejection_reason,
          created_at,
          reviewed_at,
          reviewed_by,
          profiles:user_id (
            full_name,
            university_name
          )
        `)
        .order("created_at", { ascending: false })

      if (activeTab !== "all") {
        query = query.eq("status", activeTab)
      }

      const { data: tableData, error: tableErr } = await query
      if (tableErr) throw tableErr

      const mapped = (tableData || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        student_id_number: row.student_id_number,
        id_document_path: row.id_document_path,
        document_type: row.document_type,
        status: row.status,
        rejection_reason: row.rejection_reason,
        created_at: row.created_at,
        reviewed_at: row.reviewed_at,
        reviewed_by: row.reviewed_by,
        full_name: row.profiles?.full_name || "Enrolled Student",
        email: "Student Member",
        university_name: row.profiles?.university_name || null,
      }))
      setVerifications(mapped)
    } catch (err: any) {
      console.error("[AdminVerifications] Error loading verifications:", err)
      toast.error(err.message || "Failed to load verifications.")
    } finally {
      setIsLoading(false)
    }
  }, [activeTab])

  React.useEffect(() => {
    fetchVerifications()
  }, [fetchVerifications])

  // Handle Document Preview
  const handleViewDocument = async (record: StudentVerificationRecord) => {
    try {
      setLoadingPreview(true)
      setPreviewDocTitle(`${record.full_name} - ${record.document_type.replace(/_/g, " ").toUpperCase()}`)
      const { data, error } = await supabase.storage
        .from("student-ids")
        .createSignedUrl(record.id_document_path, 300)

      if (error) throw error
      if (data?.signedUrl) {
        setPreviewUrl(data.signedUrl)
      } else {
        throw new Error("Unable to generate signed URL.")
      }
    } catch (err: any) {
      console.error("[AdminVerifications] Preview error:", err)
      toast.error(err.message || "Failed to load ID document preview.")
    } finally {
      setLoadingPreview(false)
    }
  }

  // Handle Approve
  const handleApprove = async (record: StudentVerificationRecord) => {
    try {
      setProcessingId(record.id)
      const { error } = await (supabase.rpc as any)("review_student_verification", {
        p_verification_id: record.id,
        p_decision: "approved",
      })

      if (error) {
        console.warn("[AdminVerifications] review_student_verification RPC fallback to direct tables:", error)
        await supabase
          .from("student_verifications")
          .update({
            status: "approved",
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", record.id)

        await supabase
          .from("profiles")
          .update({
            verification_status: "verified",
          })
          .eq("id", record.user_id)
      }

      toast.success(`Student verification approved for ${record.full_name}`)
      await fetchVerifications()
    } catch (err: any) {
      console.error("[AdminVerifications] Approve error:", err)
      toast.error(err.message || "Failed to approve student verification.")
    } finally {
      setProcessingId(null)
    }
  }

  // Handle Reject
  const handleConfirmReject = async () => {
    if (!rejectDialogRecord) return
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejecting student verification.")
      return
    }

    try {
      setIsSubmittingReject(true)
      const { error } = await (supabase.rpc as any)("review_student_verification", {
        p_verification_id: rejectDialogRecord.id,
        p_decision: "rejected",
        p_reason: rejectionReason.trim(),
      })

      if (error) {
        console.warn("[AdminVerifications] review_student_verification RPC fallback to direct tables:", error)
        await supabase
          .from("student_verifications")
          .update({
            status: "rejected",
            rejection_reason: rejectionReason.trim(),
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", rejectDialogRecord.id)

        await supabase
          .from("profiles")
          .update({
            verification_status: "unverified",
          })
          .eq("id", rejectDialogRecord.user_id)
      }

      toast.success(`Verification rejected for ${rejectDialogRecord.full_name}`)
      setRejectDialogRecord(null)
      setRejectionReason("")
      await fetchVerifications()
    } catch (err: any) {
      console.error("[AdminVerifications] Reject error:", err)
      toast.error(err.message || "Failed to reject verification.")
    } finally {
      setIsSubmittingReject(false)
    }
  }

  const filtered = verifications.filter((item) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      item.full_name?.toLowerCase().includes(q) ||
      item.email?.toLowerCase().includes(q) ||
      item.student_id_number?.toLowerCase().includes(q) ||
      item.university_name?.toLowerCase().includes(q)
    )
  })

  return (
    <AdminShell currentSection="verifications">
      <motion.div
        variants={pageTransitionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Student ID Verification Queue
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review official campus student ID documents to grant peer exchange privileges.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchVerifications}
            disabled={isLoading}
            className="gap-2 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Tab Filter & Search Ribbon */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
            {(["pending", "approved", "rejected", "all"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  activeTab === tab
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Input
              type="search"
              placeholder="Search by student, ID, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
            <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Submissions List */}
        {isLoading ? (
          <div className="min-h-[30vh] flex flex-col items-center justify-center space-y-3">
            <Loader2 className="size-7 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground font-mono">Loading verification queue...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-xl space-y-2 bg-muted/10">
            <FileCheck2 className="size-10 text-muted-foreground/50 mx-auto" />
            <h3 className="font-semibold text-sm text-foreground">No verifications found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {activeTab === "pending"
                ? "All pending student ID documents have been reviewed."
                : `No ${activeTab} verification records match the current filter.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((record) => {
              const isPending = record.status === "pending"
              const isApproved = record.status === "approved"
              const isRejected = record.status === "rejected"

              return (
                <Card key={record.id} className="border-border/80 flex flex-col justify-between">
                  <CardHeader className="p-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-semibold text-foreground">
                          {record.full_name}
                        </CardTitle>
                        <CardDescription className="text-xs font-mono text-muted-foreground">
                          {record.email}
                        </CardDescription>
                      </div>

                      <Badge
                        variant={isApproved ? "default" : isPending ? "outline" : "destructive"}
                        className="text-[10px] capitalize font-semibold"
                      >
                        {record.status}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-0 space-y-2.5 text-xs">
                    <div className="grid grid-cols-2 gap-2 bg-muted/30 p-2.5 rounded-lg border border-border/50">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Student ID #
                        </span>
                        <p className="font-mono font-medium text-foreground">{record.student_id_number}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Document Type
                        </span>
                        <p className="font-medium text-foreground capitalize">
                          {record.document_type.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                      <span className="flex items-center gap-1">
                        <GraduationCap className="size-3.5" />
                        <span>{record.university_name || "Campus Student"}</span>
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="size-3.5" />
                        <span>{new Date(record.created_at).toLocaleDateString()}</span>
                      </span>
                    </div>

                    {isRejected && record.rejection_reason && (
                      <div className="p-2 rounded bg-destructive/10 text-destructive text-[11px] flex items-start gap-1.5">
                        <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Rejection reason:</span> {record.rejection_reason}
                        </div>
                      </div>
                    )}
                  </CardContent>

                  <div className="p-4 pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDocument(record)}
                      disabled={loadingPreview}
                      className="text-xs h-8 gap-1.5 cursor-pointer"
                    >
                      <Eye className="size-3.5" />
                      <span>Inspect ID</span>
                    </Button>

                    {isPending && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setRejectDialogRecord(record)}
                          disabled={processingId === record.id}
                          className="text-xs h-8 gap-1 cursor-pointer"
                        >
                          <XCircle className="size-3.5" />
                          <span>Reject</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(record)}
                          disabled={processingId === record.id}
                          className="text-xs h-8 gap-1 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {processingId === record.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-3.5" />
                          )}
                          <span>Approve</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Document Inspection Dialog */}
        <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-4">
            <DialogHeader className="pb-2 border-b border-border/60 flex flex-row items-center justify-between">
              <div>
                <DialogTitle className="text-base font-semibold">{previewDocTitle}</DialogTitle>
                <DialogDescription className="text-xs">
                  Signed temporary URL generated from secure storage bucket.
                </DialogDescription>
              </div>
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline pr-6"
                >
                  <ExternalLink className="size-3.5" />
                  <span>Open Full Screen</span>
                </a>
              )}
            </DialogHeader>

            <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-muted/20 rounded-lg min-h-[300px]">
              {previewUrl && (
                previewUrl.includes(".pdf") ? (
                  <iframe src={previewUrl} className="w-full h-[500px] rounded border border-border" title="Student ID PDF" />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Student ID Preview"
                    className="max-h-[500px] w-auto object-contain rounded-md shadow-md"
                  />
                )
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button size="sm" variant="outline" onClick={() => setPreviewUrl(null)}>
                Close Preview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={!!rejectDialogRecord} onOpenChange={(open) => !open && setRejectDialogRecord(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-destructive flex items-center gap-2">
                <AlertCircle className="size-4" />
                <span>Reject Student ID Verification</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Provide an actionable reason explaining why the ID document could not be validated.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="p-2.5 rounded-lg bg-muted text-xs space-y-1">
                <p className="font-semibold text-foreground">{rejectDialogRecord?.full_name}</p>
                <p className="text-muted-foreground font-mono">{rejectDialogRecord?.email}</p>
                <p className="text-muted-foreground">ID #: {rejectDialogRecord?.student_id_number}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="id-reject-reason" className="text-xs font-medium">
                  Rejection Reason (Required)
                </Label>
                <Textarea
                  id="id-reject-reason"
                  placeholder="e.g. Uploaded image is blurry and student expiry date is unreadable. Please re-upload with clear lighting."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  disabled={isSubmittingReject}
                  className="text-xs min-h-[80px]"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectDialogRecord(null)}
                disabled={isSubmittingReject}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmReject}
                disabled={isSubmittingReject || !rejectionReason.trim()}
              >
                {isSubmittingReject ? (
                  <Loader2 className="size-3.5 animate-spin" />
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
