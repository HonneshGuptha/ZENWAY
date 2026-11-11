import * as React from "react"
import { motion } from "motion/react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import { AdminShell } from "@/components/admin/AdminShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Users,
  UserCheck,
  FileCheck2,
  KeyRound,
  Car,
  Activity,
  ArrowRight,
  RefreshCw,
  Lock,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"

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

export function AdminDashboardPage() {
  const { updateAdminAccessKey } = useAuth()
  const { navigate } = useRouter()

  const [stats, setStats] = React.useState<PlatformStats | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  // Change key state
  const [oldKey, setOldKey] = React.useState("")
  const [newKey, setNewKey] = React.useState("")
  const [confirmKey, setConfirmKey] = React.useState("")
  const [isUpdatingKey, setIsUpdatingKey] = React.useState(false)

  const fetchStats = React.useCallback(async () => {
    try {
      setIsLoading(true)

      // 1. First attempt dedicated RPC
      try {
        const { data, error } = await (supabase.rpc as any)("get_platform_statistics")
        if (!error && data && typeof data === "object") {
          const statsObj = data as unknown as PlatformStats
          // Verify it returned non-null counts
          if (typeof statsObj.total_users === "number" && (statsObj.total_users > 0 || statsObj.verified_students > 0)) {
            setStats(statsObj)
            return
          }
        }
      } catch (rpcErr) {
        console.warn("[AdminDashboard] get_platform_statistics RPC error:", rpcErr)
      }

      // 2. Resilient data queries using direct GET (avoids CORS Content-Range header restriction on HEAD requests)
      // Guarantees exact count updates when students register or are verified
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

      // Count students (including verified, pending, approved)
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
    } catch (err: any) {
      console.error("[AdminDashboard] Error fetching statistics:", err)
      toast.error(err.message || "Failed to load platform statistics")
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchStats()
  }, [fetchStats])

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Campus Operations Overview
            </h1>
            <p className="text-sm text-muted-foreground">
              Live exchange telemetry, registration queues, and security access controls.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={isLoading}
            className="gap-2 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh Telemetry</span>
          </Button>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Pending Registrations */}
          <Card className="border-border/80">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-medium text-muted-foreground">Pending Registrations</span>
              <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <UserCheck className="size-4" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? "—" : stats?.pending_registrations ?? 0}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Awaiting approval gate</p>
            </CardContent>
          </Card>

          {/* Pending ID Verifications */}
          <Card className="border-border/80">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-medium text-muted-foreground">Pending Student IDs</span>
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <FileCheck2 className="size-4" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? "—" : stats?.pending_verifications ?? 0}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">ID document submissions</p>
            </CardContent>
          </Card>

          {/* Total Campus Users */}
          <Card className="border-border/80">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-medium text-muted-foreground">Total Campus Users</span>
              <div className="p-1.5 rounded-md bg-muted text-muted-foreground">
                <Users className="size-4" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? "—" : stats?.total_users ?? 0}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {isLoading ? "—" : `${stats?.verified_students ?? 0} verified students`}
              </p>
            </CardContent>
          </Card>

          {/* Active Exchanges */}
          <Card className="border-border/80">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-medium text-muted-foreground">Active Rentals</span>
              <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Activity className="size-4" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? "—" : stats?.active_rentals ?? 0}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {isLoading ? "—" : `${stats?.available_vehicles ?? 0} vehicles listed`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Operational Queues & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-base font-semibold text-foreground">Action Queues</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Registration Queue Action */}
              <div
                onClick={() => navigate("/admin/registrations")}
                className="group p-5 rounded-xl border border-border/80 bg-card hover:border-primary/50 transition-all cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <UserCheck className="size-5" />
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    {stats?.pending_registrations ?? 0} Actionable
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                    <span>Registration Queue</span>
                    <ArrowRight className="size-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Review and authorize new student signups before login tokens can be issued.
                  </p>
                </div>
              </div>

              {/* ID Verification Queue Action */}
              <div
                onClick={() => navigate("/admin/verifications")}
                className="group p-5 rounded-xl border border-border/80 bg-card hover:border-primary/50 transition-all cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <FileCheck2 className="size-5" />
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                    {stats?.pending_verifications ?? 0} Pending
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                    <span>Student ID Documents</span>
                    <ArrowRight className="size-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Examine uploaded student IDs and enrollment documents to grant exchange privileges.
                  </p>
                </div>
              </div>

              {/* User Directory Action */}
              <div
                onClick={() => navigate("/admin/users")}
                className="group p-5 rounded-xl border border-border/80 bg-card hover:border-primary/50 transition-all cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
                    <Users className="size-5" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                    <span>User Directory & Suspension</span>
                    <ArrowRight className="size-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Manage student standing, view account history, and toggle account suspensions.
                  </p>
                </div>
              </div>

              {/* Listing Moderation Action */}
              <div
                onClick={() => navigate("/admin/moderation")}
                className="group p-5 rounded-xl border border-border/80 bg-card hover:border-primary/50 transition-all cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive">
                    <Car className="size-5" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                    <span>Content Moderation</span>
                    <ArrowRight className="size-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Moderate vehicle listings, active carpool schedules, and peer item transport requests.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Security: Access Key Rotation */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Lock className="size-4 text-primary" />
              <span>Admin Key Security</span>
            </h2>

            <Card className="border-border/80">
              <CardHeader className="p-4 pb-2 space-y-1">
                <CardTitle className="text-sm font-semibold">Rotate Admin Access Key</CardTitle>
                <CardDescription className="text-xs">
                  Change the server-side access key required to log into this portal. Default: <code className="font-mono font-bold text-foreground">2077</code>.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleUpdateKey}>
                <CardContent className="p-4 pt-2 space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="old-key" className="text-xs">Current Key</Label>
                    <Input
                      id="old-key"
                      type="password"
                      placeholder="Current access key"
                      value={oldKey}
                      onChange={(e) => setOldKey(e.target.value)}
                      disabled={isUpdatingKey}
                      className="h-8 text-xs font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-key" className="text-xs">New Access Key</Label>
                    <Input
                      id="new-key"
                      type="password"
                      placeholder="New access key"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      disabled={isUpdatingKey}
                      className="h-8 text-xs font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="confirm-key" className="text-xs">Confirm New Key</Label>
                    <Input
                      id="confirm-key"
                      type="password"
                      placeholder="Confirm new key"
                      value={confirmKey}
                      onChange={(e) => setConfirmKey(e.target.value)}
                      disabled={isUpdatingKey}
                      className="h-8 text-xs font-mono"
                      required
                    />
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isUpdatingKey}
                    className="w-full text-xs h-8 cursor-pointer gap-1.5"
                  >
                    {isUpdatingKey ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="size-3.5" />
                    )}
                    <span>Update Access Key</span>
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      </motion.div>
    </AdminShell>
  )
}
