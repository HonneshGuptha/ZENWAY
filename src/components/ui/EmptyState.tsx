import { motion } from "motion/react"
import { Search, Compass, ShieldCheck, Wallet, FilterX, ShieldAlert, AlertCircle, RefreshCw } from "lucide-react"
import { ZenwayMascot } from "./ZenwayMascot"

export type EmptyStateVariant =
  | "search"
  | "rides"
  | "vehicles"
  | "wallet"
  | "security"
  | "no-data"
  | "filtered-empty"
  | "unverified"
  | "error"

interface EmptyStateProps {
  variant?: EmptyStateVariant
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  useMascot?: boolean
  className?: string
}

export function EmptyState({
  variant = "search",
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  useMascot = true,
  className = "",
}: EmptyStateProps) {
  const showMascot =
    useMascot &&
    (variant === "rides" ||
      variant === "vehicles" ||
      variant === "search" ||
      variant === "no-data")

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`p-10 sm:p-12 text-center rounded-3xl border border-border/80 bg-gradient-to-b from-card to-muted/20 relative overflow-hidden shadow-xs flex flex-col items-center justify-center space-y-4 ${className}`}
    >
      {/* Ambient Radial Glow */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-48 rounded-full bg-primary/10 dark:bg-primary/15 blur-3xl pointer-events-none"
      />

      {showMascot ? (
        <div className="relative z-10 flex items-center justify-center -mb-2">
          <ZenwayMascot pose="idle" size={130} />
        </div>
      ) : (
        /* 3D-Styled Visual Icon Container */
        <div className="relative size-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 flex items-center justify-center shadow-md">
          <div className="size-10 rounded-xl bg-background/90 backdrop-blur-xs flex items-center justify-center shadow-xs">
            {variant === "search" && <Search className="size-5 text-primary stroke-[2.2]" />}
            {variant === "rides" && <Compass className="size-5 text-primary stroke-[2.2]" />}
            {variant === "vehicles" && <Search className="size-5 text-primary stroke-[2.2]" />}
            {variant === "wallet" && <Wallet className="size-5 text-emerald-600 dark:text-emerald-400 stroke-[2.2]" />}
            {variant === "security" && <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400 stroke-[2.2]" />}
            {variant === "filtered-empty" && <FilterX className="size-5 text-amber-500 stroke-[2.2]" />}
            {variant === "no-data" && <Compass className="size-5 text-primary stroke-[2.2]" />}
            {variant === "unverified" && <ShieldAlert className="size-5 text-destructive stroke-[2.2]" />}
            {variant === "error" && <AlertCircle className="size-5 text-destructive stroke-[2.2]" />}
          </div>
        </div>
      )}

      <div className="space-y-1 max-w-sm relative z-10">
        <h3 className="font-heading font-bold text-base sm:text-lg text-foreground tracking-tight">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 pt-1 relative z-10">
        {actionLabel && onAction && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAction}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-semibold cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
          >
            {variant === "error" && <RefreshCw className="size-3.5" />}
            <span>{actionLabel}</span>
          </motion.button>
        )}

        {secondaryActionLabel && onSecondaryAction && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={onSecondaryAction}
            className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 border border-border/80 text-foreground text-xs font-medium cursor-pointer transition-colors shadow-2xs"
          >
            {secondaryActionLabel}
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
