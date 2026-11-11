import * as React from "react"

export interface ZenwayLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Display size variant:
   * - xs: h-5 (~20px height)
   * - sm: h-6 (~24px height)
   * - md: h-8 (~32px height, optimal for primary header)
   * - lg: h-9 (~36px height, optimal for footer)
   * - xl: h-12 (~48px height)
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl"

  /**
   * Variant mode:
   * - "full": Complete official Concept 4 logo (bicycle icon + lowercase "zenway" wordmark)
   * - "icon": Standalone bicycle icon mark
   */
  variant?: "full" | "icon"

  /**
   * Whether to display the subtle "Campus" badge beside the logo
   */
  withBadge?: boolean

  /**
   * Custom alt attribute for the logo image
   */
  alt?: string
}

const sizeConfig = {
  xs: {
    full: "h-5 w-auto max-w-[120px]",
    icon: "h-5 w-auto",
    badge: "text-[9px] px-1 py-0.2",
  },
  sm: {
    full: "h-5 sm:h-6 w-auto max-w-[135px] sm:max-w-[155px]",
    icon: "h-5 sm:h-6 w-auto",
    badge: "text-[10px] px-1.5 py-0.5",
  },
  md: {
    full: "h-6 sm:h-8 w-auto max-w-[150px] sm:max-w-[195px]",
    icon: "h-6 sm:h-8 w-auto",
    badge: "hidden sm:inline-flex text-[10px] px-1.5 py-0.5",
  },
  lg: {
    full: "h-7 sm:h-9 w-auto max-w-[170px] sm:max-w-[220px]",
    icon: "h-7 sm:h-9 w-auto",
    badge: "text-[11px] px-2 py-0.5",
  },
  xl: {
    full: "h-10 sm:h-12 w-auto max-w-[240px] sm:max-w-[280px]",
    icon: "h-10 sm:h-12 w-auto",
    badge: "text-xs px-2 py-0.5",
  },
}

/**
 * ZenwayLogo — Centralized official brand mark for ZENWAY.
 * 
 * Implements Concept 4 (Approved 10 November 2026):
 * Lowercase teal/blue-gradient "zenway" wordmark with the bicycle icon to its left.
 * Preserves original proportions (524:89), typography, bicycle icon, and gradient.
 */
export function ZenwayLogo({
  size = "md",
  variant = "full",
  withBadge = false,
  alt = "ZENWAY Campus Mobility",
  className = "",
  ...props
}: ZenwayLogoProps) {
  const currentSize = sizeConfig[size] || sizeConfig.md
  const imageSrc =
    variant === "icon"
      ? "/assets/brand/zenway-bike-icon.png"
      : "/assets/brand/zenway-logo.png"

  return (
    <div
      className={`inline-flex items-center gap-2 select-none ${className}`}
      {...props}
    >
      <img
        src={imageSrc}
        alt={alt}
        width={variant === "icon" ? 121 : 524}
        height={variant === "icon" ? 79 : 89}
        loading="eager"
        decoding="async"
        className={`${
          variant === "icon" ? currentSize.icon : currentSize.full
        } object-contain transition-all dark:brightness-110 dark:contrast-105`}
      />

      {withBadge && (
        <span
          className={`rounded-full border border-teal-500/25 bg-teal-500/10 dark:bg-teal-500/15 font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300 ${currentSize.badge}`}
        >
          Campus
        </span>
      )}
    </div>
  )
}
