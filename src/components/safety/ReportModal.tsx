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

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  targetType: "user" | "vehicle" | "ride" | "carry"
  targetId: string
  targetTitle?: string
}

export function ReportModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
}: ReportModalProps) {
  const { user } = useAuth()
  const [reasonCategory, setReasonCategory] = React.useState("safety_violation")
  const [details, setDetails] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      toast.error("Please sign in to submit a safety report.")
      return
    }

    if (!details.trim() || details.trim().length < 10) {
      toast.error("Please provide at least 10 characters explaining the issue.")
      return
    }

    try {
      setIsSubmitting(true)
      // Log report to audit_logs
      const { error } = await supabase.from("audit_logs").insert({
        actor_id: user.id,
        action: `USER_REPORT_${targetType.toUpperCase()}`,
        target_entity: targetType,
        target_id: targetId,
        details: {
          category: reasonCategory,
          explanation: details.trim(),
          target_title: targetTitle || null,
          reported_at: new Date().toISOString(),
        },
      })

      if (error) throw error

      toast.success("Report submitted to campus safety moderators. Thank you.")
      setDetails("")
      onClose()
    } catch (err: any) {
      console.error("[ReportModal] Submit error:", err)
      toast.error(err.message || "Failed to submit report.")
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
              <span>Report to Campus Safety</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Reports are confidential and reviewed directly by campus transportation coordinators.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {targetTitle && (
              <div className="p-2.5 rounded-lg bg-muted/60 border border-border/80 text-xs">
                <span className="text-[10px] uppercase font-mono text-muted-foreground block">
                  Reporting Target:
                </span>
                <span className="font-semibold text-foreground">{targetTitle}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Issue Category</Label>
              <Select value={reasonCategory} onValueChange={(val) => setReasonCategory(val || "safety_violation")}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="safety_violation">Safety Concern / Reckless Driving</SelectItem>
                  <SelectItem value="no_show">No Show / Left without Notice</SelectItem>
                  <SelectItem value="harassment">Inappropriate Behavior / Harassment</SelectItem>
                  <SelectItem value="fraud">Fraudulent Listing / Fake Details</SelectItem>
                  <SelectItem value="damage">Vehicle / Package Damage</SelectItem>
                  <SelectItem value="other">Other Campus Policy Violation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Specific Details *</Label>
              <Textarea
                placeholder="Describe what occurred with relevant dates, times, or locations..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                required
                className="text-xs min-h-[90px]"
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
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="size-3.5" />
                  <span>File Safety Report</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
