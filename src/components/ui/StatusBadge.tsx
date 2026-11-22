import * as React from "react"
import { Clock, CheckCircle2, XCircle, CheckCheck, ShieldAlert, ArrowUpRight } from "lucide-react"

export type ExchangeStatus =
  | "pending"
  | "open"
  | "scheduled"
  | "accepted"
  | "active"
  | "in_transit"
  | "completed"
  | "delivered"
  | "rejected"
  | "declined"
  | "cancelled"
  | "canceled"
  | "disputed"
  | "reported_paid"
  | "settled"
  | "failed"
  | string

export interface StatusBadgeProps {
  status: ExchangeStatus
  className?: string
  showIcon?: boolean
  customLabel?: string
}

export function StatusBadge({
  status,
  className = "",
  showIcon = false,
  customLabel,
}: StatusBadgeProps) {
  const normalized = (status || "").toLowerCase().trim()

  let style = "bg-muted text-muted-foreground border-border/80"
  let icon: React.ReactNode = null
  let displayLabel = customLabel || (status ? status.replace(/_/g, " ") : "Unknown")

  if (normalized === "reported_paid") {
    style = "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30"
    icon = <ArrowUpRight className="size-3 shrink-0" />
    if (!customLabel) displayLabel = "Payment Reported"
  } else if (normalized === "settled") {
    style = "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30"
    icon = <CheckCheck className="size-3 shrink-0" />
    if (!customLabel) displayLabel = "Settled"
  } else if (["pending", "open", "scheduled"].includes(normalized)) {
    style = "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30"
    icon = <Clock className="size-3 shrink-0" />
  } else if (["accepted", "active", "in_transit", "approved"].includes(normalized)) {
    style = "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30"
    icon = <CheckCircle2 className="size-3 shrink-0" />
  } else if (["rejected", "declined", "cancelled", "canceled", "failed"].includes(normalized)) {
    style = "bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-500/30"
    icon = <XCircle className="size-3 shrink-0" />
  } else if (["completed", "delivered", "resolved"].includes(normalized)) {
    style = "bg-blue-500/15 text-blue-800 dark:text-blue-200 border-blue-500/30"
    icon = <CheckCheck className="size-3 shrink-0" />
  } else if (["disputed"].includes(normalized)) {
    style = "bg-purple-500/15 text-purple-800 dark:text-purple-200 border-purple-500/30"
    icon = <ShieldAlert className="size-3 shrink-0" />
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize border font-mono tracking-tight select-none ${style} ${className}`}
    >
      {showIcon && icon}
      <span>{displayLabel}</span>
    </span>
  )
}
