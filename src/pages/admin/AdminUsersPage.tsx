import * as React from "react"
import { motion } from "motion/react"
import { supabase } from "@/lib/supabase"
import { AdminShell } from "@/components/admin/AdminShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Search,
  RefreshCw,
  ShieldCheck,
  UserX,
  UserCheck,
  GraduationCap,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"

interface AdminUserRecord {
  id: string
  full_name: string
  email: string
  university_name: string | null
  role: "student" | "admin"
  verification_status: "unverified" | "pending" | "verified" | "suspended"
  registration_status: "pending" | "approved" | "rejected"
  created_at: string
}

export function AdminUsersPage() {
  const [users, setUsers] = React.useState<AdminUserRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")

  // Suspension Modal State
  const [suspendTarget, setSuspendTarget] = React.useState<AdminUserRecord | null>(null)
  const [suspendReason, setSuspendReason] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const fetchUsers = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await (supabase.rpc as any)("get_admin_users")
      if (!error && data) {
        setUsers((data || []) as AdminUserRecord[])
        return
      }

      console.warn("[AdminUsers] get_admin_users RPC fallback to profiles query:", error)
      const { data: profs, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, university_name, role, verification_status, registration_status, created_at, updated_at")
        .order("created_at", { ascending: false })

      if (profErr) throw profErr

      setUsers(
        (profs || []).map((p: any) => ({
          ...p,
          email: "Enrolled Campus User",
        }))
      )
    } catch (err: any) {
      console.error("[AdminUsers] Error loading user directory:", err)
      toast.error(err.message || "Failed to load user directory.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleToggleSuspension = async () => {
    if (!suspendTarget) return
    const isSuspending = suspendTarget.verification_status !== "suspended"

    if (isSuspending && !suspendReason.trim()) {
      toast.error("Please enter a reason for suspending this user.")
      return
    }

    try {
      setIsSubmitting(true)
      const { error } = await (supabase.rpc as any)("toggle_user_suspension", {
        p_user_id: suspendTarget.id,
        p_suspend: isSuspending,
        p_reason: isSuspending ? suspendReason.trim() : null,
      })

      if (error) {
        console.warn("[AdminUsers] toggle_user_suspension RPC fallback to direct update:", error)
        const nextStatus = isSuspending ? "suspended" : "verified"
        const { error: updErr } = await supabase
          .from("profiles")
          .update({
            verification_status: nextStatus as any,
          })
          .eq("id", suspendTarget.id)

        if (updErr) throw updErr
      }

      toast.success(
        isSuspending
          ? `User ${suspendTarget.full_name} has been suspended.`
          : `User ${suspendTarget.full_name} privileges reinstated.`
      )
      setSuspendTarget(null)
      setSuspendReason("")
      await fetchUsers()
    } catch (err: any) {
      console.error("[AdminUsers] Suspension toggle error:", err)
      toast.error(err.message || "Failed to update user standing.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch =
      !q ||
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.university_name?.toLowerCase().includes(q)

    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "suspended"
        ? u.verification_status === "suspended"
        : statusFilter === "verified"
        ? u.verification_status === "verified"
        : statusFilter === "admin"
        ? u.role === "admin"
        : true

    return matchesSearch && matchesStatus
  })

  return (
    <AdminShell currentSection="users">
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
              Campus User Directory & Standing
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Inspect user roles, registration states, and manage account disciplinary actions.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsers}
            disabled={isLoading}
            className="gap-2 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
            {[
              { id: "all", label: "All Users" },
              { id: "verified", label: "Verified" },
              { id: "suspended", label: "Suspended" },
              { id: "admin", label: "Admins" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Input
              type="search"
              placeholder="Search by student, email, or campus..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
            <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Users Table / Grid */}
        {isLoading ? (
          <div className="min-h-[30vh] flex flex-col items-center justify-center space-y-3">
            <Loader2 className="size-7 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground font-mono">Loading user directory...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-xl space-y-2 bg-muted/10">
            <Users className="size-10 text-muted-foreground/50 mx-auto" />
            <h3 className="font-semibold text-sm text-foreground">No users found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No campus users match the current search criteria or filter.
            </p>
          </div>
        ) : (
          <div className="border border-border/80 rounded-xl overflow-hidden bg-card shadow-xs">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/80 bg-muted/40 font-medium text-muted-foreground">
                  <tr>
                    <th className="p-3 pl-4">User</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Registration</th>
                    <th className="p-3">Verification</th>
                    <th className="p-3">Joined</th>
                    <th className="p-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredUsers.map((u) => {
                    const isSuspended = u.verification_status === "suspended"
                    const isVerified = u.verification_status === "verified"
                    const isPending = u.verification_status === "pending"
                    const isAdmin = u.role === "admin"

                    return (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 pl-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground text-sm">
                              {u.full_name}
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {u.email}
                            </span>
                            {u.university_name && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <GraduationCap className="size-3" />
                                <span>{u.university_name}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-3">
                          {isAdmin ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-zinc-800 text-zinc-200 border border-zinc-700">
                              ADMIN
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase text-muted-foreground bg-muted/60">
                              STUDENT
                            </span>
                          )}
                        </td>

                        <td className="p-3">
                          {u.registration_status === "approved" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              approved
                            </span>
                          ) : u.registration_status === "pending" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              pending
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                              {u.registration_status}
                            </span>
                          )}
                        </td>

                        <td className="p-3">
                          {isVerified ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              verified
                            </span>
                          ) : isPending ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              pending
                            </span>
                          ) : isSuspended ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                              suspended
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium text-muted-foreground bg-muted/50 border border-border/50">
                              {u.verification_status}
                            </span>
                          )}
                        </td>

                        <td className="p-3 font-mono text-[11px] text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>

                        <td className="p-3 pr-4 text-right">
                          {!isAdmin && (
                            <Button
                              variant={isSuspended ? "outline" : "destructive"}
                              size="sm"
                              onClick={() => {
                                setSuspendTarget(u)
                                setSuspendReason("")
                              }}
                              className="text-[11px] h-7 px-2.5 cursor-pointer gap-1"
                            >
                              {isSuspended ? (
                                <>
                                  <UserCheck className="size-3" />
                                  <span>Reinstate</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="size-3" />
                                  <span>Suspend</span>
                                </>
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (No horizontal clipping on 390px) */}
            <div className="md:hidden divide-y divide-border/60">
              {filteredUsers.map((u) => {
                const isSuspended = u.verification_status === "suspended"
                const isVerified = u.verification_status === "verified"
                const isPending = u.verification_status === "pending"
                const isAdmin = u.role === "admin"

                return (
                  <div key={u.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground text-sm">{u.full_name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">{u.email}</p>
                      </div>
                      {isAdmin ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-zinc-800 text-zinc-200 border border-zinc-700">
                          ADMIN
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono text-muted-foreground bg-muted/60">
                          STUDENT
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-[11px] text-muted-foreground">Reg:</span>
                      {u.registration_status === "approved" ? (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400">approved</span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400">{u.registration_status}</span>
                      )}

                      <span className="text-[11px] text-muted-foreground ml-2">ID:</span>
                      {isVerified ? (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400">verified</span>
                      ) : isPending ? (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400">pending</span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-red-500/10 text-red-400">{u.verification_status}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                      <span className="font-mono text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </span>
                      {!isAdmin && (
                        <Button
                          variant={isSuspended ? "outline" : "destructive"}
                          size="sm"
                          onClick={() => {
                            setSuspendTarget(u)
                            setSuspendReason("")
                          }}
                          className="text-[11px] h-7 px-2.5 cursor-pointer"
                        >
                          {isSuspended ? "Reinstate" : "Suspend"}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Suspension / Reinstatement Confirmation Dialog */}
        <Dialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                {suspendTarget?.verification_status === "suspended" ? (
                  <>
                    <ShieldCheck className="size-4 text-emerald-600" />
                    <span>Reinstate User Privileges</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="size-4 text-destructive" />
                    <span className="text-destructive">Suspend Campus Account</span>
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {suspendTarget?.verification_status === "suspended"
                  ? `Reinstating ${suspendTarget?.full_name} will restore access to RENT, RIDE, and CARRY features.`
                  : `Suspending ${suspendTarget?.full_name} blocks all exchange bookings and listing actions.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="p-2.5 rounded-lg bg-muted text-xs space-y-0.5">
                <p className="font-semibold text-foreground">{suspendTarget?.full_name}</p>
                <p className="font-mono text-muted-foreground">{suspendTarget?.email}</p>
              </div>

              {suspendTarget?.verification_status !== "suspended" && (
                <div className="space-y-1.5">
                  <Label htmlFor="suspend-reason" className="text-xs font-medium">
                    Suspension Reason (Logged to Audit Trail)
                  </Label>
                  <Textarea
                    id="suspend-reason"
                    placeholder="e.g. Repeated violation of campus vehicle return policy or safety rules."
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    disabled={isSubmitting}
                    className="text-xs min-h-[80px]"
                    required
                  />
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSuspendTarget(null)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant={suspendTarget?.verification_status === "suspended" ? "default" : "destructive"}
                size="sm"
                onClick={handleToggleSuspension}
                disabled={
                  isSubmitting ||
                  (suspendTarget?.verification_status !== "suspended" && !suspendReason.trim())
                }
              >
                {isSubmitting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : suspendTarget?.verification_status === "suspended" ? (
                  <span>Confirm Reinstatement</span>
                ) : (
                  <span>Confirm Suspension</span>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AdminShell>
  )
}
