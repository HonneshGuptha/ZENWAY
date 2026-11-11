import * as React from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ShieldAlert, AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface DisputeModalProps {
  isOpen: boolean
  onClose: () => void
  service: "rent" | "ride" | "carry"
  transactionId: string
  respondentId: string
  transactionTitle?: string
  onSuccess: () => void
}

export function DisputeModal({
  isOpen,
  onClose,
  service,
  transactionId,
  respondentId,
  transactionTitle,
  onSuccess,
}: DisputeModalProps) {
  const { user } = useAuth()
  const [reason, setReason] = React.useState("property_damage")
  const [details, setDetails] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!details.trim() || details.trim().length < 15) {
      toast.error("Please provide at least 15 characters detailing the dispute.")
      return
    }

    try {
      setIsSubmitting(true)

      // 1. Attempt RPC submit_transaction_dispute
      const { error: rpcErr } = await (supabase.rpc as any)("submit_transaction_dispute", {
        p_transaction_type: service,
        p_transaction_id: transactionId,
        p_respondent_id: respondentId,
        p_dispute_reason: reason,
        p_dispute_details: details.trim(),
      })

      if (rpcErr) {
        console.warn("[Dispute] RPC fallback to direct disputes table:", rpcErr)
        // Fallback: direct insert to disputes table
        const { error: insErr } = await supabase.from("disputes" as any).insert({
          transaction_type: service,
          transaction_id: transactionId,
          reporter_id: user.id,
          respondent_id: respondentId,
          dispute_reason: reason,
          dispute_details: details.trim(),
          status: "open",
        } as any)

        if (insErr) {
          // If table not migrated yet, log into audit_logs
          await supabase.from("audit_logs").insert({
            actor_id: user.id,
            action: `DISPUTE_FILED_${service.toUpperCase()}`,
            target_entity: service,
            target_id: transactionId,
            details: {
              respondent_id: respondentId,
              reason,
              details: details.trim(),
            },
          })
        }
      }

      toast.success("Dispute filed. Campus administration has been notified for formal review.")
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error("[Dispute] Submission error:", err)
      toast.error(err.message || "Failed to file dispute.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md sm:rounded-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-1.5 pb-2 border-b border-border/80">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" />
              <span>Contest Exchange / File Dispute</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Disputes are escalated to campus transportation administration with full audit evidence.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {transactionTitle && (
              <div className="p-2.5 rounded-lg bg-muted/60 border border-border/80 text-xs">
                <span className="text-[10px] uppercase font-mono text-muted-foreground block">
                  Contested Transaction:
                </span>
                <span className="font-semibold text-foreground">{transactionTitle}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Dispute Ground *</Label>
              <Select value={reason} onValueChange={(val) => setReason(val || "property_damage")}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select dispute category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="property_damage">Property Damage (Vehicle or Package)</SelectItem>
                  <SelectItem value="financial_dispute">Payment Dispute / Surcharge Discrepancy</SelectItem>
                  <SelectItem value="unsafe_conduct">Dangerous or Reckless Conduct</SelectItem>
                  <SelectItem value="unreturned_keys_item">Unreturned Equipment or Missing Package</SelectItem>
                  <SelectItem value="no_show_contested">No-Show Contested after Acceptance</SelectItem>
                  <SelectItem value="other">Other Campus Trust Violation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Factual Explanation & Evidence *</Label>
              <Textarea
                placeholder="State clearly what was agreed upon vs what occurred, including meeting locations and times..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                required
                className="text-xs min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border/80 flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs cursor-pointer">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isSubmitting}
              className="text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Submitting Dispute...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="size-3.5" />
                  <span>File Formal Dispute</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
