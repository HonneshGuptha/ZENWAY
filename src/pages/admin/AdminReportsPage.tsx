import * as React from "react"
import { motion } from "motion/react"
import { supabase } from "@/lib/supabase"
import { AdminShell } from "@/components/admin/AdminShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Search,
  RefreshCw,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"

interface AuditLogRecord {
  id: string
  action: string
  actor_id: string | null
  target_entity: string
  target_id: string
  details: any
  ip_address: string | null
  created_at: string
}

export function AdminReportsPage() {
  const [logs, setLogs] = React.useState<AuditLogRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")

  const fetchLogs = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, actor_id, target_entity, target_id, details, ip_address, created_at")
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
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 pl-4 whitespace-nowrap text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
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
                        {log.actor_id ? `${log.actor_id.slice(0, 8)}...` : "system"}
                      </td>
                      <td className="p-3 pr-4 max-w-xs truncate text-muted-foreground">
                        <span title={JSON.stringify(log.details, null, 2)}>
                          {JSON.stringify(log.details)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </AdminShell>
  )
}
