import * as React from "react"

export interface MascotKickVectorProps extends React.SVGProps<SVGSVGElement> {
  pose?: "hover" | "kick" | "idle" | "windup"
  size?: number
  className?: string
}

const OUTLINE = "#1A1A1A"
const WHITE = "#FFFFFF"
const PINK_CHEEK = "#F9B8B8"
const VERMILION = "#E2462A"
const STROKE_WIDTH = 5.5

/**
 * MascotKickVector:
 * Clean, official 2D flat ZENWAY white dog mascot artwork for notification interactions.
 * - Pure #FFFFFF round dog body & head (strictly NO helmet, NO backpack, NO straps)
 * - Thick #1A1A1A charcoal outline (stroke-width 5.5, round caps and joins)
 * - Floppy rounded ears, dark eyes, small oval nose, happy smile, soft pink cheeks (#F9B8B8)
 * - Two distinct poses:
 *   1. "hover" / "idle": Perched happily on the notification card edge with one waving paw
 *   2. "kick" / "windup": Dynamic karate flying-kick with determined > < eyes, vermilion speed lines & sparkle burst
 */
export function MascotKickVector({
  pose = "hover",
  size = 56,
  className = "",
  ...props
}: MascotKickVectorProps) {
  const isKickPose = pose === "kick" || pose === "windup"

  if (isKickPose) {
    // Dynamic Karate Flying-Kick / Dash-Kick striking rightward
    return (
      <svg
        viewBox="0 0 140 100"
        width={Math.round(size * 1.35)}
        height={Math.round(size * 0.96)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none overflow-visible ${className}`}
        aria-hidden="true"
        {...props}
      >
        {/* Subtle ground drop-shadow for kick */}
        <ellipse cx="68" cy="94" rx="36" ry="4" fill={OUTLINE} fillOpacity="0.1" />

        {/* Signal Vermilion Speed Lines trailing behind */}
        <g stroke={VERMILION} strokeWidth="3.5" strokeLinecap="round" opacity="0.85">
          <line x1="6" y1="42" x2="26" y2="42" />
          <line x1="12" y1="52" x2="34" y2="52" />
          <line x1="4" y1="62" x2="22" y2="62" />
        </g>

        {/* Playful wagging tail sweeping back */}
        <path
          d="M 32 64 C 20 66, 14 54, 18 46"
          stroke={OUTLINE}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
        />

        {/* Tucked Back Leg */}
        <path
          d="M 44 64 C 38 72, 42 82, 52 82 C 58 82, 60 74, 56 66 Z"
          fill={WHITE}
          stroke={OUTLINE}
          strokeWidth={STROKE_WIDTH}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* White Rounded Dog Torso (Leaning forward into the flying kick) */}
        <path
          d="M 38 48 C 36 34, 52 28, 68 32 C 80 36, 86 50, 82 64 C 78 72, 50 72, 40 64 Z"
          fill={WHITE}
          stroke={OUTLINE}
          strokeWidth={STROKE_WIDTH}
          strokeLinejoin="round"
        />

        {/* Extended Front Kick Leg striking rightward */}
        <g id="kick-extended-leg">
          <path
            d="M 76 54 L 110 50 C 116 50, 118 56, 114 62 C 110 66, 102 66, 78 64 Z"
            fill={WHITE}
            stroke={OUTLINE}
            strokeWidth={STROKE_WIDTH}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Rounded Kick Paw Foot */}
          <ellipse
            cx="112"
            cy="56"
            rx="6.5"
            ry="5.5"
            fill={WHITE}
            stroke={OUTLINE}
            strokeWidth={STROKE_WIDTH}
          />
          {/* Subtle vermilion paw pad accent */}
          <circle cx="112" cy="56" r="2.8" fill={VERMILION} />
        </g>

        {/* Front Arms / Paws in playful Karate Guard Position */}
        <path
          d="M 64 46 C 72 42, 80 44, 82 50 C 82 56, 74 56, 68 52"
          fill={WHITE}
          stroke={OUTLINE}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* White Round Head tilted forward */}
        <ellipse
          cx="72"
          cy="32"
          rx="21"
          ry="19"
          fill={WHITE}
          stroke={OUTLINE}
          strokeWidth={STROKE_WIDTH}
        />

        {/* Floppy Rounded Ears swept back by dash momentum */}
        {/* Left Ear */}
        <path
          d="M 54 22 C 40 20, 34 32, 42 40 C 48 44, 56 36, 56 28 Z"
          fill={WHITE}
          stroke={OUTLINE}
          strokeWidth={STROKE_WIDTH}
          strokeLinejoin="round"
        />
        {/* Right Ear */}
        <path
          d="M 88 18 C 98 16, 104 26, 98 34 C 94 38, 86 36, 84 26 Z"
          fill={WHITE}
          stroke={OUTLINE}
          strokeWidth={STROKE_WIDTH}
          strokeLinejoin="round"
        />

        {/* Soft Pink Cheeks */}
        <circle cx="58" cy="37" r="4" fill={PINK_CHEEK} />
        <circle cx="86" cy="37" r="4" fill={PINK_CHEEK} />

        {/* Determined & Excited Eyes (> < karate focus) */}
        <g stroke={OUTLINE} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Left Eye > */}
          <path d="M 62 27 L 68 31 L 62 35" />
          {/* Right Eye < */}
          <path d="M 82 27 L 76 31 L 82 35" />
        </g>

        {/* Small Oval Nose */}
        <ellipse cx="72" cy="34" rx="3.2" ry="2.2" fill={OUTLINE} />

        {/* Confident Smile */}
        <path
          d="M 68 39 Q 72 43 76 39"
          stroke={OUTLINE}
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Impact Sparkle Burst at Kick Point */}
        <g transform="translate(122, 48)">
          <path
            d="M 6 0 L 8 6 L 14 8 L 8 10 L 6 16 L 4 10 L -2 8 L 4 6 Z"
            fill={VERMILION}
          />
          {/* Radiating impact lines */}
          <line x1="8" y1="-4" x2="12" y2="-8" stroke={VERMILION} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="16" y1="4" x2="21" y2="3" stroke={VERMILION} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="13" y1="14" x2="18" y2="18" stroke={VERMILION} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </svg>
    )
  }

  // IDLE / PERCHED POSE: White dog mascot perched happily on top of notification card
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none overflow-visible ${className}`}
      aria-hidden="true"
      {...props}
    >
      {/* Contact base shadow */}
      <ellipse cx="60" cy="114" rx="34" ry="4" fill={OUTLINE} fillOpacity="0.12" />

      {/* Cute Wagging Tail */}
      <path
        d="M 38 92 C 26 90, 20 80, 24 72"
        stroke={OUTLINE}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      />

      {/* Floppy Left Ear */}
      <path
        d="M 38 34 C 24 38, 22 58, 30 68 C 36 74, 44 68, 42 54 Z"
        fill={WHITE}
        stroke={OUTLINE}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
      />

      {/* Floppy Right Ear */}
      <path
        d="M 82 34 C 96 38, 98 58, 90 68 C 84 74, 76 68, 78 54 Z"
        fill={WHITE}
        stroke={OUTLINE}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
      />

      {/* Plump White Dog Torso / Body */}
      <path
        d="M 40 64 C 34 76, 36 96, 42 102 C 48 106, 72 106, 78 102 C 84 96, 86 76, 80 64 Z"
        fill={WHITE}
        stroke={OUTLINE}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
      />

      {/* Two Small Rounded Feet / Paws resting on card edge */}
      <ellipse
        cx="48"
        cy="106"
        rx="7.5"
        ry="5"
        fill={WHITE}
        stroke={OUTLINE}
        strokeWidth={STROKE_WIDTH}
      />
      <ellipse
        cx="72"
        cy="106"
        rx="7.5"
        ry="5"
        fill={WHITE}
        stroke={OUTLINE}
        strokeWidth={STROKE_WIDTH}
      />

      {/* Left Front Paw resting on card */}
      <path
        d="M 40 76 C 34 82, 38 92, 46 90"
        fill={WHITE}
        stroke={OUTLINE}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Right Front Paw raised waving hello */}
      <path
        d="M 76 74 C 84 70, 94 60, 92 50 C 88 46, 80 52, 76 62"
        fill={WHITE}
        stroke={OUTLINE}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="89" cy="51" r="3.5" fill={WHITE} stroke={OUTLINE} strokeWidth={STROKE_WIDTH} />

      {/* White Round Dog Head */}
      <circle
        cx="60"
        cy="46"
        r="23"
        fill={WHITE}
        stroke={OUTLINE}
        strokeWidth={STROKE_WIDTH}
      />

      {/* Soft Pink Cheeks */}
      <circle cx="43" cy="53" r="4.5" fill={PINK_CHEEK} />
      <circle cx="77" cy="53" r="4.5" fill={PINK_CHEEK} />

      {/* Dark Round Eyes with Sparkle Catchlight */}
      {/* Left Eye */}
      <circle cx="50" cy="45" r="3.6" fill={OUTLINE} />
      <circle cx="49" cy="43.5" r="1.3" fill={WHITE} />

      {/* Right Eye */}
      <circle cx="70" cy="45" r="3.6" fill={OUTLINE} />
      <circle cx="69" cy="43.5" r="1.3" fill={WHITE} />

      {/* Cute Small Oval Nose */}
      <ellipse cx="60" cy="51" rx="3.5" ry="2.4" fill={OUTLINE} />

      {/* Happy Smile */}
      <path
        d="M 54 55 Q 57 59 60 56 Q 63 59 66 55"
        stroke={OUTLINE}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
