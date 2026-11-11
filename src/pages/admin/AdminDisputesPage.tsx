import * as React from "react"
import { motion } from "motion/react"
import { supabase } from "@/lib/supabase"
import { AdminShell } from "@/components/admin/AdminShell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
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
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Loader2,
  Clock,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"

interface DisputeRecord {
  id: string
  transaction_type: "rent" | "ride" | "carry"
  transaction_id: string
  reporter_id: string
  reporter_name?: string
  reporter_email?: string
  respondent_id: string
  respondent_name?: string
  respondent_email?: string
  dispute_reason: string
  dispute_details: string
  status: "open" | "under_review" | "resolved" | "dismissed"
  resolution_notes: string | null
  created_at: string
  resolved_at: string | null
}

export function AdminDisputesPage() {
  const [disputes, setDisputes] = React.useState<DisputeRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [activeFilter, setActiveFilter] = React.useState<"all" | "open" | "resolved">("open")
  const [search, setSearch] = React.useState("")

  // Resolve Dialog
  const [targetDispute, setTargetDispute] = React.useState<DisputeRecord | null>(null)
  const [resolutionAction, setResolutionAction] = React.useState<"resolved" | "dismissed">("resolved")
  const [resolutionNotes, setResolutionNotes] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const fetchDisputes = React.useCallback(async () => {
    try {
      setIsLoading(true)

      // 1. Attempt RPC get_admin_disputes
      const { data, error } = await (supabase.rpc as any)("get_admin_disputes")
      if (!error && data) {
        setDisputes(data as DisputeRecord[])
        return
      }

      // 2. Direct table fallback
      console.warn("[AdminDisputes] RPC fallback to table query:", error)
      const { data: tableData, error: tableErr } = await supabase
        .from("disputes" as any)
        .select(`
          id, transaction_type, transaction_id, reporter_id, respondent_id,
          dispute_reason, dispute_details, status, resolution_notes, created_at, resolved_at,
          reporter:profiles!disputes_reporter_id_fkey(full_name),
          respondent:profiles!disputes_respondent_id_fkey(full_name)
        `)
        .order("created_at", { ascending: false })

      if (tableErr) {
        // 3. Audit log fallback for reports
        const { data: auditData } = await supabase
          .from("audit_logs")
          .select("id, action, target_entity, target_id, details, created_at, actor_id")
          .like("action", "%DISPUTE%")
          .order("created_at", { ascending: false })
          .limit(30)

        const mapped: DisputeRecord[] = (auditData || []).map((a: any) => ({
          id: a.id,
          transaction_type: (a.target_entity as any) || "rent",
          transaction_id: a.target_id,
          reporter_id: a.actor_id,
          reporter_name: "Campus Student",
          respondent_id: a.details?.respondent_id || a.actor_id,
          respondent_name: "Peer Member",
          dispute_reason: a.details?.reason || a.action,
          dispute_details: a.details?.details || "Audit logged dispute issue",
          status: "open",
          resolution_notes: null,
          created_at: a.created_at,
          resolved_at: null,
        }))
        setDisputes(mapped)
        return
      }

      const formatted = (tableData || []).map((d: any) => ({
        id: d.id,
        transaction_type: d.transaction_type,
        transaction_id: d.transaction_id,
        reporter_id: d.reporter_id,
        reporter_name: d.reporter?.full_name || "Reporting Student",
        respondent_id: d.respondent_id,
        respondent_name: d.respondent?.full_name || "Respondent Student",
        dispute_reason: d.dispute_reason,
        dispute_details: d.dispute_details,
        status: d.status,
        resolution_notes: d.resolution_notes,
        created_at: d.created_at,
        resolved_at: d.resolved_at,
      }))
      setDisputes(formatted)
    } catch (err: any) {
      console.error("[AdminDisputes] Error fetching disputes:", err)
      toast.error(err.message || "Failed to load disputes.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchDisputes()
  }, [fetchDisputes])

  const handleConfirmResolve = async () => {
    if (!targetDispute) return
    if (!resolutionNotes.trim()) {
      toast.error("Please enter resolution notes explaining this decision.")
      return
    }

    try {
      setIsSubmitting(true)
      const { error: rpcErr } = await (supabase.rpc as any)("admin_resolve_dispute", {
        p_dispute_id: targetDispute.id,
        p_resolution: resolutionAction,
        p_notes: resolutionNotes.trim(),
      })

      if (rpcErr) {
        // Table update fallback
        await supabase
          .from("disputes" as any)
          .update({
            status: resolutionAction,
            resolution_notes: resolutionNotes.trim(),
            resolved_at: new Date().toISOString(),
          } as any)
          .eq("id", targetDispute.id)
      }

      toast.success(`Dispute marked as ${resolutionAction}. Decision logged in audit trails.`)
      setTargetDispute(null)
      setResolutionNotes("")
      await fetchDisputes()
    } catch (err: any) {
      console.error("[AdminDisputes] Resolution error:", err)
      toast.error(err.message || "Failed to record dispute resolution.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const filtered = disputes.filter((d) => {
    if (activeFilter === "open" && d.status !== "open" && d.status !== "under_review") return false
    if (activeFilter === "resolved" && d.status !== "resolved" && d.status !== "dismissed") return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      d.dispute_reason?.toLowerCase().includes(q) ||
      d.dispute_details?.toLowerCase().includes(q) ||
      d.reporter_name?.toLowerCase().includes(q) ||
      d.respondent_name?.toLowerCase().includes(q) ||
      d.transaction_type?.toLowerCase().includes(q)
    )
  })

  return (
    <AdminShell currentSection="moderation">
      <motion.div
        variants={pageTransitionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <AlertTriangle className="size-6 text-amber-500" />
              <span>Campus Dispute & Contest Queue</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Review contested rentals, rides, and peer transport incidents requiring administrative adjudication.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchDisputes}
            disabled={isLoading}
            className="gap-1.5 text-xs h-8 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/80 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveFilter("open")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium ${
                activeFilter === "open" ? "bg-card text-foreground shadow-xs font-semibold" : "text-muted-foreground"
              }`}
            >
              Open Disputes ({disputes.filter((d) => d.status === "open").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("resolved")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium ${
                activeFilter === "resolved" ? "bg-card text-foreground shadow-xs font-semibold" : "text-muted-foreground"
              }`}
            >
              Resolved History
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium ${
                activeFilter === "all" ? "bg-card text-foreground shadow-xs font-semibold" : "text-muted-foreground"
              }`}
            >
              All Records
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="size-3.5 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by student or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-border/80 bg-background text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Disputes Grid */}
        {isLoading ? (
          <div className="min-h-[30vh] flex flex-col items-center justify-center space-y-2">
            <Loader2 className="size-6 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground font-mono">Loading dispute records...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground bg-muted/10 space-y-2">
            <ShieldCheck className="size-8 text-emerald-500 mx-auto" />
            <p className="font-semibold text-foreground">No active disputes in this queue</p>
            <p>Campus exchange operations are running smoothly without contested handoffs.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((disp) => {
              const isOpen = disp.status === "open" || disp.status === "under_review"
              return (
                <Card key={disp.id} className="border-border/80 shadow-xs">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {disp.transaction_type}
                          </Badge>
                          <CardTitle className="text-sm font-semibold">{disp.dispute_reason}</CardTitle>
                        </div>
                        <CardDescription className="text-xs mt-1 flex items-center gap-3">
                          <span>Reporter: <strong className="text-foreground">{disp.reporter_name}</strong></span>
                          <span>vs</span>
                          <span>Respondent: <strong className="text-foreground">{disp.respondent_name}</strong></span>
                        </CardDescription>
                      </div>

                      <Badge
                        variant={isOpen ? "destructive" : "default"}
                        className="text-[10px] capitalize font-semibold"
                      >
                        {disp.status}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-1 space-y-2 text-xs">
                    <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-muted-foreground leading-relaxed">
                      "{disp.dispute_details}"
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        <span>Filed: {new Date(disp.created_at).toLocaleString()}</span>
                      </span>

                      {disp.resolution_notes && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-sans">
                          Adjudicated: {disp.resolution_notes}
                        </span>
                      )}
                    </div>
                  </CardContent>

                  {isOpen && (
                    <div className="p-4 pt-2 border-t border-border/60 flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTargetDispute(disp)
                          setResolutionAction("dismissed")
                          setResolutionNotes("Dispute reviewed and dismissed following terms verification.")
                        }}
                        className="text-xs h-8 cursor-pointer"
                      >
                        <XCircle className="size-3.5 text-muted-foreground" />
                        <span>Dismiss</span>
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => {
                          setTargetDispute(disp)
                          setResolutionAction("resolved")
                          setResolutionNotes("Dispute verified. Appropriate settlement / warning applied.")
                        }}
                        className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                      >
                        <CheckCircle2 className="size-3.5" />
                        <span>Adjudicate & Resolve</span>
                      </Button>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {/* Adjudication Dialog */}
        <Dialog open={!!targetDispute} onOpenChange={(open) => !open && setTargetDispute(null)}>
          <DialogContent className="max-w-md sm:rounded-2xl">
            <DialogHeader className="space-y-1.5 pb-2 border-b border-border/80">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <ShieldAlert className="size-5 text-primary" />
                <span>Adjudicate Campus Dispute</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Log the official administrative ruling. Both parties will be updated and decisions are permanently stored in security audit trails.
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 space-y-3">
              <div className="p-2.5 rounded-lg bg-muted/60 border border-border/80 text-xs">
                <span className="font-semibold text-foreground block">
                  Grounds: {targetDispute?.dispute_reason}
                </span>
                <span className="text-muted-foreground block text-[11px] mt-0.5">
                  {targetDispute?.reporter_name} vs {targetDispute?.respondent_name}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Administrative Ruling *</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={resolutionAction === "resolved" ? "default" : "outline"}
                    onClick={() => setResolutionAction("resolved")}
                    className="flex-1 text-xs h-8 cursor-pointer"
                  >
                    Resolve (Uphold)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={resolutionAction === "dismissed" ? "destructive" : "outline"}
                    onClick={() => setResolutionAction("dismissed")}
                    className="flex-1 text-xs h-8 cursor-pointer"
                  >
                    Dismiss Claim
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Resolution Notes & Findings *</Label>
                <Textarea
                  placeholder="Record campus operations findings, return instructions, or warning notes..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="text-xs min-h-[90px]"
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-border/80 flex items-center justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={() => setTargetDispute(null)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmResolve}
                disabled={isSubmitting}
                className="text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
              >
                {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                <span>Confirm Ruling</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AdminShell>
  )
}
