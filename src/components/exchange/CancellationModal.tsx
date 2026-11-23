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
import { XCircle, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface CancellationModalProps {
  isOpen: boolean
  onClose: () => void
  service: "rent" | "ride" | "carry"
  requestId: string
  title?: string
  onSuccess: () => void
}

export function CancellationModal({
  isOpen,
  onClose,
  service,
  requestId,
  title,
  onSuccess,
}: CancellationModalProps) {
  const { user } = useAuth()
  const [reasonCategory, setReasonCategory] = React.useState("no_show")
  const [explanation, setExplanation] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const fullReason = `[${reasonCategory.toUpperCase()}] ${explanation.trim() || "User requested cancellation"}`

    try {
      setIsSubmitting(true)

      // 1. Attempt RPC cancel_transaction_with_reason
      const { error: rpcErr } = await (supabase.rpc as any)("cancel_transaction_with_reason", {
        p_service: service,
        p_request_id: requestId,
        p_reason: fullReason,
      })

      if (rpcErr) {
        console.warn("[Cancellation] RPC fallback to direct tables:", rpcErr)

        if (service === "rent") {
          const { error: updErr } = await supabase
            .from("rental_requests")
            .update({ status: "cancelled" as any, cancellation_reason: fullReason } as any)
            .eq("id", requestId)
          if (updErr) throw updErr
        } else if (service === "ride") {
          const { error: updErr } = await supabase
            .from("ride_requests")
            .update({ status: "cancelled" as any, cancellation_reason: fullReason } as any)
            .eq("id", requestId)
          if (updErr) throw updErr
        } else if (service === "carry") {
          const { error: updErr } = await supabase
            .from("carry_requests")
            .update({ status: "cancelled" as any, cancellation_reason: fullReason } as any)
            .eq("id", requestId)
          if (updErr) throw updErr
        }
      }

      // 2. Audit log (non-blocking)
      try {
        await supabase.from("audit_logs").insert({
          actor_id: user.id,
          action: `TRANSACTION_CANCELLED_${service.toUpperCase()}`,
          target_entity: service,
          target_id: requestId,
          details: {
            category: reasonCategory,
            explanation: explanation.trim(),
            service,
          },
        })
      } catch (logErr) {
        console.warn("[Cancellation] Audit log notice:", logErr)
      }

      toast.success("Transaction cancelled. Availability and audit records updated.")
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error("[Cancellation] Error cancelling:", err)
      toast.error(err.message || "Failed to cancel request.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md sm:rounded-2xl">
        <form onSubmit={handleCancel}>
          <DialogHeader className="space-y-1.5 pb-2 border-b border-border/80">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <XCircle className="size-5" />
              <span>Cancel Exchange Request</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Please specify the cancellation reason to maintain fair campus trust metrics.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {title && (
              <div className="p-2.5 rounded-lg bg-muted/60 border border-border/80 text-xs">
                <span className="text-[10px] uppercase font-mono text-muted-foreground block">Exchange:</span>
                <span className="font-semibold text-foreground">{title}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Primary Reason *</Label>
              <Select value={reasonCategory} onValueChange={(val) => setReasonCategory(val || "no_show")}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_show">Peer No-Show (Did not arrive at agreed time)</SelectItem>
                  <SelectItem value="schedule_conflict">Emergency / Urgent Class Conflict</SelectItem>
                  <SelectItem value="item_vehicle_issue">Vehicle / Package Issue</SelectItem>
                  <SelectItem value="weather_safety">Weather / Unsafe Conditions</SelectItem>
                  <SelectItem value="mutual_agreement">Mutually Agreed to Reschedule</SelectItem>
                  <SelectItem value="other">Other Campus Reason</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Additional Context (Optional)</Label>
              <Textarea
                placeholder="Provide details if relevant (e.g. waited 15 minutes at West Gate)..."
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                className="text-xs min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border/80 flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs cursor-pointer">
              Keep Active
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
                  <span>Cancelling...</span>
                </>
              ) : (
                <>
                  <AlertCircle className="size-3.5" />
                  <span>Confirm Cancellation</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
