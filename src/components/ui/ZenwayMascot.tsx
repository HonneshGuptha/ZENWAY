import * as React from "react"

export interface ZenwayMascotProps extends React.SVGProps<SVGSVGElement> {
  pose?: "idle" | "riding" | "standing"
  size?: "sm" | "md" | "lg" | "xl" | number
  className?: string
}

const sizeMap = {
  sm: 64,
  md: 110,
  lg: 160,
  xl: 220,
}

/**
 * ZenwayMascot:
 * Crisp 2D flat minimalist vector SVG mascot:
 * - Pure #FFFFFF dog body
 * - Crisp #141413 vector strokes (2.5px, rounded joins)
 * - Zero realistic 3D slop
 * - #EA2E00 (Signal Vermilion) helmet and vehicle accents
 * - #9DBDB8 (Muted Sage) backpack
 */
export function ZenwayMascot({
  pose = "idle",
  size = "md",
  className = "",
  ...props
}: ZenwayMascotProps) {
  const pixelSize = typeof size === "number" ? size : sizeMap[size] || 110

  if (pose === "riding") {
    return (
      <svg
        data-zen-ref="SE5HLTI1RVRBSTQxMDA1NS1aRU5XQVktMjAyNg=="
        viewBox="0 0 200 140"
        width={pixelSize}
        height={(pixelSize * 140) / 200}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none overflow-visible ${className}`}
        aria-label="ZENWAY Mascot Riding Bike"
        {...props}
      >
        <defs>
          <filter id="zenway-shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#141413" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="100" cy="132" rx="72" ry="5" fill="#141413" fillOpacity="0.12" />

        {/* --- SCOOTER / BIKE BASE --- */}
        {/* Wheels */}
        <g id="wheels">
          {/* Rear Wheel */}
          <circle cx="42" cy="116" r="18" fill="#FAF6EE" stroke="#141413" strokeWidth="3" />
          <circle cx="42" cy="116" r="11" fill="#141413" />
          <circle cx="42" cy="116" r="4" fill="#FAF6EE" />
          <path d="M42 98v36M24 116h36" stroke="#FAF6EE" strokeWidth="1.5" strokeOpacity="0.6" />

          {/* Front Wheel */}
          <circle cx="158" cy="116" r="18" fill="#FAF6EE" stroke="#141413" strokeWidth="3" />
          <circle cx="158" cy="116" r="11" fill="#141413" />
          <circle cx="158" cy="116" r="4" fill="#FAF6EE" />
          <path d="M158 98v36M140 116h36" stroke="#FAF6EE" strokeWidth="1.5" strokeOpacity="0.6" />
        </g>

        {/* Bike Frame & Vermilion Bodywork */}
        <g id="bike-frame">
          {/* Deck & Lower Frame */}
          <path
            d="M42 116h40l28-22 36-2 12 24"
            stroke="#141413"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Front Steering Column & Fork */}
          <path
            d="M158 116l-14-52 6-4"
            stroke="#141413"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Handlebar */}
          <path
            d="M142 58h18"
            stroke="#141413"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Handlebar Grip Accent */}
          <rect x="154" y="55" width="6" height="6" rx="2" fill="#EA2E00" />

          {/* Vermilion Fairing / Battery Body Accent */}
          <path
            d="M68 96c0-6 6-12 14-12h24c8 0 14 6 14 12l-8 16H76l-8-16z"
            fill="#EA2E00"
            stroke="#141413"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Modern Headlight */}
          <path
            d="M156 66l6-1v6l-6-1z"
            fill="#FAF6EE"
            stroke="#141413"
            strokeWidth="2"
          />
          {/* Saddle */}
          <path
            d="M58 84c0-4 4-7 12-7h22c6 0 10 3 10 7 0 2-4 4-10 4H70c-8 0-12-2-12-4z"
            fill="#141413"
          />
        </g>

        {/* --- MASCOT DOG (SEATED FLUSH ON SADDLE) --- */}
        <g id="mascot-dog">
          {/* Tail wagging behind */}
          <path
            d="M52 74c-8-4-14 0-16 7"
            stroke="#141413"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Muted Sage Backpack on back */}
          <g id="backpack">
            <rect
              x="56"
              y="52"
              width="14"
              height="20"
              rx="4"
              fill="#9DBDB8"
              stroke="#141413"
              strokeWidth="2.5"
            />
            {/* Backpack pocket & buckle */}
            <path d="M58 60h10" stroke="#141413" strokeWidth="1.5" />
            <rect x="61" y="63" width="4" height="4" rx="1" fill="#FAF6EE" stroke="#141413" strokeWidth="1.2" />
          </g>

          {/* Dog Torso (Seated flush squarely on saddle surface) */}
          <path
            d="M66 78c-3-12 1-25 14-27 10-1 16 8 18 16l4 11c0 2-2 4-6 4H70c-3 0-4-1-4-4z"
            fill="#FFFFFF"
            stroke="#141413"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Seated Hind Thigh & Paw resting comfortably on foot deck */}
          <path
            d="M66 76c-3 6-2 14 6 16h14"
            fill="#FFFFFF"
            stroke="#141413"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <ellipse cx="86" cy="92" rx="5.5" ry="3.5" fill="#FFFFFF" stroke="#141413" strokeWidth="2" />

          {/* Front Paws reaching and locking securely on handlebar */}
          <path
            d="M96 66l44-8c4-1 6 1 7 4"
            fill="none"
            stroke="#141413"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <ellipse cx="147" cy="62" rx="3.8" ry="3.2" fill="#FFFFFF" stroke="#141413" strokeWidth="2" />

          {/* Dog Head (Aerodynamic forward cruising tilt) */}
          <circle cx="106" cy="44" r="15" fill="#FFFFFF" stroke="#141413" strokeWidth="2.5" />

          {/* Dog Snout & Smile */}
          <path
            d="M116 44c3 0 7 2 7 6 0 3-4 5-8 5h-4"
            fill="#FFFFFF"
            stroke="#141413"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Nose */}
          <circle cx="123" cy="47" r="2.5" fill="#141413" />
          {/* Friendly Eye */}
          <circle cx="112" cy="40" r="2.2" fill="#141413" />
          <circle cx="113" cy="39" r="0.8" fill="#FFFFFF" />

          {/* Vermilion Helmet (#EA2E00) with visor */}
          <g id="helmet">
            <path
              d="M93 40c0-10 8-16 18-16s18 6 18 16c0 2-1 4-3 4H96c-2 0-3-2-3-4z"
              fill="#EA2E00"
              stroke="#141413"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* Visor */}
            <path
              d="M107 36h18c2 0 3 2 3 4s-1 4-4 4h-17"
              fill="#141413"
              stroke="#141413"
              strokeWidth="1.5"
            />
            <path d="M112 38h10" stroke="#9DBDB8" strokeWidth="1" strokeLinecap="round" />
            {/* Helmet Strap */}
            <path d="M99 42l4 8" stroke="#141413" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Floppy Ear peaking beneath helmet */}
          <path
            d="M94 42c-3 4-2 10 2 12 3 1 5-2 5-6"
            fill="#FFFFFF"
            stroke="#141413"
            strokeWidth="2"
          />
        </g>

        {/* Speed Wind Lines */}
        <g id="speed-lines" opacity="0.45">
          <path d="M22 68h-12M18 78h-10M26 88h-12" stroke="#EA2E00" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    )
  }

  // DEFAULT / IDLE POSE: White dog standing/sitting proudly beside the parked bike
  return (
    <svg
      data-zen-ref="SE5HLTI1RVRBSTQxMDA1NS1aRU5XQVktMjAyNg=="
      viewBox="0 0 200 150"
      width={pixelSize}
      height={(pixelSize * 150) / 200}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none overflow-visible ${className}`}
      aria-label="ZENWAY Mascot Beside Bike"
      {...props}
    >
      {/* Ground contact shadow */}
      <ellipse cx="65" cy="140" rx="35" ry="4" fill="#141413" fillOpacity="0.12" />
      <ellipse cx="140" cy="140" rx="45" ry="4.5" fill="#141413" fillOpacity="0.12" />

      {/* --- PARKED SCOOTER/BIKE --- */}
      <g id="parked-bike" transform="translate(60, 10)">
        {/* Wheels */}
        <circle cx="28" cy="116" r="16" fill="#FAF6EE" stroke="#141413" strokeWidth="2.8" />
        <circle cx="28" cy="116" r="9" fill="#141413" />
        <circle cx="28" cy="116" r="3" fill="#FAF6EE" />

        <circle cx="118" cy="116" r="16" fill="#FAF6EE" stroke="#141413" strokeWidth="2.8" />
        <circle cx="118" cy="116" r="9" fill="#141413" />
        <circle cx="118" cy="116" r="3" fill="#FAF6EE" />

        {/* Frame */}
        <path
          d="M28 116h32l24-20 26-2 8 22"
          stroke="#141413"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Steering column */}
        <path d="M118 116l-12-50 4-4" stroke="#141413" strokeWidth="3" strokeLinecap="round" />
        <path d="M104 62h16" stroke="#141413" strokeWidth="3.5" strokeLinecap="round" />
        <rect x="114" y="59" width="5" height="5" rx="1.5" fill="#EA2E00" />

        {/* Fairing Accent */}
        <path
          d="M52 98c0-5 5-10 11-10h18c6 0 11 5 11 10l-6 14H58l-6-14z"
          fill="#EA2E00"
          stroke="#141413"
          strokeWidth="2.2"
        />
        {/* Saddle */}
        <path d="M42 86c0-3 3-5 9-5h16c5 0 8 2 8 5s-3 3-8 3H51c-6 0-9-1-9-3z" fill="#141413" />
        {/* Kickstand deployed */}
        <path d="M68 116l-8 12" stroke="#141413" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* --- STANDING WHITE DOG WITH BACKPACK & HELMET --- */}
      <g id="dog-standing" transform="translate(15, 20)">
        {/* Tail wag */}
        <path d="M22 92c-6-6-10-2-12 4" stroke="#141413" strokeWidth="2.5" strokeLinecap="round" />

        {/* Muted Sage Backpack on back */}
        <g id="backpack-standing">
          <rect
            x="20"
            y="66"
            width="14"
            height="22"
            rx="4"
            fill="#9DBDB8"
            stroke="#141413"
            strokeWidth="2.5"
          />
          <path d="M22 74h10" stroke="#141413" strokeWidth="1.5" />
          <rect x="25" y="78" width="4" height="4" rx="1" fill="#FAF6EE" stroke="#141413" strokeWidth="1.2" />
        </g>

        {/* Dog Torso */}
        <path
          d="M32 94c-2-12 2-28 14-30 10-1 14 8 16 16l2 22c0 2-2 4-5 4H36c-3 0-4-2-4-4z"
          fill="#FFFFFF"
          stroke="#141413"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Legs */}
        <path d="M36 104v16M48 104v16" stroke="#141413" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="36" cy="120" rx="4" ry="2" fill="#FFFFFF" stroke="#141413" strokeWidth="2" />
        <ellipse cx="48" cy="120" rx="4" ry="2" fill="#FFFFFF" stroke="#141413" strokeWidth="2" />

        {/* Dog Head */}
        <circle cx="50" cy="46" r="16" fill="#FFFFFF" stroke="#141413" strokeWidth="2.5" />

        {/* Snout & Smile */}
        <path
          d="M60 48c4 0 7 2 7 5 0 3-4 5-8 5h-4"
          fill="#FFFFFF"
          stroke="#141413"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="67" cy="51" r="2.5" fill="#141413" />
        <circle cx="56" cy="42" r="2.2" fill="#141413" />
        <circle cx="57" cy="41" r="0.8" fill="#FFFFFF" />

        {/* Floppy Ears */}
        <path
          d="M38 42c-4 4-4 12 1 15 3 2 6-1 5-6"
          fill="#FFFFFF"
          stroke="#141413"
          strokeWidth="2"
        />

        {/* Vermilion Helmet resting proudly on head */}
        <g id="helmet-idle">
          <path
            d="M38 40c0-10 7-16 16-16s16 6 16 16c0 2-1 3-3 3H41c-2 0-3-1-3-3z"
            fill="#EA2E00"
            stroke="#141413"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Raised Visor */}
          <path
            d="M50 32h16c2 0 3 2 3 3s-1 3-3 3H50"
            fill="#141413"
            stroke="#141413"
            strokeWidth="1.5"
          />
          <path d="M53 34h9" stroke="#9DBDB8" strokeWidth="1" strokeLinecap="round" />
          <path d="M42 41l3 8" stroke="#141413" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Paw waving hello */}
        <path d="M58 74l8-8c2-2 4-1 4 2" stroke="#141413" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="71" cy="67" rx="3" ry="3" fill="#FFFFFF" stroke="#141413" strokeWidth="2" />
      </g>
    </svg>
  )
}
