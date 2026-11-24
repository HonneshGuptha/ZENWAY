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
  ShieldCheck,
  Car,
  Award,
  History,
  Lock,
  Clock,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"

type MainTab = "students" | "vehicles" | "renters" | "expiries" | "audit"

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

interface VehicleRecord {
  id: string
  owner_id: string
  title: string
  type: "bicycle" | "motorcycle" | "e_scooter" | "car"
  ev_speed_class: "low_speed_exempt" | "high_speed_registered" | null
  ev_exemption_verified: boolean
  transmission_type: "gearless" | "geared" | null
  registration_number: string | null
  is_registered_owner: boolean
  rc_document_path: string | null
  rc_status: "not_required" | "pending" | "approved" | "rejected"
  insurance_policy_number: string | null
  insurance_document_path: string | null
  insurance_expiry_date: string | null
  insurance_use_type: "private_personal" | "commercial_self_drive" | "unknown" | null
  insurance_suitability_status: "not_required" | "requires_review" | "suitable" | "unsuitable"
  insurance_status: "not_required" | "pending" | "approved" | "rejected"
  puc_exempt: boolean
  puc_document_path: string | null
  puc_expiry_date: string | null
  puc_status: "not_required" | "pending" | "approved" | "rejected"
  authorization_document_path: string | null
  authorization_status: "not_required" | "pending" | "approved" | "rejected"
  document_verification_status: "not_required" | "legacy_grandfathered" | "pending" | "approved" | "rejected" | "expired"
  grandfather_expires_at: string | null
  document_rejection_reason: string | null
  verified_at: string | null
  owner?: {
    id: string
    full_name: string
    university_name: string | null
  }
}

interface RenterDLRecord {
  id: string
  user_id: string
  licence_number: string | null
  front_document_path: string | null
  back_document_path: string | null
  expiry_date: string | null
  licence_categories: ("MCWOG" | "MCWG" | "LMV")[] | null
  is_current: boolean
  status: "draft" | "pending" | "approved" | "rejected" | "expired" | "superseded"
  rejection_reason: string | null
  reviewed_at: string | null
  created_at: string
  user?: {
    id: string
    full_name: string
    university_name: string | null
  }
}

interface AuditLogRecord {
  id: string
  entity_type?: string
  entity_id?: string
  action?: string
  action_type?: string
  target_type?: string
  target_id?: string
  subject_user_id?: string
  subject_name?: string
  actor_id?: string
  actor_name?: string
  actor_admin_id?: string
  previous_status: string | null
  new_status: string
  reason?: string | null
  rejection_reason?: string | null
  notes?: string | null
  document_type?: string | null
  created_at: string
  subject?: {
    full_name: string
    university_name: string | null
  }
  admin?: {
    full_name: string
  }
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "N/A"
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  } catch {
    return d
  }
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return "N/A"
  try {
    return new Date(d).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return d
  }
}

function daysRemaining(d: string | null | undefined): number {
  if (!d) return 0
  const diff = new Date(d).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function AdminVerificationsPage() {
  const [mainTab, setMainTab] = React.useState<MainTab>("students")
  const [isLoading, setIsLoading] = React.useState(true)

  // Student ID Tab state
  const [verifications, setVerifications] = React.useState<StudentVerificationRecord[]>([])
  const [studentStatusFilter, setStudentStatusFilter] = React.useState<"all" | "pending" | "approved" | "rejected">("pending")
  const [studentSearchQuery, setStudentSearchQuery] = React.useState("")
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [previewDocTitle, setPreviewDocTitle] = React.useState<string>("")
  const [loadingPreview, setLoadingPreview] = React.useState(false)
  const [processingId, setProcessingId] = React.useState<string | null>(null)
  const [rejectDialogRecord, setRejectDialogRecord] = React.useState<StudentVerificationRecord | null>(null)
  const [studentRejectReason, setStudentRejectReason] = React.useState("")
  const [isSubmittingReject, setIsSubmittingReject] = React.useState(false)

  // Vehicle Tab state
  const [vehicles, setVehicles] = React.useState<VehicleRecord[]>([])
  const [vehicleStatusFilter, setVehicleStatusFilter] = React.useState<string>("all")
  const [selectedVehicle, setSelectedVehicle] = React.useState<VehicleRecord | null>(null)
  const [vRcStatus, setVRcStatus] = React.useState<"pending" | "approved" | "rejected" | "not_required">("pending")
  const [vInsuranceStatus, setVInsuranceStatus] = React.useState<"pending" | "approved" | "rejected" | "not_required">("pending")
  const [vInsuranceSuitability, setVInsuranceSuitability] = React.useState<"suitable" | "requires_review" | "unsuitable" | "not_required">("requires_review")
  const [vPucStatus, setVPucStatus] = React.useState<"pending" | "approved" | "rejected" | "not_required">("pending")
  const [vAuthStatus, setVAuthStatus] = React.useState<"pending" | "approved" | "rejected" | "not_required">("pending")
  const [vEvExemption, setVEvExemption] = React.useState<boolean>(false)
  const [vehicleRejectReason, setVehicleRejectReason] = React.useState("")
  const [vehicleNotes, setVehicleNotes] = React.useState("")
  const [isSubmittingVehicle, setIsSubmittingVehicle] = React.useState(false)

  // Renter DL Tab state
  const [renterDls, setRenterDls] = React.useState<RenterDLRecord[]>([])
  const [selectedDL, setSelectedDL] = React.useState<RenterDLRecord | null>(null)
  const [dlRejectReason, setDlRejectReason] = React.useState("")
  const [dlNotes, setDlNotes] = React.useState("")
  const [isSubmittingDL, setIsSubmittingDL] = React.useState(false)

  // Audit Tab state
  const [auditLogs, setAuditLogs] = React.useState<AuditLogRecord[]>([])

  // Signed URL cache with TTL tracking
  const [signedUrls, setSignedUrls] = React.useState<Record<string, { url: string; expiresAt: number }>>({})

  // Fetch Student Verifications (Preserved from original implementation)
  const fetchStudentVerifications = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await (supabase.rpc as any)("get_admin_verifications", {
        p_status: studentStatusFilter === "all" ? null : studentStatusFilter,
      })
      if (!error && data) {
        setVerifications((data || []) as StudentVerificationRecord[])
        return
      }

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

      if (studentStatusFilter !== "all") {
        query = query.eq("status", studentStatusFilter)
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
      console.error("[AdminVerifications] Error loading student verifications:", err)
      toast.error(err.message || "Failed to load verifications.")
    } finally {
      setIsLoading(false)
    }
  }, [studentStatusFilter])

  // Fetch Vehicles
  const fetchVehicles = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("vehicles")
        .select(`
          id, owner_id, title, type, ev_speed_class, ev_exemption_verified,
          transmission_type, registration_number, is_registered_owner,
          rc_document_path, rc_status, insurance_policy_number,
          insurance_document_path, insurance_expiry_date, insurance_use_type,
          insurance_suitability_status, insurance_status, puc_exempt,
          puc_document_path, puc_expiry_date, puc_status,
          authorization_document_path, authorization_status,
          document_verification_status, grandfather_expires_at,
          document_rejection_reason, verified_at,
          owner:profiles!vehicles_owner_id_fkey(id, full_name, university_name)
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      setVehicles((data as unknown as VehicleRecord[]) || [])
    } catch (err: any) {
      console.error("[AdminVerifications] Error loading vehicles:", err)
      toast.error(err.message || "Failed to load vehicles.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch Renter DLs
  const fetchRenterDLs = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("renter_driving_licences")
        .select(`
          id, user_id, licence_number, front_document_path, back_document_path,
          expiry_date, licence_categories, is_current, status,
          rejection_reason, reviewed_at, created_at,
          user:profiles!renter_driving_licences_user_id_fkey(id, full_name, university_name)
        `)
        .neq("status", "draft")
        .order("created_at", { ascending: false })

      if (error) throw error
      setRenterDls((data as unknown as RenterDLRecord[]) || [])
    } catch (err: any) {
      console.error("[AdminVerifications] Error loading DLs:", err)
      toast.error(err.message || "Failed to load driving licences.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch Audit Logs
  const fetchAuditLogs = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await (supabase.rpc as any)("get_admin_verification_audit_logs", {
        p_limit: 100,
        p_offset: 0,
      })

      if (error) throw error
      setAuditLogs((data as unknown as AuditLogRecord[]) || [])
    } catch (err: any) {
      console.error("[AdminVerifications] Error loading audit logs:", err)
      toast.error(err.message || "Failed to load audit ledger.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Master fetch per tab
  React.useEffect(() => {
    if (mainTab === "students") {
      fetchStudentVerifications()
    } else if (mainTab === "vehicles") {
      fetchVehicles()
    } else if (mainTab === "renters") {
      fetchRenterDLs()
    } else if (mainTab === "expiries") {
      fetchVehicles()
      fetchRenterDLs()
    } else if (mainTab === "audit") {
      fetchAuditLogs()
    }
  }, [mainTab, fetchStudentVerifications, fetchVehicles, fetchRenterDLs, fetchAuditLogs])

  // Short-lived signed URL generator (10-minute admin preview with 30s buffer)
  const getSignedUrl = async (bucket: string, path: string): Promise<string | null> => {
    if (!path) return null
    const cacheKey = `${bucket}:${path}`
    const cached = signedUrls[cacheKey]
    if (cached && Date.now() < cached.expiresAt - 30000) {
      return cached.url
    }

    try {
      const expiresInSeconds = 600
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds)
      if (error || !data?.signedUrl) throw error || new Error("Signed URL creation failed")
      const expiresAt = Date.now() + expiresInSeconds * 1000
      setSignedUrls((prev) => ({ ...prev, [cacheKey]: { url: data.signedUrl, expiresAt } }))
      return data.signedUrl
    } catch (err) {
      console.error("Signed URL error:", err)
      return null
    }
  }

  // Student ID Preview
  const handleViewStudentDocument = async (record: StudentVerificationRecord) => {
    try {
      setLoadingPreview(true)
      setPreviewDocTitle(`${record.full_name} - ${record.document_type.replace(/_/g, " ").toUpperCase()}`)
      const signed = await getSignedUrl("student-ids", record.id_document_path)
      if (signed) {
        setPreviewUrl(signed)
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

  // Generic document viewer
  const handleOpenDoc = async (bucket: string, path: string | null) => {
    if (!path) {
      toast.error("Document path not found")
      return
    }
    const url = await getSignedUrl(bucket, path)
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer")
    } else {
      toast.error("Could not generate secure document preview URL")
    }
  }

  // Student verification approval (RPC only; no direct table write fallback)
  const handleApproveStudent = async (record: StudentVerificationRecord) => {
    try {
      setProcessingId(record.id)
      const { error } = await (supabase.rpc as any)("review_student_verification", {
        p_verification_id: record.id,
        p_decision: "approved",
      })

      if (error) {
        throw error
      }

      toast.success(`Student verification approved for ${record.full_name}`)
      await fetchStudentVerifications()
    } catch (err: any) {
      console.error("[AdminVerifications] Approve error:", err)
      toast.error(err.message || "Failed to approve student verification.")
    } finally {
      setProcessingId(null)
    }
  }

  // Student verification rejection (RPC only; no direct table write fallback)
  const handleConfirmRejectStudent = async () => {
    if (!rejectDialogRecord) return
    if (!studentRejectReason.trim()) {
      toast.error("Please provide a reason for rejecting student verification.")
      return
    }

    try {
      setIsSubmittingReject(true)
      const { error } = await (supabase.rpc as any)("review_student_verification", {
        p_verification_id: rejectDialogRecord.id,
        p_decision: "rejected",
        p_reason: studentRejectReason.trim(),
      })

      if (error) {
        throw error
      }

      toast.success(`Verification rejected for ${rejectDialogRecord.full_name}`)
      setRejectDialogRecord(null)
      setStudentRejectReason("")
      await fetchStudentVerifications()
    } catch (err: any) {
      console.error("[AdminVerifications] Reject error:", err)
      toast.error(err.message || "Failed to reject verification.")
    } finally {
      setIsSubmittingReject(false)
    }
  }

  // Vehicle review RPC (with transactional stale-review guard and consistency checks)
  const handleReviewVehicle = async (decision: "approved" | "rejected") => {
    if (!selectedVehicle) return
    if (decision === "rejected" && !vehicleRejectReason.trim()) {
      toast.error("Please provide a rejection reason")
      return
    }

    if (decision === "approved") {
      if (selectedVehicle.type !== "bicycle") {
        const isLowSpeedExempt = selectedVehicle.type === "e_scooter" && selectedVehicle.ev_speed_class === "low_speed_exempt" && vEvExemption
        if (!isLowSpeedExempt && vRcStatus !== "approved") {
          toast.error("Cannot approve vehicle: Registration Certificate (RC) must be approved.")
          return
        }

        if (vInsuranceStatus !== "approved") {
          toast.error("Cannot approve vehicle: Insurance policy must be approved.")
          return
        }
        if (vInsuranceSuitability !== "suitable") {
          toast.error("Cannot approve vehicle: Insurance suitability must be marked suitable.")
          return
        }

        if (!selectedVehicle.puc_exempt && vPucStatus !== "approved") {
          toast.error("Cannot approve vehicle: PUC certificate must be approved.")
          return
        }

        if (!selectedVehicle.is_registered_owner && vAuthStatus !== "approved") {
          toast.error("Cannot approve vehicle: Provider authorization letter must be approved.")
          return
        }
      }
    }

    setIsSubmittingVehicle(true)
    try {
      const { error } = await (supabase.rpc as any)("review_vehicle_documents", {
        p_vehicle_id: selectedVehicle.id,
        p_overall_status: decision,
        p_rc_status: selectedVehicle.type === "bicycle" ? "not_required" : vRcStatus,
        p_insurance_status: selectedVehicle.type === "bicycle" ? "not_required" : vInsuranceStatus,
        p_insurance_suitability_status: selectedVehicle.type === "bicycle" ? "not_required" : vInsuranceSuitability,
        p_insurance_use_type: selectedVehicle.insurance_use_type || null,
        p_puc_status: (selectedVehicle.type === "bicycle" || selectedVehicle.puc_exempt) ? "not_required" : vPucStatus,
        p_puc_exempt: selectedVehicle.puc_exempt,
        p_authorization_status: selectedVehicle.is_registered_owner ? "not_required" : vAuthStatus,
        p_ev_exemption_verified: (selectedVehicle.type === "e_scooter" || selectedVehicle.ev_speed_class !== null) ? vEvExemption : false,
        p_rejection_reason: decision === "rejected" ? vehicleRejectReason.trim() : null,
        p_notes: vehicleNotes.trim() ? vehicleNotes.trim() : null,
        p_expected_status: selectedVehicle.document_verification_status,
      })

      if (error) throw error
      toast.success(`Vehicle verification ${decision}`)
      setSelectedVehicle(null)
      setVehicleRejectReason("")
      setVehicleNotes("")
      await fetchVehicles()
    } catch (err: any) {
      console.error("Vehicle review error:", err)
      if (err.message?.includes("Stale Review Conflict")) {
        toast.error("Stale Review: This vehicle's documents were updated in another session. Refreshed.")
        await fetchVehicles()
      } else {
        toast.error(err.message || "Failed to record vehicle review")
      }
    } finally {
      setIsSubmittingVehicle(false)
    }
  }

  // Renter DL review RPC (with transactional stale-review guard)
  const handleReviewDL = async (decision: "approved" | "rejected") => {
    if (!selectedDL) return
    if (decision === "rejected" && !dlRejectReason.trim()) {
      toast.error("Please provide a rejection reason")
      return
    }

    setIsSubmittingDL(true)
    try {
      const { error } = await (supabase.rpc as any)("review_renter_dl", {
        p_licence_id: selectedDL.id,
        p_decision: decision,
        p_rejection_reason: decision === "rejected" ? dlRejectReason.trim() : null,
        p_notes: dlNotes.trim() ? dlNotes.trim() : null,
        p_expected_status: selectedDL.status,
      })

      if (error) throw error
      toast.success(`Renter DL ${decision}`)
      setSelectedDL(null)
      setDlRejectReason("")
      setDlNotes("")
      await fetchRenterDLs()
    } catch (err: any) {
      console.error("DL review error:", err)
      if (err.message?.includes("Stale Review Conflict")) {
        toast.error("Stale Review: This driving licence submission was updated or superseded. Refreshed.")
        await fetchRenterDLs()
      } else {
        toast.error(err.message || "Failed to record DL review")
      }
    } finally {
      setIsSubmittingDL(false)
    }
  }

  const filteredStudentVerifications = verifications.filter((item) => {
    const q = studentSearchQuery.toLowerCase().trim()
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[rgba(255,255,255,0.08)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#EA2E00]/10 text-[#EA2E00]">
                <ShieldCheck className="size-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[#FAFAFA]">
                Trust & Verification Console
              </h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Multi-tier campus compliance: Student IDs, Provider Vehicles, Renter Driving Licences, Expiries & Audit Ledger.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (mainTab === "students") fetchStudentVerifications()
              else if (mainTab === "vehicles") fetchVehicles()
              else if (mainTab === "renters") fetchRenterDLs()
              else if (mainTab === "expiries") { fetchVehicles(); fetchRenterDLs() }
              else if (mainTab === "audit") fetchAuditLogs()
            }}
            disabled={isLoading}
            className="gap-2 cursor-pointer font-mono text-xs border-[rgba(255,255,255,0.12)] bg-[#121215] hover:bg-[#1C1C22] text-zinc-200"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin text-[#EA2E00]" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Console Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[rgba(255,255,255,0.08)]">
          <button
            type="button"
            onClick={() => setMainTab("students")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              mainTab === "students"
                ? "bg-[#27272A] text-[#FAFAFA] border border-[rgba(255,255,255,0.15)] shadow-sm"
                : "text-zinc-400 hover:text-[#FAFAFA] hover:bg-[#18181B]"
            }`}
          >
            <GraduationCap className="size-4" />
            <span>Student IDs</span>
            {verifications.filter((s) => s.status === "pending").length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#EA2E00]/20 text-[#EA2E00]">
                {verifications.filter((s) => s.status === "pending").length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMainTab("vehicles")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              mainTab === "vehicles"
                ? "bg-[#27272A] text-[#FAFAFA] border border-[rgba(255,255,255,0.15)] shadow-sm"
                : "text-zinc-400 hover:text-[#FAFAFA] hover:bg-[#18181B]"
            }`}
          >
            <Car className="size-4" />
            <span>Vehicle Papers</span>
            {vehicles.filter((v) => v.document_verification_status === "pending").length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-400">
                {vehicles.filter((v) => v.document_verification_status === "pending").length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMainTab("renters")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              mainTab === "renters"
                ? "bg-[#27272A] text-[#FAFAFA] border border-[rgba(255,255,255,0.15)] shadow-sm"
                : "text-zinc-400 hover:text-[#FAFAFA] hover:bg-[#18181B]"
            }`}
          >
            <Award className="size-4" />
            <span>Renter Driving Licences</span>
            {renterDls.filter((d) => d.status === "pending").length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-500/20 text-blue-400">
                {renterDls.filter((d) => d.status === "pending").length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMainTab("expiries")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              mainTab === "expiries"
                ? "bg-[#27272A] text-[#FAFAFA] border border-[rgba(255,255,255,0.15)] shadow-sm"
                : "text-zinc-400 hover:text-[#FAFAFA] hover:bg-[#18181B]"
            }`}
          >
            <Calendar className="size-4" />
            <span>Expiry Monitoring</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab("audit")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              mainTab === "audit"
                ? "bg-[#27272A] text-[#FAFAFA] border border-[rgba(255,255,255,0.15)] shadow-sm"
                : "text-zinc-400 hover:text-[#FAFAFA] hover:bg-[#18181B]"
            }`}
          >
            <History className="size-4" />
            <span>Immutable Ledger</span>
          </button>
        </div>

        {/* TAB 1: STUDENT ID QUEUE (Preserved from original implementation) */}
        {mainTab === "students" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1 bg-[#18181B] border border-[rgba(255,255,255,0.08)] p-1 rounded-xl">
                {(["pending", "approved", "rejected", "all"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStudentStatusFilter(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                      studentStatusFilter === tab
                        ? "bg-[#27272A] text-[#FAFAFA] shadow-xs font-bold border border-[rgba(255,255,255,0.1)]"
                        : "text-zinc-400 hover:text-[#FAFAFA]"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Input
                  type="search"
                  placeholder="Search student, ID, or campus..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-xs bg-[#18181B] border-[rgba(255,255,255,0.12)] text-[#FAFAFA] placeholder:text-zinc-500"
                />
                <Search className="size-3.5 text-zinc-400 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            {isLoading ? (
              <div className="min-h-[30vh] flex flex-col items-center justify-center space-y-3">
                <Loader2 className="size-7 text-[#EA2E00] animate-spin" />
                <span className="text-xs text-zinc-400 font-mono">Loading student verification queue...</span>
              </div>
            ) : filteredStudentVerifications.length === 0 ? (
              <div className="min-h-[25vh] flex flex-col items-center justify-center border border-dashed border-[rgba(255,255,255,0.12)] rounded-xl p-8 text-center bg-[#121215]/50">
                <GraduationCap className="size-10 text-zinc-600 mb-2 stroke-[1.5]" />
                <h3 className="text-sm font-semibold text-[#FAFAFA]">No Student Verifications Found</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                  {studentStatusFilter === "pending"
                    ? "All student ID submissions have been reviewed."
                    : "No student records matched the current filter criteria."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStudentVerifications.map((record) => (
                  <Card
                    key={record.id}
                    className="bg-[#121215] border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.16)] transition-all flex flex-col justify-between"
                  >
                    <CardHeader className="p-4 pb-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <CardTitle className="text-sm font-semibold text-[#FAFAFA] line-clamp-1">
                            {record.full_name}
                          </CardTitle>
                          <CardDescription className="text-xs text-zinc-400 flex items-center gap-1.5 font-mono">
                            <span>{record.university_name || "Campus Unspecified"}</span>
                          </CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono capitalize px-2 py-0.5 border ${
                            record.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : record.status === "rejected"
                              ? "bg-red-500/10 text-red-400 border-red-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {record.status}
                        </Badge>
                      </div>

                      <div className="space-y-1 text-xs pt-1 font-mono text-zinc-400">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Student ID #:</span>
                          <span className="text-zinc-200 font-semibold">{record.student_id_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Submitted:</span>
                          <span>{formatDate(record.created_at)}</span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-0 space-y-3">
                      {record.rejection_reason && (
                        <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                          <span className="font-semibold block text-[11px] uppercase tracking-wider mb-0.5">Rejection Reason:</span>
                          {record.rejection_reason}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewStudentDocument(record)}
                          disabled={loadingPreview}
                          className="flex-1 font-mono text-xs border-[rgba(255,255,255,0.12)] bg-[#18181B] hover:bg-[#202025] text-zinc-200"
                        >
                          <Eye className="size-3.5 mr-1 text-zinc-400" />
                          <span>View ID</span>
                        </Button>

                        {record.status === "pending" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setRejectDialogRecord(record)
                                setStudentRejectReason("")
                              }}
                              disabled={processingId === record.id}
                              className="font-mono text-xs border-red-500/20 hover:bg-red-500/10 text-red-400"
                            >
                              <XCircle className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApproveStudent(record)}
                              disabled={processingId === record.id}
                              className="font-mono text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              {processingId === record.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="size-3.5 mr-1" />
                              )}
                              <span>Approve</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: VEHICLE PAPERS */}
        {mainTab === "vehicles" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-zinc-400">Filter Status:</span>
                <select
                  value={vehicleStatusFilter}
                  onChange={(e) => setVehicleStatusFilter(e.target.value)}
                  className="text-xs bg-[#18181B] border border-[rgba(255,255,255,0.12)] rounded-lg px-2.5 py-1.5 text-zinc-200"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending Only</option>
                  <option value="legacy_grandfathered">Legacy Grandfathered</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="not_required">Bicycles (Not Required)</option>
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="min-h-[30vh] flex flex-col items-center justify-center space-y-3">
                <Loader2 className="size-7 text-[#EA2E00] animate-spin" />
                <span className="text-xs text-zinc-400 font-mono">Loading vehicle compliance records...</span>
              </div>
            ) : vehicles.length === 0 ? (
              <div className="min-h-[25vh] flex flex-col items-center justify-center border border-dashed border-[rgba(255,255,255,0.12)] rounded-xl p-8 text-center bg-[#121215]/50">
                <Car className="size-10 text-zinc-600 mb-2 stroke-[1.5]" />
                <h3 className="text-sm font-semibold text-[#FAFAFA]">No Vehicle Records</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm">No vehicles matched the selected filter.</p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(255,255,255,0.06)] rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#121215] overflow-hidden">
                {vehicles
                  .filter((v) => vehicleStatusFilter === "all" || v.document_verification_status === vehicleStatusFilter)
                  .map((v) => (
                    <div key={v.id} className="p-4 hover:bg-[#18181B]/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[#FAFAFA]">{v.title}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#27272A] text-zinc-300 uppercase font-mono">
                            {v.type}
                          </span>
                          {v.registration_number && (
                            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#EA2E00]/20 text-[#EA2E00]">
                              {v.registration_number}
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono capitalize px-2 py-0.5 border ${
                              v.document_verification_status === "approved"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : v.document_verification_status === "pending"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : v.document_verification_status === "legacy_grandfathered"
                                ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                                : v.document_verification_status === "rejected"
                                ? "bg-red-500/10 text-red-400 border-red-500/30"
                                : "bg-zinc-800 text-zinc-400 border-zinc-700"
                            }`}
                          >
                            {v.document_verification_status}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                          <span>Provider: <strong className="text-zinc-200">{v.owner?.full_name || "Unknown"}</strong> ({v.owner?.university_name || "Campus"})</span>
                          {v.grandfather_expires_at && (
                            <span className="text-purple-400 font-mono">
                              Grandfather grace: {formatDate(v.grandfather_expires_at)}
                            </span>
                          )}
                          <span>RC: <strong className="text-zinc-300 font-mono">{v.rc_status}</strong></span>
                          <span>Insurance: <strong className="text-zinc-300 font-mono">{v.insurance_status}</strong></span>
                          <span>PUC: <strong className="text-zinc-300 font-mono">{v.puc_status}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedVehicle(v)
                            setVRcStatus(v.rc_status as any)
                            setVInsuranceStatus(v.insurance_status as any)
                            setVInsuranceSuitability(v.insurance_suitability_status as any)
                            setVPucStatus(v.puc_status as any)
                            setVAuthStatus(v.authorization_status as any)
                            setVEvExemption(v.ev_exemption_verified || false)
                          }}
                          className="font-mono text-xs border-[rgba(255,255,255,0.12)] bg-[#18181B] hover:bg-[#202025] text-zinc-200"
                        >
                          <Eye className="size-3.5 mr-1 text-[#EA2E00]" />
                          <span>Inspect Papers</span>
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: RENTER DRIVING LICENCES */}
        {mainTab === "renters" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#FAFAFA]">Renter Driving Licences</h3>
                <p className="text-xs text-zinc-400">Required eligibility credential for renting motorized vehicles</p>
              </div>
            </div>

            {isLoading ? (
              <div className="min-h-[30vh] flex flex-col items-center justify-center space-y-3">
                <Loader2 className="size-7 text-[#EA2E00] animate-spin" />
                <span className="text-xs text-zinc-400 font-mono">Loading driving licence records...</span>
              </div>
            ) : renterDls.length === 0 ? (
              <div className="min-h-[25vh] flex flex-col items-center justify-center border border-dashed border-[rgba(255,255,255,0.12)] rounded-xl p-8 text-center bg-[#121215]/50">
                <Award className="size-10 text-zinc-600 mb-2 stroke-[1.5]" />
                <h3 className="text-sm font-semibold text-[#FAFAFA]">No Driving Licences Submitted</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm">No renter DL records registered in database.</p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(255,255,255,0.06)] rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#121215] overflow-hidden">
                {renterDls.map((dl) => (
                  <div key={dl.id} className="p-4 hover:bg-[#18181B]/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold font-mono text-sm text-[#FAFAFA]">{dl.licence_number || "N/A"}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono capitalize px-2 py-0.5 border ${
                            dl.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : dl.status === "pending"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                              : dl.status === "rejected"
                              ? "bg-red-500/10 text-red-400 border-red-500/30"
                              : dl.status === "draft"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700"
                          }`}
                        >
                          {dl.status}
                        </Badge>
                        {dl.is_current ? (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#EA2E00]/20 text-[#EA2E00]">
                            CURRENT
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                            SUPERSEDED / HISTORICAL
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                        <span>Renter: <strong className="text-zinc-200">{dl.user?.full_name || "Unknown"}</strong> ({dl.user?.university_name || "Campus"})</span>
                        <span>Expiry: <strong className="font-mono text-zinc-200">{formatDate(dl.expiry_date)}</strong></span>
                        <span className="flex items-center gap-1">
                          Categories:
                          {(dl.licence_categories || []).map((c) => (
                            <span key={c} className="px-1.5 py-0.2 rounded bg-[#27272A] text-zinc-200 font-mono text-[10px]">
                              {c}
                            </span>
                          ))}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDL(dl)}
                        className="font-mono text-xs border-[rgba(255,255,255,0.12)] bg-[#18181B] hover:bg-[#202025] text-zinc-200"
                      >
                        <Eye className="size-3.5 mr-1 text-[#EA2E00]" />
                        <span>Inspect Licence</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: EXPIRY MONITORING */}
        {mainTab === "expiries" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-[#FAFAFA]">Compliance Expiry Tracking</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Proactive tracking distinguishing actual document expiries (threshold: 30 days) from 21-day grandfathering transition deadlines (threshold: 7 days).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Grandfathered Vehicles Tracking */}
              <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-3">
                <div className="flex items-center gap-2 text-purple-400">
                  <Clock className="size-4" />
                  <h4 className="font-semibold text-sm">Grandfathered Vehicles (21-Day Transition Grace)</h4>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Transitional listing grace period before mandatory document verification enforcement.
                </p>
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {vehicles
                    .filter((v) => v.document_verification_status === "legacy_grandfathered" && v.grandfather_expires_at)
                    .map((v) => {
                      const daysLeft = daysRemaining(v.grandfather_expires_at)
                      const isElapsed = daysLeft < 0
                      const isApproaching = daysLeft >= 0 && daysLeft <= 7
                      return (
                        <div key={v.id} className="p-2.5 rounded-lg border border-purple-500/10 bg-[#121215]/80 flex items-center justify-between text-xs">
                          <div className="space-y-0.5">
                            <p className="font-medium text-zinc-200">{v.title}</p>
                            <p className="text-zinc-500 font-mono text-[11px]">{v.registration_number || v.type} &bull; {v.owner?.full_name || "Unknown Provider"}</p>
                          </div>
                          <div className="text-right space-y-0.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-mono px-2 py-0.5 ${
                                isElapsed
                                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                                  : isApproaching
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                  : "bg-purple-500/20 text-purple-400 border-purple-500/30"
                              }`}
                            >
                              {isElapsed
                                ? `Elapsed (${Math.abs(daysLeft)}d ago)`
                                : isApproaching
                                ? `Approaching (${daysLeft}d left)`
                                : `Active Grace (${daysLeft}d left)`}
                            </Badge>
                            <p className="text-[11px] text-zinc-500 font-mono">
                              Deadline: {formatDate(v.grandfather_expires_at)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  {vehicles.filter((v) => v.document_verification_status === "legacy_grandfathered").length === 0 && (
                    <p className="text-xs text-zinc-500 italic p-3 text-center">No vehicles currently under legacy grandfathering period.</p>
                  )}
                </div>
              </div>

              {/* Actual Document Expiries: Insurance, PUC, and Renter DLs */}
              <div className="p-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#121215] space-y-3">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="size-4" />
                  <h4 className="font-semibold text-sm">Actual Document Expirations (Insurance, PUC, DL)</h4>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Official statutory document expiration dates registered in vehicle & driver records.
                </p>
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {/* Vehicle Insurance & PUC */}
                  {vehicles
                    .filter((v) => v.insurance_expiry_date || (v.puc_expiry_date && !v.puc_exempt))
                    .map((v) => (
                      <div key={v.id} className="p-2.5 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181B]/60 space-y-1.5 text-xs">
                        <div className="flex justify-between font-medium">
                          <span className="text-zinc-200">{v.title}</span>
                          <span className="font-mono text-zinc-400">{v.registration_number || v.type}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-0.5">
                          {v.insurance_expiry_date && (() => {
                            const days = daysRemaining(v.insurance_expiry_date)
                            const isExpired = days < 0
                            const isUpcoming = days >= 0 && days <= 30
                            return (
                              <div className="space-y-0.5">
                                <span className="text-zinc-500">Insurance: </span>
                                <span className={isExpired ? "text-red-400 font-bold" : isUpcoming ? "text-amber-400 font-semibold" : "text-zinc-200"}>
                                  {formatDate(v.insurance_expiry_date)}
                                </span>
                                <span className={`block text-[10px] ${isExpired ? "text-red-400" : isUpcoming ? "text-amber-400" : "text-emerald-400"}`}>
                                  {isExpired ? "EXPIRED" : isUpcoming ? `${days}d left` : "VALID"}
                                </span>
                              </div>
                            )
                          })()}
                          {v.puc_expiry_date && !v.puc_exempt && (() => {
                            const days = daysRemaining(v.puc_expiry_date)
                            const isExpired = days < 0
                            const isUpcoming = days >= 0 && days <= 30
                            return (
                              <div className="space-y-0.5">
                                <span className="text-zinc-500">PUC: </span>
                                <span className={isExpired ? "text-red-400 font-bold" : isUpcoming ? "text-amber-400 font-semibold" : "text-zinc-200"}>
                                  {formatDate(v.puc_expiry_date)}
                                </span>
                                <span className={`block text-[10px] ${isExpired ? "text-red-400" : isUpcoming ? "text-amber-400" : "text-emerald-400"}`}>
                                  {isExpired ? "EXPIRED" : isUpcoming ? `${days}d left` : "VALID"}
                                </span>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    ))}

                  {/* Renter Driving Licences */}
                  {renterDls
                    .filter((d) => d.expiry_date)
                    .map((d) => {
                      const days = daysRemaining(d.expiry_date)
                      const isExpired = days < 0
                      const isUpcoming = days >= 0 && days <= 30
                      return (
                        <div key={d.id} className="p-2.5 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181B]/60 space-y-1 text-xs">
                          <div className="flex justify-between font-medium">
                            <span className="text-zinc-200">DL: {d.licence_number} ({d.user?.full_name || "Renter"})</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-mono px-1.5 py-0.2 ${
                                isExpired
                                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                                  : isUpcoming
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                  : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              }`}
                            >
                              {isExpired ? "EXPIRED" : isUpcoming ? `${days}d left` : "VALID"}
                            </Badge>
                          </div>
                          <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                            <span>Categories: {(d.licence_categories || []).join(", ") || "None"}</span>
                            <span>Expires: <strong className="text-zinc-200">{formatDate(d.expiry_date)}</strong></span>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: IMMUTABLE AUDIT LEDGER */}
        {mainTab === "audit" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#FAFAFA]">Immutable Verification Ledger</h3>
                <p className="text-xs text-zinc-400">Cryptographically secured audit trail of all compliance reviews</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <Lock className="size-3.5" />
                <span>Append-Only</span>
              </div>
            </div>

            {isLoading ? (
              <div className="min-h-[30vh] flex flex-col items-center justify-center space-y-3">
                <Loader2 className="size-7 text-[#EA2E00] animate-spin" />
                <span className="text-xs text-zinc-400 font-mono">Loading audit ledger...</span>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="min-h-[25vh] flex flex-col items-center justify-center border border-dashed border-[rgba(255,255,255,0.12)] rounded-xl p-8 text-center bg-[#121215]/50">
                <History className="size-10 text-zinc-600 mb-2 stroke-[1.5]" />
                <h3 className="text-sm font-semibold text-[#FAFAFA]">No Audit Entries</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm">No actions recorded in verification audit ledger yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(255,255,255,0.06)] rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#121215] overflow-hidden">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 text-xs hover:bg-[#18181B]/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold px-2 py-0.5 rounded bg-[#27272A] text-zinc-200">
                          {log.action || log.action_type || "REVIEW"}
                        </span>
                        <span className="text-zinc-500">Target:</span>
                        <span className="font-mono text-zinc-300">
                          {log.entity_type || log.target_type || "entity"} ({((log.entity_id || log.target_id) || "").slice(0, 8)}...)
                        </span>
                        <span className="text-zinc-500">&rarr;</span>
                        <span className="font-semibold text-[#EA2E00]">{log.new_status}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 text-zinc-400">
                        <span>
                          Subject: <strong className="text-zinc-200">{log.subject_name || log.subject?.full_name || log.subject_user_id?.slice(0, 8) || "Unknown"}</strong>
                        </span>
                        <span>
                          Admin: <strong className="text-zinc-200">{log.actor_name || log.admin?.full_name || log.actor_id?.slice(0, 8) || log.actor_admin_id?.slice(0, 8) || "System Admin"}</strong>
                        </span>
                        {(log.reason || log.rejection_reason) && (
                          <span className="text-red-400 font-mono">Reason: {log.reason || log.rejection_reason}</span>
                        )}
                        {log.notes && <span>Notes: {log.notes}</span>}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                      {formatDateTime(log.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal: Document Preview (Student ID / Images) */}
        <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
          <DialogContent className="max-w-2xl bg-[#09090B] border-[rgba(255,255,255,0.15)] text-[#FAFAFA] dark">
            <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.08)]">
              <div>
                <DialogTitle className="text-base font-semibold text-[#FAFAFA]">{previewDocTitle}</DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  Temporary signed URL preview from private bucket.
                </DialogDescription>
              </div>
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#EA2E00] hover:underline pr-6 font-mono"
                >
                  <ExternalLink className="size-3.5" />
                  <span>Open Full Screen</span>
                </a>
              )}
            </DialogHeader>

            <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-[#121215] rounded-lg min-h-[300px] border border-[rgba(255,255,255,0.06)]">
              {previewUrl && (
                previewUrl.includes(".pdf") ? (
                  <iframe src={previewUrl} className="w-full h-[500px] rounded border border-[rgba(255,255,255,0.1)]" title="PDF Document" />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Document Preview"
                    loading="lazy"
                    decoding="async"
                    className="max-h-[500px] w-auto object-contain rounded-md shadow-md"
                  />
                )
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button size="sm" variant="outline" onClick={() => setPreviewUrl(null)} className="font-mono text-xs border-[rgba(255,255,255,0.12)] bg-[#18181B] text-zinc-200">
                Close Preview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Reject Student ID Dialog */}
        <Dialog open={!!rejectDialogRecord} onOpenChange={(open) => !open && setRejectDialogRecord(null)}>
          <DialogContent className="max-w-md bg-[#09090B] border-[rgba(255,255,255,0.15)] text-[#FAFAFA] dark">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-red-400 flex items-center gap-2 font-mono">
                <AlertCircle className="size-4 text-red-500" />
                <span>REJECT STUDENT ID VERIFICATION</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Provide an actionable reason explaining why the ID document could not be validated.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="p-2.5 rounded-lg bg-[#18181B] border border-[rgba(255,255,255,0.08)] text-xs space-y-1">
                <p className="font-semibold text-[#FAFAFA]">{rejectDialogRecord?.full_name}</p>
                <p className="text-zinc-400 font-mono">ID #: {rejectDialogRecord?.student_id_number}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="id-reject-reason" className="text-xs font-mono text-zinc-300">
                  Rejection Reason (Required)
                </Label>
                <Textarea
                  id="id-reject-reason"
                  placeholder="e.g. Uploaded image is blurry or expired. Please re-upload with clear lighting."
                  value={studentRejectReason}
                  onChange={(e) => setStudentRejectReason(e.target.value)}
                  disabled={isSubmittingReject}
                  className="text-xs min-h-[80px] bg-[#18181B] border-[rgba(255,255,255,0.1)] text-[#FAFAFA] placeholder:text-zinc-600"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectDialogRecord(null)}
                disabled={isSubmittingReject}
                className="font-mono text-xs border-[rgba(255,255,255,0.12)] bg-[#18181B] text-zinc-300"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmRejectStudent}
                disabled={isSubmittingReject || !studentRejectReason.trim()}
                className="font-mono text-xs bg-red-600 hover:bg-red-700 text-white font-bold"
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

        {/* Modal: Vehicle Inspection & Decision */}
        <Dialog open={!!selectedVehicle} onOpenChange={(open) => !open && setSelectedVehicle(null)}>
          <DialogContent className="max-w-2xl bg-[#09090B] border-[rgba(255,255,255,0.15)] text-[#FAFAFA] dark">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-[#FAFAFA]">
                Inspect Vehicle Papers: {selectedVehicle?.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Owner: {selectedVehicle?.owner?.full_name} | Type: {selectedVehicle?.type} | Reg: {selectedVehicle?.registration_number || "None"}
              </DialogDescription>
            </DialogHeader>

            {selectedVehicle && (
              <div className="space-y-4 py-2">
                {/* Document Review List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Attached Compliance Documents</h4>

                  {/* RC */}
                  <div className="p-3 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#18181B] flex items-center justify-between">
                    <div>
                      <p className="font-medium text-xs text-[#FAFAFA]">Registration Certificate (RC)</p>
                      <p className="text-[11px] text-zinc-400 font-mono">
                        {selectedVehicle.rc_document_path || "No RC document uploaded"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedVehicle.rc_document_path && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDoc("vehicle-docs", selectedVehicle.rc_document_path)}
                          className="font-mono text-xs border-[rgba(255,255,255,0.12)] bg-[#121215] text-zinc-200"
                        >
                          <ExternalLink className="size-3 mr-1" /> View RC
                        </Button>
                      )}
                      <select
                        value={vRcStatus}
                        onChange={(e) => setVRcStatus(e.target.value as any)}
                        className="text-xs bg-[#121215] border border-[rgba(255,255,255,0.12)] rounded px-2 py-1 text-zinc-200 font-mono"
                      >
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                  </div>

                  {/* Insurance */}
                  <div className="p-3 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#18181B] flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-xs text-[#FAFAFA]">Insurance Policy</p>
                      <p className="text-[11px] text-zinc-400 font-mono">
                        #{selectedVehicle.insurance_policy_number || "N/A"} | Expiry: {selectedVehicle.insurance_expiry_date || "N/A"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedVehicle.insurance_document_path && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDoc("vehicle-docs", selectedVehicle.insurance_document_path)}
                          className="font-mono text-xs border-[rgba(255,255,255,0.12)] bg-[#121215] text-zinc-200"
                        >
                          <ExternalLink className="size-3 mr-1" /> View Policy
                        </Button>
                      )}
                      <select
                        value={vInsuranceSuitability}
                        onChange={(e) => setVInsuranceSuitability(e.target.value as any)}
                        className="text-xs bg-[#121215] border border-[rgba(255,255,255,0.12)] rounded px-2 py-1 text-zinc-200 font-mono"
                      >
                        <option value="suitable">Suitable</option>
                        <option value="requires_review">Requires Review</option>
                        <option value="unsuitable">Unsuitable</option>
                      </select>
                      <select
                        value={vInsuranceStatus}
                        onChange={(e) => setVInsuranceStatus(e.target.value as any)}
                        className="text-xs bg-[#121215] border border-[rgba(255,255,255,0.12)] rounded px-2 py-1 text-zinc-200 font-mono"
                      >
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                  </div>

                  {/* PUC */}
                  <div className="p-3 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#18181B] flex items-center justify-between">
                    <div>
                      <p className="font-medium text-xs text-[#FAFAFA]">PUC Certificate</p>
                      <p className="text-[11px] text-zinc-400 font-mono">
                        {selectedVehicle.puc_exempt ? "Exempt (Electric / Bicycle)" : `Expiry: ${selectedVehicle.puc_expiry_date || "N/A"}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedVehicle.puc_document_path && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDoc("vehicle-docs", selectedVehicle.puc_document_path)}
                          className="font-mono text-xs border-[rgba(255,255,255,0.12)] bg-[#121215] text-zinc-200"
                        >
                          <ExternalLink className="size-3 mr-1" /> View PUC
                        </Button>
                      )}
                      <select
                        value={vPucStatus}
                        onChange={(e) => setVPucStatus(e.target.value as any)}
                        disabled={selectedVehicle.puc_exempt}
                        className="text-xs bg-[#121215] border border-[rgba(255,255,255,0.12)] rounded px-2 py-1 text-zinc-200 font-mono"
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="not_required">Not Required</option>
                      </select>
                    </div>
                  </div>

                  {/* Non-owner authorization */}
                  {!selectedVehicle.is_registered_owner && (
                    <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-xs text-amber-400">Provider Authorization Letter</p>
                        <p className="text-[11px] text-zinc-400">Provider is not the registered owner</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedVehicle.authorization_document_path && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDoc("vehicle-docs", selectedVehicle.authorization_document_path)}
                            className="font-mono text-xs border-[rgba(255,255,255,0.12)] bg-[#121215] text-zinc-200"
                          >
                            <ExternalLink className="size-3 mr-1" /> View Letter
                          </Button>
                        )}
                        <select
                          value={vAuthStatus}
                          onChange={(e) => setVAuthStatus(e.target.value as any)}
                          className="text-xs bg-[#121215] border border-[rgba(255,255,255,0.12)] rounded px-2 py-1 text-zinc-200 font-mono"
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                          <option value="not_required">Not Required</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* EV Speed Class & Exemption Verification */}
                  {(selectedVehicle.type === "e_scooter" || selectedVehicle.ev_speed_class !== null) && (
                    <div className="p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-xs text-cyan-300">EV Speed Class & Exemption</p>
                        <p className="text-[11px] text-zinc-400 font-mono">
                          Class: {selectedVehicle.ev_speed_class ? selectedVehicle.ev_speed_class.replace(/_/g, " ").toUpperCase() : "UNSPECIFIED (DEFAULT LOW SPEED)"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-xs font-mono text-zinc-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={vEvExemption}
                            onChange={(e) => setVEvExemption(e.target.checked)}
                            className="rounded border-[rgba(255,255,255,0.2)] bg-[#121215] text-[#EA2E00] focus:ring-0 size-3.5"
                          />
                          <span>Exemption Verified (&le;25 km/h)</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-2">
                  <Label className="text-xs font-mono text-zinc-300">Rejection Reason (Required if Rejecting)</Label>
                  <Input
                    type="text"
                    value={vehicleRejectReason}
                    onChange={(e) => setVehicleRejectReason(e.target.value)}
                    placeholder="e.g. Blurry RC image, expired insurance policy"
                    className="text-xs bg-[#18181B] border-[rgba(255,255,255,0.1)] text-[#FAFAFA]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-zinc-300">Admin Ledger Notes (Optional)</Label>
                  <Input
                    type="text"
                    value={vehicleNotes}
                    onChange={(e) => setVehicleNotes(e.target.value)}
                    placeholder="Internal compliance review notes"
                    className="text-xs bg-[#18181B] border-[rgba(255,255,255,0.1)] text-[#FAFAFA]"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedVehicle(null)}
                className="font-mono text-xs border-[rgba(255,255,255,0.12)] bg-[#18181B] text-zinc-300"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleReviewVehicle("rejected")}
                disabled={isSubmittingVehicle}
                className="font-mono text-xs bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                Reject Vehicle
              </Button>
              <Button
                size="sm"
                onClick={() => handleReviewVehicle("approved")}
                disabled={isSubmittingVehicle}
                className="font-mono text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                {isSubmittingVehicle ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <CheckCircle2 className="size-3.5 mr-1" />}
                Approve Vehicle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Renter DL Inspection & Decision */}
        <Dialog open={!!selectedDL} onOpenChange={(open) => !open && setSelectedDL(null)}>
          <DialogContent className="max-w-xl bg-[#09090B] border-[rgba(255,255,255,0.15)] text-[#FAFAFA] dark">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-[#FAFAFA]">
                Inspect Renter Driving Licence
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Renter: {selectedDL?.user?.full_name} ({selectedDL?.user?.university_name || "Campus"}) | DL #: {selectedDL?.licence_number}
              </DialogDescription>
            </DialogHeader>

            {selectedDL && (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#18181B]">
                    <span className="text-zinc-500">Expiry Date:</span>
                    <p className="font-semibold font-mono text-sm text-[#FAFAFA] mt-0.5">
                      {formatDate(selectedDL.expiry_date)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#18181B]">
                    <span className="text-zinc-500">Categories:</span>
                    <p className="font-semibold font-mono text-sm text-[#FAFAFA] mt-0.5">
                      {selectedDL.licence_categories?.join(", ") || "None"}
                    </p>
                  </div>
                </div>

                {/* Previews */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!selectedDL.front_document_path}
                    onClick={() => selectedDL.front_document_path && handleOpenDoc("driving-licences", selectedDL.front_document_path)}
                    className="font-mono text-xs border-[rgba(255,255,255,0.12)] bg-[#18181B] text-zinc-200"
                  >
                    <ExternalLink className="size-3 mr-1 text-[#EA2E00]" /> View DL Front
                  </Button>
                  {selectedDL.back_document_path ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDoc("driving-licences", selectedDL.back_document_path)}
                      className="font-mono text-xs border-[rgba(255,255,255,0.12)] bg-[#18181B] text-zinc-200"
                    >
                      <ExternalLink className="size-3 mr-1 text-[#EA2E00]" /> View DL Back
                    </Button>
                  ) : (
                    <div className="text-xs text-zinc-500 flex items-center justify-center border border-dashed border-[rgba(255,255,255,0.08)] rounded-md">
                      No Back Upload
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-2">
                  <Label className="text-xs font-mono text-zinc-300">Rejection Reason (Required if Rejecting)</Label>
                  <Input
                    type="text"
                    value={dlRejectReason}
                    onChange={(e) => setDlRejectReason(e.target.value)}
                    placeholder="e.g. Expired licence, unreadable scan, category mismatch"
                    className="text-xs bg-[#18181B] border-[rgba(255,255,255,0.1)] text-[#FAFAFA]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-zinc-300">Admin Ledger Notes (Optional)</Label>
                  <Input
                    type="text"
                    value={dlNotes}
                    onChange={(e) => setDlNotes(e.target.value)}
                    placeholder="Internal compliance review notes"
                    className="text-xs bg-[#18181B] border-[rgba(255,255,255,0.1)] text-[#FAFAFA]"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDL(null)}
                className="font-mono text-xs border-[rgba(255,255,255,0.12)] bg-[#18181B] text-zinc-300"
              >
                Close
              </Button>
              {selectedDL?.is_current && selectedDL.status === "pending" ? (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleReviewDL("rejected")}
                    disabled={isSubmittingDL}
                    className="font-mono text-xs bg-red-600 hover:bg-red-700 text-white font-bold"
                  >
                    Reject Licence
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleReviewDL("approved")}
                    disabled={isSubmittingDL}
                    className="font-mono text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    {isSubmittingDL ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <CheckCircle2 className="size-3.5 mr-1" />}
                    Approve Licence
                  </Button>
                </>
              ) : (
                <span className="text-xs text-zinc-500 font-mono self-center px-2">
                  Read-only: Submission is {selectedDL?.is_current ? selectedDL.status : "superseded / historical"}.
                </span>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AdminShell>
  )
}
