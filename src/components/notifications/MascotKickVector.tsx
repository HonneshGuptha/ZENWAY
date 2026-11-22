import * as React from "react"
import { MASCOT_COLORS } from "@/components/ui/mascotConstants"

export interface MascotKickVectorProps extends React.SVGProps<SVGSVGElement> {
  pose?: "hover" | "kick"
  size?: number
  className?: string
}

/**
 * Dedicated vector mascot for the ZENWAY notification interaction.
 * Flat 2D vector style strictly adhering to ZENWAY brand system:
 * - #FFFFFF dog body
 * - #141413 crisp vector strokes (2.5px, round joins)
 * - #EA2E00 (Signal Vermilion) helmet
 * - #9DBDB8 (Muted Sage) backpack
 * - #FAF6EE cream accents
 * - Fully isolated: does NOT touch or modify base ZenwayMascot / EntryIntro / MascotLoader.
 */
export function MascotKickVector({
  pose = "hover",
  size = 64,
  className = "",
  ...props
}: MascotKickVectorProps) {
  if (pose === "kick") {
    // Dynamic Karate Flying-Kick / Dash-Kick pose striking rightward
    return (
      <svg
        viewBox="0 0 100 80"
        width={size * 1.25}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none overflow-visible ${className}`}
        aria-hidden="true"
        {...props}
      >
        {/* Dash speed lines */}
        <g stroke={MASCOT_COLORS.vermilion} strokeWidth="2" strokeLinecap="round" opacity="0.8">
          <line x1="5" y1="36" x2="22" y2="36" />
          <line x1="10" y1="44" x2="25" y2="44" />
          <line x1="2" y1="52" x2="18" y2="52" />
        </g>

        {/* Tail trailing back */}
        <path
          d="M20 48c-6-4-10-2-12 4"
          stroke={MASCOT_COLORS.outline}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Muted Sage Backpack */}
        <rect
          x="24"
          y="32"
          width="12"
          height="16"
          rx="3"
          fill={MASCOT_COLORS.sage}
          stroke={MASCOT_COLORS.outline}
          strokeWidth="2"
        />

        {/* Main Body (Angled forward into the kick) */}
        <path
          d="M32 38c0-8 8-14 18-14h12c8 0 14 6 14 14l-4 12H34l-2-12z"
          fill={MASCOT_COLORS.white}
          stroke={MASCOT_COLORS.outline}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Back Leg (Tucked up) */}
        <path
          d="M36 50c-2 6-1 10 4 10s6-4 4-10"
          fill={MASCOT_COLORS.white}
          stroke={MASCOT_COLORS.outline}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Front Kick Leg (Extended straight forward to strike the card) */}
        <g id="kick-leg">
          <path
            d="M58 46l24-2c3 0 6 2 6 6s-3 6-6 6l-22-2"
            fill={MASCOT_COLORS.white}
            stroke={MASCOT_COLORS.outline}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Paw pad impact detail */}
          <circle cx="85" cy="50" r="3" fill={MASCOT_COLORS.vermilion} />
        </g>

        {/* Vermilion Helmet */}
        <path
          d="M48 18c0-10 8-16 18-16s18 6 18 16c0 3-1 6-4 8l-28-1c-3-2-4-4-4-7z"
          fill={MASCOT_COLORS.vermilion}
          stroke={MASCOT_COLORS.outline}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Visor & Aerodynamic Fin */}
        <path
          d="M72 14c4 0 7 2 9 5l-12 3c-1-4 1-8 3-8z"
          fill={MASCOT_COLORS.cream}
          stroke={MASCOT_COLORS.outline}
          strokeWidth="1.5"
        />

        {/* Determined Dog Face & Snout */}
        <path
          d="M62 20c0 4 3 8 7 8h5c4 0 7-4 7-8"
          fill={MASCOT_COLORS.white}
          stroke={MASCOT_COLORS.outline}
          strokeWidth="2"
        />
        {/* Confident eye & nose */}
        <circle cx="71" cy="22" r="2" fill={MASCOT_COLORS.outline} />
        <ellipse cx="78" cy="23" rx="2" ry="1.5" fill={MASCOT_COLORS.outline} />

        {/* Front Paws in Karate Guard Position */}
        <path
          d="M52 38c4-4 8-2 10 2s0 8-4 8"
          fill={MASCOT_COLORS.white}
          stroke={MASCOT_COLORS.outline}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  // Hovering / Dropping down alert pose
  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none overflow-visible ${className}`}
      aria-hidden="true"
      {...props}
    >
      {/* Muted Sage Backpack on Back */}
      <rect
        x="18"
        y="30"
        width="12"
        height="18"
        rx="3"
        fill={MASCOT_COLORS.sage}
        stroke={MASCOT_COLORS.outline}
        strokeWidth="2.2"
      />

      {/* Dog Body (Standing/Floating down) */}
      <path
        d="M26 34c0-8 6-14 14-14h8c8 0 14 6 14 14v18c0 4-4 8-8 8H34c-4 0-8-4-8-8V34z"
        fill={MASCOT_COLORS.white}
        stroke={MASCOT_COLORS.outline}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Cute Alert Tail */}
      <path
        d="M26 48c-6-4-10-1-12 5"
        stroke={MASCOT_COLORS.outline}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Vermilion Helmet */}
      <path
        d="M30 18c0-10 8-16 18-16s18 6 18 16c0 3-1 6-4 8H34c-3-2-4-5-4-8z"
        fill={MASCOT_COLORS.vermilion}
        stroke={MASCOT_COLORS.outline}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Helmet Visor */}
      <path
        d="M48 12c5 0 9 2 11 6l-14 2c-1-5 1-8 3-8z"
        fill={MASCOT_COLORS.cream}
        stroke={MASCOT_COLORS.outline}
        strokeWidth="1.5"
      />

      {/* Friendly Eyes */}
      <circle cx="44" cy="24" r="2.2" fill={MASCOT_COLORS.outline} />
      <circle cx="56" cy="24" r="2.2" fill={MASCOT_COLORS.outline} />

      {/* Dog Snout & Nose */}
      <path
        d="M47 28c0-1 2-2 3-2s3 1 3 2c0 2-3 3-3 3s-3-1-3-3z"
        fill={MASCOT_COLORS.outline}
      />

      {/* Front Paws Rested on Edge */}
      <rect
        x="34"
        y="56"
        width="8"
        height="12"
        rx="4"
        fill={MASCOT_COLORS.white}
        stroke={MASCOT_COLORS.outline}
        strokeWidth="2.2"
      />
      <rect
        x="46"
        y="56"
        width="8"
        height="12"
        rx="4"
        fill={MASCOT_COLORS.white}
        stroke={MASCOT_COLORS.outline}
        strokeWidth="2.2"
      />
    </svg>
  )
}
