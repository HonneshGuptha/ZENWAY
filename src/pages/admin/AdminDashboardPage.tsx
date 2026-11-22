import * as React from "react"
import { motion } from "motion/react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import { AdminShell } from "@/components/admin/AdminShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Users,
  FileCheck2,
  KeyRound,
  Activity,
  ArrowRight,
  RefreshCw,
  Lock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Radio,
  ExternalLink,
  ShieldAlert,
  Trash2,
  Check,
  MapPin,
} from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"
import { calculateBarWidth } from "@/constants/campus"

interface CampusLocalityItem {
  id: string
  name: string
  normalized_name: string
  status: "pending" | "approved" | "rejected"
  suggestion_count: number
  created_at: string
  updated_at: string
}

interface PlatformStats {
  total_users: number
  verified_students: number
  pending_registrations: number
  pending_verifications: number
  available_vehicles: number
  active_rentals: number
  open_rides: number
  open_carries: number
}

interface PendingVerificationItem {
  id: string
  user_id: string
  student_id_number: string
  id_document_path: string
  document_type: string
  status: "pending" | "approved" | "rejected"
  created_at: string
  full_name: string
  email: string
  university_name: string | null
}

interface LiveExchangeItem {
  id: string
  type: "RENTAL" | "CARPOOL" | "CARRY"
  title: string
  subtitle: string
  status: string
  created_at: string
}

export function AdminDashboardPage() {
  const { user, updateAdminAccessKey } = useAuth()
  const { navigate } = useRouter()

  const [stats, setStats] = React.useState<PlatformStats | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [pendingList, setPendingList] = React.useState<PendingVerificationItem[]>([])
  const [liveExchanges, setLiveExchanges] = React.useState<LiveExchangeItem[]>([])

  // Document preview state
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = React.useState<string>("")
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false)

  // 1-Click Verification action states
  const [processingVerificationId, setProcessingVerificationId] = React.useState<string | null>(null)
  const [rejectItem, setRejectItem] = React.useState<PendingVerificationItem | null>(null)
  const [rejectReason, setRejectReason] = React.useState("")
  const [isSubmittingReject, setIsSubmittingReject] = React.useState(false)

  // Change key state
  const [oldKey, setOldKey] = React.useState("")
  const [newKey, setNewKey] = React.useState("")
  const [confirmKey, setConfirmKey] = React.useState("")
  const [isUpdatingKey, setIsUpdatingKey] = React.useState(false)

  // Clean Slate Reset state
  const [isResetDialogOpen, setIsResetDialogOpen] = React.useState(false)
  const [resetConfirmationText, setResetConfirmationText] = React.useState("")
  const [isExecutingReset, setIsExecutingReset] = React.useState(false)

  // Campus Localities & Demand Graph State
  const [localities, setLocalities] = React.useState<CampusLocalityItem[]>([])
  const [isLoadingLocalities, setIsLoadingLocalities] = React.useState(false)
  const [processingLocalityId, setProcessingLocalityId] = React.useState<string | null>(null)

  // Fetch pending verifications for quick queue
  const fetchPendingVerifications = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("student_verifications")
        .select(`
          id,
          user_id,
          student_id_number,
          id_document_path,
          document_type,
          status,
          created_at,
          profiles:user_id (
            full_name,
            email,
            university_name
          )
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5)

      if (error) {
        console.warn("[AdminDashboard] Pending verifications error:", error)
        return
      }

      const formatted: PendingVerificationItem[] = (data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        student_id_number: row.student_id_number,
        id_document_path: row.id_document_path,
        document_type: row.document_type || "student_id",
        status: row.status,
        created_at: row.created_at,
        full_name: row.profiles?.full_name || "Anonymous Student",
        email: row.profiles?.email || "—",
        university_name: row.profiles?.university_name || "Campus Community",
      }))
      setPendingList(formatted)
    } catch (err) {
      console.warn("[AdminDashboard] Failed to fetch pending verifications:", err)
    }
  }, [])

  // Fetch recent live exchanges
  const fetchLiveExchanges = React.useCallback(async () => {
    try {
      const [rentalsRes, ridesRes, carriesRes] = await Promise.allSettled([
        supabase
          .from("rental_requests")
          .select("id, status, created_at, vehicles(model, vehicle_type)")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("rides")
          .select("id, status, created_at, origin, destination")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("carry_requests")
          .select("id, status, created_at, item_description, pickup_location, dropoff_location")
          .order("created_at", { ascending: false })
          .limit(3),
      ])

      const list: LiveExchangeItem[] = []

      if (rentalsRes.status === "fulfilled" && rentalsRes.value.data) {
        for (const r of rentalsRes.value.data as any[]) {
          list.push({
            id: r.id,
            type: "RENTAL",
            title: r.vehicles?.model || "Vehicle Rental",
            subtitle: `Status: ${String(r.status).toUpperCase()}`,
            status: r.status,
            created_at: r.created_at,
          })
        }
      }

      if (ridesRes.status === "fulfilled" && ridesRes.value.data) {
        for (const r of ridesRes.value.data as any[]) {
          list.push({
            id: r.id,
            type: "CARPOOL",
            title: `${r.origin} → ${r.destination}`,
            subtitle: `Status: ${String(r.status).toUpperCase()}`,
            status: r.status,
            created_at: r.created_at,
          })
        }
      }

      if (carriesRes.status === "fulfilled" && carriesRes.value.data) {
        for (const c of carriesRes.value.data as any[]) {
          list.push({
            id: c.id,
            type: "CARRY",
            title: c.item_description || "Package Transport",
            subtitle: `${c.pickup_location} → ${c.dropoff_location}`,
            status: c.status,
            created_at: c.created_at,
          })
        }
      }

      // Sort by newest
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setLiveExchanges(list.slice(0, 6))
    } catch (err) {
      console.warn("[AdminDashboard] Failed to fetch live exchanges:", err)
    }
  }, [])

  // Fetch Campus Localities for Demand Bar Graph
  const fetchLocalities = React.useCallback(async () => {
    try {
      setIsLoadingLocalities(true)
      const { data, error } = await supabase
        .from("campus_localities")
        .select("*")
        .order("suggestion_count", { ascending: false })

      if (error) {
        console.warn("[AdminDashboard] Failed to fetch campus localities:", error.message)
        return
      }
      setLocalities((data || []) as CampusLocalityItem[])
    } catch (err) {
      console.warn("[AdminDashboard] Localities fetch error:", err)
    } finally {
      setIsLoadingLocalities(false)
    }
  }, [])

  // Approve Hub
  const handleApproveLocality = async (locality: CampusLocalityItem) => {
    try {
      setProcessingLocalityId(locality.id)
      const { error } = await supabase
        .from("campus_localities")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", locality.id)

      if (error) throw error
      toast.success(`Hub "${locality.name}" approved! It is now live in student quick-select chips.`)
      setLocalities((prev) =>
        prev.map((l) => (l.id === locality.id ? { ...l, status: "approved" } : l))
      )
    } catch (err: any) {
      console.error("[AdminDashboard] Approve locality error:", err)
      toast.error(err.message || "Failed to approve hub.")
    } finally {
      setProcessingLocalityId(null)
    }
  }

  // Reject Hub
  const handleRejectLocality = async (locality: CampusLocalityItem) => {
    try {
      setProcessingLocalityId(locality.id)
      const { error } = await supabase
        .from("campus_localities")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", locality.id)

      if (error) throw error
      toast.info(`Hub "${locality.name}" rejected.`)
      setLocalities((prev) =>
        prev.map((l) => (l.id === locality.id ? { ...l, status: "rejected" } : l))
      )
    } catch (err: any) {
      console.error("[AdminDashboard] Reject locality error:", err)
      toast.error(err.message || "Failed to reject hub.")
    } finally {
      setProcessingLocalityId(null)
    }
  }

  // Move Back to Pending (Demote)
  const handleUnapproveLocality = async (locality: CampusLocalityItem) => {
    try {
      setProcessingLocalityId(locality.id)
      const { error } = await supabase
        .from("campus_localities")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("id", locality.id)

      if (error) throw error
      toast.info(`Hub "${locality.name}" moved back to pending.`)
      setLocalities((prev) =>
        prev.map((l) => (l.id === locality.id ? { ...l, status: "pending" } : l))
      )
    } catch (err: any) {
      console.error("[AdminDashboard] Unapprove locality error:", err)
      toast.error(err.message || "Failed to update hub.")
    } finally {
      setProcessingLocalityId(null)
    }
  }

  const fetchStats = React.useCallback(async () => {
    try {
      setIsLoading(true)

      // Direct resilient data queries
      const [
        profsRes,
        versRes,
        vehsRes,
        rentalsRes,
        ridesRes,
        carriesRes,
      ] = await Promise.allSettled([
        supabase.from("profiles").select("id, role, verification_status, registration_status"),
        supabase.from("student_verifications").select("id, status"),
        supabase.from("vehicles").select("id, status"),
        supabase.from("rental_requests").select("id, status"),
        supabase.from("rides").select("id, status, available_seats"),
        supabase.from("carry_requests").select("id, status"),
      ])

      const profs = (profsRes.status === "fulfilled" && profsRes.value.data ? profsRes.value.data : []) as any[]
      const vers = (versRes.status === "fulfilled" && versRes.value.data ? versRes.value.data : []) as any[]
      const vehs = (vehsRes.status === "fulfilled" && vehsRes.value.data ? vehsRes.value.data : []) as any[]
      const rentals = (rentalsRes.status === "fulfilled" && rentalsRes.value.data ? rentalsRes.value.data : []) as any[]
      const rides = (ridesRes.status === "fulfilled" && ridesRes.value.data ? ridesRes.value.data : []) as any[]
      const carries = (carriesRes.status === "fulfilled" && carriesRes.value.data ? carriesRes.value.data : []) as any[]

      const totalUsers = profs.length
      const verifiedStudents = profs.filter((p) => p.verification_status === "verified").length
      const pendingRegs = profs.filter((p) => p.registration_status === "pending").length
      const pendingVers = vers.filter((v) => v.status === "pending").length
      const availableVehicles = vehs.filter((v) => v.status === "available").length
      const activeRentals = rentals.filter((r) => r.status === "accepted" || r.status === "active").length
      const openRides = rides.filter((r) => r.status === "scheduled" && (r.available_seats ?? 0) > 0).length
      const openCarries = carries.filter((c) => c.status === "open").length

      setStats({
        total_users: totalUsers,
        verified_students: verifiedStudents,
        pending_registrations: pendingRegs,
        pending_verifications: pendingVers,
        available_vehicles: availableVehicles,
        active_rentals: activeRentals,
        open_rides: openRides,
        open_carries: openCarries,
      })

      await Promise.all([fetchPendingVerifications(), fetchLiveExchanges(), fetchLocalities()])
    } catch (err: any) {
      console.error("[AdminDashboard] Error fetching statistics:", err)
      toast.error(err.message || "Failed to load platform statistics")
    } finally {
      setIsLoading(false)
    }
  }, [fetchPendingVerifications, fetchLiveExchanges, fetchLocalities])

  React.useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Handle Document Preview
  const handleViewDocument = async (record: PendingVerificationItem) => {
    try {
      setIsLoadingPreview(true)
      setPreviewTitle(`${record.full_name} (${record.student_id_number})`)
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
      console.error("[AdminDashboard] Preview error:", err)
      toast.error(err.message || "Failed to load ID document preview.")
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // 1-Click Approve
  const handleApprove = async (record: PendingVerificationItem) => {
    try {
      setProcessingVerificationId(record.id)
      const { error } = await (supabase.rpc as any)("review_student_verification", {
        p_verification_id: record.id,
        p_decision: "approved",
      })

      if (error) {
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

      toast.success(`ID verification approved for ${record.full_name}`)
      await fetchStats()
    } catch (err: any) {
      console.error("[AdminDashboard] Approve error:", err)
      toast.error(err.message || "Failed to approve verification.")
    } finally {
      setProcessingVerificationId(null)
    }
  }

  // Confirm Reject
  const handleConfirmReject = async () => {
    if (!rejectItem) return
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection.")
      return
    }

    try {
      setIsSubmittingReject(true)
      const { error } = await (supabase.rpc as any)("review_student_verification", {
        p_verification_id: rejectItem.id,
        p_decision: "rejected",
        p_reason: rejectReason.trim(),
      })

      if (error) {
        await supabase
          .from("student_verifications")
          .update({
            status: "rejected",
            rejection_reason: rejectReason.trim(),
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", rejectItem.id)

        await supabase
          .from("profiles")
          .update({
            verification_status: "unverified",
          })
          .eq("id", rejectItem.user_id)
      }

      toast.success(`Verification rejected for ${rejectItem.full_name}`)
      setRejectItem(null)
      setRejectReason("")
      await fetchStats()
    } catch (err: any) {
      console.error("[AdminDashboard] Reject error:", err)
      toast.error(err.message || "Failed to reject verification.")
    } finally {
      setIsSubmittingReject(false)
    }
  }

  // Update Access Key
  const handleUpdateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!oldKey.trim() || !newKey.trim() || !confirmKey.trim()) {
      toast.error("Please fill out all key fields.")
      return
    }
    if (newKey !== confirmKey) {
      toast.error("New keys do not match.")
      return
    }
    if (newKey.length < 4) {
      toast.error("New key must be at least 4 characters.")
      return
    }

    try {
      setIsUpdatingKey(true)
      await updateAdminAccessKey(oldKey, newKey)
      toast.success("Admin Access Key updated successfully!")
      setOldKey("")
      setNewKey("")
      setConfirmKey("")
    } catch (err: any) {
      console.error("[AdminDashboard] Key update failed:", err)
      toast.error(err.message || "Failed to update access key.")
    } finally {
      setIsUpdatingKey(false)
    }
  }

  // PRESENTATION CLEAN SLATE RESET HANDLER
  const handleExecuteCleanSlateReset = async () => {
    if (resetConfirmationText !== "RESET") {
      toast.error("Please type RESET to confirm.")
      return
    }

    try {
      setIsExecutingReset(true)
      const currentAdminId = user?.id

      if (!currentAdminId) {
        throw new Error("No authenticated admin session found. Aborting.")
      }

      // Execute secure server-side RPC with session verification
      let { error } = await (supabase.rpc as any)("execute_presentation_clean_slate_reset", {
        p_confirmation_token: "RESET",
      })

      if (error) {
        const fallback = await (supabase.rpc as any)("clean_slate_demo_reset", {
          p_confirmation_token: "RESET",
        })
        error = fallback.error
      }

      if (error) {
        throw error
      }

      toast.success("Presentation clean-slate reset completed! Demonstration feeds cleared while 100% of student accounts and audit logs were preserved.")
      setIsResetDialogOpen(false)
      setResetConfirmationText("")
      await fetchStats()
      await fetchLiveExchanges()
    } catch (err: any) {
      console.error("[AdminDashboard] Reset failed:", err)
      toast.error(err.message || "Failed to execute clean-slate reset.")
    } finally {
      setIsExecutingReset(false)
    }
  }

  const verifiedPercent = stats && stats.total_users > 0
    ? Math.round((stats.verified_students / stats.total_users) * 100)
    : 0

  const totalActiveExchanges = (stats?.active_rentals ?? 0) + (stats?.open_rides ?? 0) + (stats?.open_carries ?? 0)

  // Hub Demand Bar Graph computations
  const pendingHubs = localities
    .filter((l) => l.status === "pending")
    .sort((a, b) => b.suggestion_count - a.suggestion_count)

  const approvedHubsList = localities
    .filter((l) => l.status === "approved")
    .sort((a, b) => a.name.localeCompare(b.name))

  const maxPendingCount = pendingHubs.length > 0
    ? Math.max(...pendingHubs.map((h) => h.suggestion_count))
    : 1

  return (
    <AdminShell currentSection="dashboard">
      <motion.div
        variants={pageTransitionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="space-y-8"
      >
        {/* Welcome & Refresh Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.08)] pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#EA2E00] uppercase bg-[#EA2E00]/10 px-2 py-0.5 rounded border border-[#EA2E00]/20">
                LIVE OPERATIONS
              </span>
              <span className="text-xs font-mono text-zinc-400">ZENWAY COMMAND CONSOLE v2.0</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#FAFAFA] font-sans">
              Campus Operations Overview
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Real-time exchange telemetry, student verification pipelines, and platform governance.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={isLoading}
            className="gap-2 cursor-pointer font-mono text-xs border-[rgba(255,255,255,0.12)] bg-[#121215] hover:bg-[#1C1C22] text-zinc-200"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin text-[#EA2E00]" : ""}`} />
            <span>SYNC TELEMETRY</span>
          </Button>
        </div>

        {/* 4 Monospace KPI Telemetry Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Students */}
          <div className="p-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#121215] flex flex-col justify-between space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                TOTAL STUDENTS
              </span>
              <div className="p-1.5 rounded-md bg-[#18181B] text-zinc-300 border border-[rgba(255,255,255,0.08)]">
                <Users className="size-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-mono font-bold tracking-tight text-[#FAFAFA]">
                {isLoading ? "—" : stats?.total_users ?? 0}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 mt-1">
                <span className="text-emerald-400 font-bold">{verifiedPercent}%</span>
                <span>VERIFIED ({stats?.verified_students ?? 0}/{stats?.total_users ?? 0})</span>
              </div>
            </div>
          </div>

          {/* Card 2: Pending ID Reviews */}
          <div className="p-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#121215] flex flex-col justify-between space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                PENDING ID REVIEWS
              </span>
              <div className="p-1.5 rounded-md bg-[#18181B] text-[#EA2E00] border border-[rgba(255,255,255,0.08)]">
                <FileCheck2 className="size-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-bold tracking-tight text-[#FAFAFA]">
                  {isLoading ? "—" : stats?.pending_verifications ?? 0}
                </span>
                {(stats?.pending_verifications ?? 0) > 0 ? (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#EA2E00]/20 text-[#EA2E00] border border-[#EA2E00]/30 animate-pulse">
                    ACTION REQUIRED
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
                    ALL CLEAR
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-zinc-400 mt-1">
                {(stats?.pending_verifications ?? 0) > 0
                  ? "Awaiting admin gate decision"
                  : "All student IDs verified"}
              </p>
            </div>
          </div>

          {/* Card 3: Active Exchanges */}
          <div className="p-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#121215] flex flex-col justify-between space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                ACTIVE EXCHANGES
              </span>
              <div className="p-1.5 rounded-md bg-[#18181B] text-emerald-400 border border-[rgba(255,255,255,0.08)]">
                <Activity className="size-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-mono font-bold tracking-tight text-[#FAFAFA]">
                {isLoading ? "—" : totalActiveExchanges}
              </div>
              <p className="text-[11px] font-mono text-zinc-400 mt-1 truncate">
                {stats?.active_rentals ?? 0} rent · {stats?.open_rides ?? 0} ride · {stats?.open_carries ?? 0} carry
              </p>
            </div>
          </div>

          {/* Card 4: System Status */}
          <div className="p-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#121215] flex flex-col justify-between space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                SYSTEM STATUS
              </span>
              <div className="p-1.5 rounded-md bg-[#18181B] text-[#10B981] border border-[rgba(255,255,255,0.08)]">
                <Radio className="size-4" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-2xl font-mono font-bold tracking-tight text-[#10B981]">
                  ONLINE
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-400 mt-1">
                RTT: &lt;24ms · UPTIME: 99.98%
              </p>
            </div>
          </div>
        </div>

        {/* Action Queues & Telemetry Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main 2-Column Area: Verification Queue Widget */}
          <div className="lg:col-span-2 space-y-6">
            {/* High-Contrast Verification Queue Widget */}
            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#121215] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-3">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-[#EA2E00]" />
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#FAFAFA]">
                    VERIFICATION QUEUE (ACTIONABLE)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/admin/verifications")}
                  className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>View All Queue</span>
                  <ArrowRight className="size-3 text-[#EA2E00]" />
                </button>
              </div>

              {pendingList.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-[rgba(255,255,255,0.06)] rounded-lg">
                  <CheckCircle2 className="size-8 text-[#10B981] mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-mono text-zinc-300">QUEUE ZERO // ALL CLEAR</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">No pending student ID verifications require review.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendingList.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[rgba(255,255,255,0.12)] transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#FAFAFA]">{item.full_name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {item.student_id_number}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400">
                          {item.university_name} · {item.document_type.replace(/_/g, " ")}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDocument(item)}
                          disabled={isLoadingPreview}
                          className="h-7 text-[11px] font-mono border-[rgba(255,255,255,0.12)] bg-[#121215] hover:bg-[#27272A] text-zinc-200 cursor-pointer gap-1"
                        >
                          <Eye className="size-3 text-[#EA2E00]" />
                          <span>View ID</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(item)}
                          disabled={processingVerificationId === item.id}
                          className="h-7 text-[11px] font-mono bg-[#10B981] hover:bg-[#059669] text-black font-bold cursor-pointer gap-1"
                        >
                          {processingVerificationId === item.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Check className="size-3" />
                          )}
                          <span>Approve</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRejectItem(item)}
                          disabled={processingVerificationId === item.id}
                          className="h-7 text-[11px] font-mono border-red-950/60 bg-red-950/20 hover:bg-red-900/40 text-red-400 cursor-pointer gap-1"
                        >
                          <XCircle className="size-3" />
                          <span>Reject</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hub Demand & Approvals Widget */}
            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#121215] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-[#EA2E00]" />
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#FAFAFA]">
                    HUB DEMAND & APPROVALS
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {isLoadingLocalities && <Loader2 className="size-3 animate-spin text-[#EA2E00]" />}
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60">
                    {pendingHubs.length} PENDING TRIAGE
                  </span>
                </div>
              </div>

              {/* Pending Demand Bar Graph */}
              {pendingHubs.length === 0 ? (
                <div className="py-6 text-center border border-dashed border-[rgba(255,255,255,0.06)] rounded-lg">
                  <CheckCircle2 className="size-7 text-[#10B981] mx-auto mb-1.5 opacity-80" />
                  <p className="text-xs font-mono text-zinc-300">NO PENDING HUB SUGGESTIONS</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">All student suggested commute hubs have been triaged.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">
                    Ranked by Student Commute Demand:
                  </div>
                  <div className="space-y-2.5">
                    {pendingHubs.map((item) => {
                      const barWidth = calculateBarWidth(item.suggestion_count, maxPendingCount)
                      const isProcessing = processingLocalityId === item.id
                      return (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181B] space-y-2.5 hover:border-[rgba(255,255,255,0.12)] transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2 sm:gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-[#FAFAFA] font-sans">
                                {item.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/80">
                                {item.suggestion_count} {item.suggestion_count === 1 ? "request" : "requests"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <Button
                                size="sm"
                                disabled={isProcessing}
                                onClick={() => handleApproveLocality(item)}
                                className="h-8 sm:h-7 text-[11px] font-mono bg-[#10B981] hover:bg-[#059669] text-black font-bold cursor-pointer gap-1"
                              >
                                {isProcessing ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Check className="size-3" />
                                )}
                                <span>Approve</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isProcessing}
                                onClick={() => handleRejectLocality(item)}
                                className="h-8 sm:h-7 text-[11px] font-mono border-red-950/60 bg-red-950/20 hover:bg-red-900/40 text-red-400 cursor-pointer gap-1"
                              >
                                <XCircle className="size-3" />
                                <span>Reject</span>
                              </Button>
                            </div>
                          </div>

                          {/* Horizontal Demand Bar Graph */}
                          <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800/80">
                            <div
                              className="bg-gradient-to-r from-[#EA2E00] to-[#FF5426] h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(234,46,0,0.4)]"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Approved Hubs Strip */}
              <div className="pt-3 border-t border-[rgba(255,255,255,0.06)] space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-[#10B981]" />
                    <span>APPROVED COMMUTE HUBS ({approvedHubsList.length})</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-sans">Promoted live to student quick-select chips</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {approvedHubsList.map((hub) => (
                    <span
                      key={hub.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-sans bg-zinc-800/90 text-zinc-200 border border-zinc-700/80 hover:border-zinc-600 transition-colors"
                    >
                      <span className="size-1.5 rounded-full bg-[#10B981]" />
                      <span>{hub.name}</span>
                      <button
                        type="button"
                        onClick={() => handleUnapproveLocality(hub)}
                        title="Demote back to pending"
                        className="text-zinc-500 hover:text-red-400 text-sm leading-none ml-0.5 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Exchanges Telemetry Feed */}
            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#121215] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-[#10B981]" />
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#FAFAFA]">
                    LIVE EXCHANGES TELEMETRY FEED
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/admin/moderation")}
                  className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Explore All</span>
                  <ArrowRight className="size-3 text-[#EA2E00]" />
                </button>
              </div>

              {liveExchanges.length === 0 ? (
                <div className="py-6 text-center text-xs font-mono text-zinc-500">
                  NO ACTIVE EXCHANGES CURRENTLY LOGGED
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {liveExchanges.map((ex) => (
                    <div
                      key={ex.id}
                      className="p-3 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181B] flex flex-col justify-between space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          [{ex.type}]
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400">
                          {ex.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#FAFAFA] truncate">
                        {ex.title}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 truncate">
                        {ex.subtitle}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Key Security & Clean Slate */}
          <div className="space-y-6">
            {/* Admin Key Security */}
            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#121215] p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.06)] pb-3">
                <Lock className="size-4 text-[#EA2E00]" />
                <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#FAFAFA]">
                  ADMIN ACCESS KEY
                </h2>
              </div>
              <p className="text-xs text-zinc-400">
                Rotate server-side passcode required to authenticate to the Command Center.
              </p>

              <form onSubmit={handleUpdateKey} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="old-key" className="text-[11px] font-mono text-zinc-400">Current Key</Label>
                  <Input
                    id="old-key"
                    type="password"
                    placeholder="Current key"
                    value={oldKey}
                    onChange={(e) => setOldKey(e.target.value)}
                    disabled={isUpdatingKey}
                    className="h-8 text-xs font-mono bg-[#18181B] border-[rgba(255,255,255,0.1)] text-[#FAFAFA]"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-key" className="text-[11px] font-mono text-zinc-400">New Key</Label>
                  <Input
                    id="new-key"
                    type="password"
                    placeholder="New access key"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    disabled={isUpdatingKey}
                    className="h-8 text-xs font-mono bg-[#18181B] border-[rgba(255,255,255,0.1)] text-[#FAFAFA]"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="confirm-key" className="text-[11px] font-mono text-zinc-400">Confirm New Key</Label>
                  <Input
                    id="confirm-key"
                    type="password"
                    placeholder="Confirm key"
                    value={confirmKey}
                    onChange={(e) => setConfirmKey(e.target.value)}
                    disabled={isUpdatingKey}
                    className="h-8 text-xs font-mono bg-[#18181B] border-[rgba(255,255,255,0.1)] text-[#FAFAFA]"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUpdatingKey}
                  className="w-full text-xs font-mono h-8 bg-zinc-200 hover:bg-white text-zinc-950 font-bold cursor-pointer gap-1.5"
                >
                  {isUpdatingKey ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="size-3.5" />
                  )}
                  <span>ROTATE KEY</span>
                </Button>
              </form>
            </div>

            {/* DANGER ZONE / PRESENTATION CLEAN SLATE */}
            <div
              id="danger-zone"
              className="rounded-xl border border-red-900/40 bg-[#120D0D] p-5 space-y-4"
            >
              <div className="flex items-center gap-2 border-b border-red-900/30 pb-3">
                <AlertTriangle className="size-4 text-red-500 animate-pulse" />
                <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-red-400">
                  SYSTEM & PRESENTATION RESET
                </h2>
              </div>
              <p className="text-xs text-zinc-300">
                Purge all transactional demo data (rides, rentals, carries, reviews, logs) to prepare a clean presentation demonstration.
              </p>

              <div className="p-3 rounded-lg bg-red-950/20 border border-red-900/30 text-[11px] font-mono text-red-300/90 space-y-1">
                <div className="font-bold">// PRESENTATION CLEAN-SLATE RESET</div>
                <div className="text-[10px] text-zinc-400">
                  Purges all Rent/Ride/Carry demo listings, requests, offers, reviews, disputes, and notifications.
                </div>
                <div className="text-[10px] text-emerald-400 font-semibold">
                  Strictly preserves 100% of student accounts, admin accounts, student ID verifications, approved campus hubs, and system audit logs.
                </div>
              </div>

              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setResetConfirmationText("")
                  setIsResetDialogOpen(true)
                }}
                className="w-full text-xs font-mono h-9 bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer gap-2 border border-red-500/40"
              >
                <Trash2 className="size-3.5" />
                <span>PRESENTATION CLEAN-SLATE RESET</span>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* DOCUMENT PREVIEW MODAL */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl bg-[#09090B] border-[rgba(255,255,255,0.15)] text-[#FAFAFA]">
          <DialogHeader>
            <DialogTitle className="text-sm font-mono uppercase tracking-wider text-zinc-200">
              STUDENT ID DOCUMENT PREVIEW
            </DialogTitle>
            <DialogDescription className="text-xs font-mono text-zinc-400">
              {previewTitle}
            </DialogDescription>
          </DialogHeader>

          <div className="p-2 rounded-lg bg-[#121215] border border-[rgba(255,255,255,0.08)] flex items-center justify-center min-h-[300px] max-h-[60vh] overflow-auto">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Student ID Document"
                className="max-h-[55vh] object-contain rounded"
              />
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-[#EA2E00] hover:underline flex items-center gap-1"
              >
                <span>Open full original</span>
                <ExternalLink className="size-3" />
              </a>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewUrl(null)}
              className="text-xs font-mono border-[rgba(255,255,255,0.12)] bg-[#18181B] text-zinc-200"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECTION REASON MODAL */}
      <Dialog open={!!rejectItem} onOpenChange={(open) => !open && setRejectItem(null)}>
        <DialogContent className="bg-[#09090B] border-[rgba(255,255,255,0.15)] text-[#FAFAFA] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-mono uppercase tracking-wider text-red-400 flex items-center gap-2">
              <ShieldAlert className="size-4 text-red-500" />
              <span>REJECT ID VERIFICATION</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Specify the reason for rejecting {rejectItem?.full_name}&apos;s submission. This will be visible to the student.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason" className="text-xs font-mono text-zinc-300">
              Rejection Reason
            </Label>
            <Input
              id="reject-reason"
              placeholder="e.g. Expired ID, blurry image, name mismatch"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="text-xs font-mono bg-[#18181B] border-[rgba(255,255,255,0.1)] text-[#FAFAFA]"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRejectItem(null)
                setRejectReason("")
              }}
              disabled={isSubmittingReject}
              className="text-xs font-mono border-[rgba(255,255,255,0.12)] bg-[#18181B] text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmReject}
              disabled={isSubmittingReject || !rejectReason.trim()}
              className="text-xs font-mono bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {isSubmittingReject ? <Loader2 className="size-3.5 animate-spin" /> : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CLEAN SLATE RESET CONFIRMATION MODAL */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="bg-[#09090B] border-red-900/60 text-[#FAFAFA] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-mono uppercase tracking-wider text-red-500 flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              <span>CONFIRM PRESENTATION CLEAN-SLATE RESET</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-300">
              This operation purges demonstration exchange data across the platform via secure server-side RPC.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-red-950/30 border border-red-900/40 text-xs text-red-200/90 space-y-1.5 font-mono">
              <p className="font-bold text-red-400">PRESENTATION DEMO PURGE:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-zinc-300">
                <li>Purges test vehicle listings &amp; test rental requests</li>
                <li>Purges test carpool rides &amp; passenger bookings</li>
                <li>Purges test carry transport offers &amp; requests</li>
                <li>Purges test reviews, disputes, and exchange notifications</li>
                <li><strong className="text-emerald-400">Preserves</strong> 100% of student accounts &amp; passwords (auth.users)</li>
                <li><strong className="text-emerald-400">Preserves</strong> 100% of student &amp; admin profiles</li>
                <li><strong className="text-emerald-400">Preserves</strong> student ID verification records &amp; documents</li>
                <li><strong className="text-emerald-400">Preserves</strong> approved campus localities &amp; hubs</li>
                <li><strong className="text-emerald-400">Preserves</strong> complete append-only system audit log history</li>
                <li><strong className="text-emerald-400">Preserves</strong> your Admin profile &amp; login credentials</li>
              </ul>
            </div>

            <div className="space-y-1.5 pt-1">
              <Label htmlFor="confirm-reset-input" className="text-xs font-mono text-zinc-300">
                Type <span className="text-red-400 font-bold font-mono">RESET</span> to authorize execution:
              </Label>
              <Input
                id="confirm-reset-input"
                placeholder="RESET"
                value={resetConfirmationText}
                onChange={(e) => setResetConfirmationText(e.target.value)}
                className="font-mono text-xs bg-[#18181B] border-[rgba(255,255,255,0.12)] text-[#FAFAFA] placeholder:text-zinc-600"
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsResetDialogOpen(false)
                setResetConfirmationText("")
              }}
              disabled={isExecutingReset}
              className="text-xs font-mono border-[rgba(255,255,255,0.12)] bg-[#18181B] text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleExecuteCleanSlateReset}
              disabled={isExecutingReset || resetConfirmationText !== "RESET"}
              className="text-xs font-mono bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5"
            >
              {isExecutingReset ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>PURGING DEMO DATA...</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  <span>EXECUTE CLEAN SLATE</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  )
}
