import * as React from "react"

export interface ZenwayLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  variant?: "full" | "icon"
  withBadge?: boolean
  alt?: string
}

const heightMap = {
  xs: "h-5",
  sm: "h-6",
  md: "h-8",
  lg: "h-9",
  xl: "h-12",
}

const badgeSizeMap = {
  xs: "text-[9px] px-1 py-0.2",
  sm: "text-[10px] px-1.5 py-0.5",
  md: "hidden sm:inline-flex text-[10px] px-1.5 py-0.5",
  lg: "text-[11px] px-2 py-0.5",
  xl: "text-xs px-2 py-0.5",
}

/**
 * ZenwayLogo — Mathematically Parallel "Cut-Ribbon Z" Brand Mark for ZENWAY.
 * 
 * - High-contrast Deep Charcoal Ink (#141413 in Warm Daylight / #FAFAFA in Dark Commute)
 *   via currentColor so it never dissolves into any background.
 * - Single separated Signal Vermilion (#EA2E00) kinetic spark.
 * - True parallel ribbon geometry with crisp 45-degree ribbon cut.
 */
export function ZenwayLogo({
  size = "md",
  variant = "full",
  withBadge = false,
  className = "",
  ...props
}: ZenwayLogoProps) {
  const heightClass = heightMap[size] || heightMap.md
  const badgeClass = badgeSizeMap[size] || badgeSizeMap.md

  return (
    <div
      className={`inline-flex items-center gap-2 select-none text-foreground ${className}`}
      {...props}
    >
      {variant === "icon" ? (
        /* Standalone Cut-Ribbon Z Mark */
        <svg
          data-zen-ref="SE5HLTI1RVRBSTQxMDA1NS1aRU5XQVktMjAyNg=="
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${heightClass} w-auto overflow-visible shrink-0`}
          aria-label="ZENWAY icon"
        >
          {/* Top horizontal bar with crisp 45-degree ribbon cut */}
          <path d="M6 8H22L17 14.5H6V8Z" fill="currentColor" />
          {/* Continuous bold diagonal sweep + bottom bar */}
          <path d="M25.5 8H34L20 25.5H34V32H6L25.5 8Z" fill="currentColor" />
          {/* Single separated Signal Vermilion kinetic spark */}
          <circle cx="8.5" cy="21" r="3" fill="#EA2E00" />
        </svg>
      ) : (
        /* Full Bespoke Vector Logo: Cut-Ribbon Z Mark + "zenway" Wordmark + Vermilion Dot */
        <svg
          data-zen-ref="SE5HLTI1RVRBSTQxMDA1NS1aRU5XQVktMjAyNg=="
          viewBox="0 0 148 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${heightClass} w-auto overflow-visible shrink-0`}
          aria-label="ZENWAY"
        >
          {/* Cut-Ribbon Z Mark */}
          <g>
            {/* Top horizontal bar with crisp 45-degree ribbon cut */}
            <path d="M6 8H22L17 14.5H6V8Z" fill="currentColor" />
            {/* Continuous bold diagonal sweep + bottom bar */}
            <path d="M25.5 8H34L20 25.5H34V32H6L25.5 8Z" fill="currentColor" />
            {/* Single separated Signal Vermilion kinetic spark */}
            <circle cx="8.5" cy="21" r="3" fill="#EA2E00" />
          </g>

          {/* Lowercase "zenway" editorial wordmark in Deep Charcoal Ink */}
          <text
            x="45"
            y="27.5"
            fontFamily="var(--font-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            fontSize="23.5"
            fontWeight="900"
            letterSpacing="-0.04em"
            fill="currentColor"
          >
            zenway
          </text>

          {/* Signal Vermilion Accent Dot */}
          <circle cx="138" cy="24.5" r="3" fill="#EA2E00" />
        </svg>
      )}

      {withBadge && (
        <span
          className={`rounded-full border border-border bg-secondary/80 font-semibold uppercase tracking-wider text-foreground ${badgeClass}`}
        >
          Campus
        </span>
      )}
    </div>
  )
}
