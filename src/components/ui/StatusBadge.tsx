import * as React from "react"
import { Clock, CheckCircle2, XCircle, CheckCheck, AlertCircle } from "lucide-react"

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
  | string

export interface StatusBadgeProps {
  status: ExchangeStatus
  className?: string
  showIcon?: boolean
}

export function StatusBadge({ status, className = "", showIcon = false }: StatusBadgeProps) {
  const normalized = (status || "").toLowerCase().trim()

  let style = "bg-muted text-muted-foreground border-border"
  let icon: React.ReactNode = null
  const label = status ? status.replace(/_/g, " ") : "Unknown"

  if (["pending", "open", "scheduled"].includes(normalized)) {
    style = "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
    icon = <Clock className="size-3 shrink-0" />
  } else if (["accepted", "active", "in_transit", "approved"].includes(normalized)) {
    style = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
    icon = <CheckCircle2 className="size-3 shrink-0" />
  } else if (["rejected", "declined", "cancelled", "canceled", "failed"].includes(normalized)) {
    style = "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
    icon = <XCircle className="size-3 shrink-0" />
  } else if (["completed", "delivered", "resolved"].includes(normalized)) {
    style = "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"
    icon = <CheckCheck className="size-3 shrink-0" />
  } else if (["disputed"].includes(normalized)) {
    style = "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
    icon = <AlertCircle className="size-3 shrink-0" />
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize border font-mono tracking-tight select-none ${style} ${className}`}
    >
      {showIcon && icon}
      <span>{label}</span>
    </span>
  )
}
