import * as React from "react"
import { motion } from "motion/react"
import { supabase } from "@/lib/supabase"
import { AdminShell } from "@/components/admin/AdminShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FileText,
  Search,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  Code,
} from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"
import { formatReadableDateTime } from "@/utils/formatters"

interface AuditLogRecord {
  id: string
  action: string
  actor_id: string | null
  target_entity: string
  target_id: string
  details: any
  ip_address: string | null
  created_at: string
  actor?: {
    full_name: string | null
    role: string | null
  } | null
}

export function AdminReportsPage() {
  const [logs, setLogs] = React.useState<AuditLogRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedLogPayload, setSelectedLogPayload] = React.useState<AuditLogRecord | null>(null)
  const [hasCopied, setHasCopied] = React.useState(false)

  const handleCopyPayload = () => {
    if (!selectedLogPayload?.details) return
    navigator.clipboard.writeText(JSON.stringify(selectedLogPayload.details, null, 2))
    setHasCopied(true)
    toast.success("Audit payload JSON copied to clipboard")
    setTimeout(() => setHasCopied(false), 2000)
  }

  const fetchLogs = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("audit_logs")
        .select(`
          id, action, actor_id, target_entity, target_id, details, ip_address, created_at,
          actor:public_profiles!audit_logs_actor_id_fkey(full_name, role)
        `)
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error
      setLogs((data || []) as AuditLogRecord[])
    } catch (err: any) {
      console.error("[AdminReports] Fetch error:", err)
      toast.error(err.message || "Failed to load audit trail.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      log.action?.toLowerCase().includes(q) ||
      log.target_entity?.toLowerCase().includes(q) ||
      log.target_id?.toLowerCase().includes(q) ||
      JSON.stringify(log.details)?.toLowerCase().includes(q)
    )
  })

  return (
    <AdminShell currentSection="reports">
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
              Security Audit Trail & Compliance Reports
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Immutable cryptographic log of administrative decisions, security overrides, and key rotations.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={isLoading}
            className="gap-2 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Input
              type="search"
              placeholder="Search audit trail by action or entity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
            <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-2.5 pointer-events-none" />
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {filteredLogs.length} events logged
          </span>
        </div>

        {/* Logs Table */}
        {isLoading ? (
          <div className="min-h-[30vh] flex flex-col items-center justify-center space-y-3">
            <Loader2 className="size-7 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground font-mono">Loading audit logs...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-xl space-y-2 bg-muted/10">
            <FileText className="size-10 text-muted-foreground/50 mx-auto" />
            <h3 className="font-semibold text-sm text-foreground">No audit logs found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No security events match the current search filter.
            </p>
          </div>
        ) : (
          <div className="border border-border/80 rounded-xl overflow-hidden bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/80 bg-muted/40 font-medium text-muted-foreground">
                  <tr>
                    <th className="p-3 pl-4">Timestamp</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Target Entity</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3 pr-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                  {filteredLogs.map((log) => {
                    const detailKeys = log.details && typeof log.details === "object" ? Object.keys(log.details) : []
                    const summaryPreview = detailKeys.length > 0
                      ? detailKeys.slice(0, 3).map((k) => `${k}: ${String(log.details[k]).slice(0, 20)}`).join(" • ")
                      : JSON.stringify(log.details)

                    return (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 pl-4 whitespace-nowrap text-muted-foreground">
                          {formatReadableDateTime(log.created_at)}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                            {log.action}
                          </Badge>
                        </td>
                        <td className="p-3 text-foreground font-semibold">
                          {log.target_entity}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {log.actor?.full_name ? (
                            <div className="flex flex-col">
                              <span className="text-foreground font-semibold font-sans">{log.actor.full_name}</span>
                              <span className="text-[10px] font-mono text-primary uppercase">{log.actor.role || "admin"}</span>
                            </div>
                          ) : log.actor_id ? (
                            <span title={log.actor_id}>{`${log.actor_id.slice(0, 8)}...`}</span>
                          ) : (
                            <span className="text-zinc-500 italic">system</span>
                          )}
                        </td>
                        <td className="p-3 pr-4 max-w-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-muted-foreground text-[10px]" title={summaryPreview}>
                              {summaryPreview || "// No extra payload"}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedLogPayload(log)}
                              className="h-6 px-2 text-[10px] font-mono shrink-0 gap-1 cursor-pointer bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                              title="Expand full cryptographic audit payload"
                            >
                              <Code className="size-3 text-primary" />
                              <span>View Payload</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Full Audit Payload Inspection Modal */}
        <Dialog open={!!selectedLogPayload} onOpenChange={(open) => !open && setSelectedLogPayload(null)}>
          <DialogContent className="max-w-2xl bg-[#09090B] border-[rgba(255,255,255,0.15)] text-[#FAFAFA]">
            <DialogHeader>
              <DialogTitle className="text-sm font-mono uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                <FileText className="size-4 text-[#EA2E00]" />
                <span>AUDIT RECORD PAYLOAD INSPECTOR</span>
              </DialogTitle>
              <DialogDescription className="text-xs font-mono text-zinc-400">
                Action: <strong className="text-zinc-200">{selectedLogPayload?.action}</strong> • Entity: <strong className="text-zinc-200">{selectedLogPayload?.target_entity}</strong> ({selectedLogPayload?.target_id})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[#121215] border border-[rgba(255,255,255,0.08)] text-[11px]">
                <div>
                  <span className="text-zinc-500 block">EVENT ID:</span>
                  <span className="text-zinc-300 select-all">{selectedLogPayload?.id}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">TIMESTAMP:</span>
                  <span className="text-zinc-300">{formatReadableDateTime(selectedLogPayload?.created_at)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">ACTOR:</span>
                  <span className="text-zinc-300">
                    {selectedLogPayload?.actor?.full_name || selectedLogPayload?.actor_id || "system"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">IP / CLIENT:</span>
                  <span className="text-zinc-300">{selectedLogPayload?.ip_address || "internal_rpc"}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>RAW IMMUTABLE JSON PAYLOAD:</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyPayload}
                    className="h-6 px-2 text-[10px] text-zinc-300 hover:text-white cursor-pointer gap-1"
                  >
                    {hasCopied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                    <span>{hasCopied ? "Copied" : "Copy JSON"}</span>
                  </Button>
                </div>
                <pre className="p-3 rounded-lg bg-[#050507] border border-[rgba(255,255,255,0.1)] text-emerald-400 font-mono text-[11px] max-h-[300px] overflow-auto select-all leading-relaxed">
                  {JSON.stringify(selectedLogPayload?.details, null, 2)}
                </pre>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLogPayload(null)}
                className="text-xs font-mono border-[rgba(255,255,255,0.12)] bg-[#18181B] text-zinc-200"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AdminShell>
  )
}
