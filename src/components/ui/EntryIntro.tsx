import * as React from "react"

interface EntryIntroProps {
  onComplete: () => void
}

/**
 * EntryIntro:
 * Choreographed 5-Phase Origin Sequence (3.6s total):
 * 
 * Phase 1 (0.0s – 0.55s): Cut-Ribbon Z Mark Reveal (scale + opacity pop)
 * Phase 2 (0.55s – 1.05s): zenway Wordmark Emergence (clip-path slide out)
 * Phase 3 (1.05s – 1.65s): Vermilion Spark Detach & Parabolic Bounce (logo dissolves)
 * Phase 4 (1.65s – 2.05s): Pure-White 2D Vector Splash → Dog Mascot Birth
 * Phase 5 (2.05s – 3.60s): Continuous Helmet Pull (Bezier) → Flush Saddle Jump → Zip Off
 */
export function EntryIntro({ onComplete }: EntryIntroProps) {
  const [progress, setProgress] = React.useState(0)
  const [isSkipped, setIsSkipped] = React.useState(false)
  const startTimeRef = React.useRef<number | null>(null)
  const animFrameRef = React.useRef<number | null>(null)

  const TOTAL_DURATION = 3600 // ms

  const handleFinish = React.useCallback(() => {
    try {
      sessionStorage.setItem("zenway_intro_seen", "true")
    } catch {
      // Ignore in strict private browsing
    }
    onComplete()
  }, [onComplete])

  const handleSkip = React.useCallback(() => {
    setIsSkipped(true)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    handleFinish()
  }, [handleFinish])

  React.useEffect(() => {
    try {
      if (sessionStorage.getItem("zenway_intro_seen") === "true") {
        onComplete()
        return
      }
    } catch {
      // Proceed with intro
    }

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const p = Math.min(elapsed / TOTAL_DURATION, 1)
      setProgress(p)

      if (p < 1) {
        animFrameRef.current = requestAnimationFrame(step)
      } else {
        handleFinish()
      }
    }

    animFrameRef.current = requestAnimationFrame(step)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [handleFinish, onComplete])

  if (isSkipped) return null

  // ---------------------------------------------------------------------------
  // TIMELINE NORMALIZATION (0.00 -> 1.00 over 3600ms)
  // Phase 1 (0.00s - 0.55s): p in [0.000, 0.153]
  // Phase 2 (0.55s - 1.05s): p in [0.153, 0.292]
  // Phase 3 (1.05s - 1.65s): p in [0.292, 0.458]
  // Phase 4 (1.65s - 2.05s): p in [0.458, 0.569]
  // Phase 5 (2.05s - 3.60s): p in [0.569, 1.000]
  // ---------------------------------------------------------------------------

  // --- PHASE 1 & 2: LOGO REVEAL & WORDMARK SLIDE ---
  let logoX = 145
  let logoY = 75
  let logoScale = 1.35
  let logoOpacity = 0
  let wordmarkClipWidth = 0
  let sparkAttached = true

  if (progress < 0.153) {
    // Phase 1: Cut-Ribbon Z Mark pops into center
    const t1 = progress / 0.153
    logoOpacity = Math.min(1, t1 * 2)
    const springScale = 0.4 + 0.95 * Math.sin(t1 * Math.PI * 0.5)
    // Starts centered, then eases leftward as wordmark nears
    const centerBias = Math.max(0, 1 - t1 * 1.5)
    logoX = 145 + centerBias * 45
    logoY = 75
    logoScale = springScale
    wordmarkClipWidth = 0
    sparkAttached = true
  } else if (progress < 0.292) {
    // Phase 2: Wordmark slides out from mask to the right of Z
    const t2 = (progress - 0.153) / 0.139
    logoOpacity = 1
    logoX = 145
    logoY = 75
    logoScale = 1.35
    wordmarkClipWidth = Math.min(115, t2 * 115)
    sparkAttached = true
  } else if (progress < 0.458) {
    // Phase 3: Spark detaches! Logo ribbons & wordmark fade out
    const t3 = (progress - 0.292) / 0.166
    sparkAttached = false
    logoOpacity = Math.max(0, 1 - t3 * 1.5)
    logoScale = 1.35 - t3 * 0.2
    logoX = 145
    logoY = 75
    wordmarkClipWidth = 115
  } else {
    // Logo completely gone in Phase 4 & 5
    logoOpacity = 0
    sparkAttached = false
  }

  // --- PHASE 3: VERMILION SPARK DETACH & PARABOLIC BOUNCE ---
  // In logo space (40x40), spark is at (8.5, 21)
  // In canvas space at t3=0: startX = 145 + 8.5 * 1.35 = 156.5, startY = 75 + 21 * 1.35 = 103.3
  const SPARK_START_X = 156.5
  const SPARK_START_Y = 103.3
  const SPARK_TARGET_X = 90
  const SPARK_TARGET_Y = 175

  let sparkX = SPARK_START_X
  let sparkY = SPARK_START_Y
  let sparkVisible = false
  let sparkScale = 1

  if (progress >= 0.292 && progress < 0.458) {
    sparkVisible = true
    const t3 = (progress - 0.292) / 0.166
    // Parabolic trajectory from logo to ground contact point (90, 175)
    sparkX = (1 - t3) * SPARK_START_X + t3 * SPARK_TARGET_X
    // High playful apex arc
    const arcHeight = 4 * t3 * (1 - t3) * 65
    sparkY = (1 - t3) * SPARK_START_Y + t3 * SPARK_TARGET_Y - arcHeight
    sparkScale = 1 + Math.sin(t3 * Math.PI) * 0.5
  }

  // --- PHASE 4: 2D WHITE VECTOR SPLASH (1.65s - 2.05s) ---
  let splashProgress = 0
  let isSplashActive = false

  if (progress >= 0.458 && progress < 0.569) {
    isSplashActive = true
    splashProgress = (progress - 0.458) / 0.111
  }

  // --- PHASE 4 & 5: DOG & BIKE REVEAL, HELMET PULL, SADDLE JUMP & ZIP ---
  let dogVisible = false
  let bikeVisible = false
  let dogX = 90
  let dogY = 82
  let dogScale = 1
  let dogOpacity = 1
  let dogSquashY = 1
  let bikeOpacity = 1
  let bikeOffsetX = 0

  let helmetX = 82
  let helmetY = 88
  let helmetScale = 0.4
  let helmetRot = 30
  let helmetAttached = false

  let bikeDipY = 0
  let vehicleOffset = 0
  let exhaustScale = 0
  let exhaustOpacity = 0

  if (progress >= 0.458 && progress < 0.569) {
    // Phase 4: Dog births out from the expanding splash
    dogVisible = true
    bikeVisible = true
    const t4 = splashProgress
    dogScale = Math.min(1, 0.15 + 0.85 * Math.sin(t4 * Math.PI * 0.5))
    dogOpacity = Math.min(1, t4 * 2)
    dogX = 90
    dogY = 82
    bikeOpacity = Math.min(1, Math.max(0, (t4 - 0.2) / 0.8))
    bikeOffsetX = (1 - Math.sin(t4 * Math.PI * 0.5)) * 30
    helmetX = 82
    helmetY = 88
    helmetScale = 0.4
    helmetRot = 30
    helmetAttached = false
  } else if (progress >= 0.569) {
    // Phase 5: Complete narrative physics (2.05s - 3.60s)
    dogVisible = true
    bikeVisible = true
    dogScale = 1
    dogOpacity = 1
    bikeOpacity = 1
    bikeOffsetX = 0

    const t5 = (progress - 0.569) / 0.431 // 0.0 -> 1.0

    // 1. Continuous Helmet Pull along quadratic Bezier curve (t5: 0.00 -> 0.35)
    if (t5 < 0.35) {
      helmetAttached = false
      const u = t5 / 0.35
      // Bezier curve P0=(82, 88), P1=(75, 25), P2=(102, 54)
      const p0x = 82, p0y = 88
      const p1x = 75, p1y = 25
      const p2x = 102, p2y = 54
      helmetX = (1 - u) * (1 - u) * p0x + 2 * (1 - u) * u * p1x + u * u * p2x
      helmetY = (1 - u) * (1 - u) * p0y + 2 * (1 - u) * u * p1y + u * u * p2y
      helmetScale = 0.4 + u * 0.6
      helmetRot = 30 * (1 - u)
      dogX = 90
      dogY = 82
      dogSquashY = 1
    } else {
      helmetAttached = true
      helmetX = 102
      helmetY = 54
      helmetScale = 1
      helmetRot = 0
    }

    // 2. Dog Flush Jump onto Bike Saddle (t5: 0.35 -> 0.65)
    if (t5 >= 0.35 && t5 < 0.42) {
      // Crouch anticipation
      const c = (t5 - 0.35) / 0.07
      dogSquashY = 1 - c * 0.16
      dogY = 82 + c * 3.5
      dogX = 90
    } else if (t5 >= 0.42 && t5 < 0.65) {
      // Parabolic jump arc from standing (x=90) to saddle (x=148)
      const j = (t5 - 0.42) / 0.23
      dogX = 90 + j * 58
      // Parabolic height peak of 38px
      const parabola = 4 * j * (1 - j)
      dogY = 82 - parabola * 38
      dogSquashY = 1 + (0.5 - Math.abs(j - 0.5)) * 0.12
    } else if (t5 >= 0.65) {
      // Firmly locked flush on saddle
      dogX = 148
      dogY = 78
      dogSquashY = 1
    }

    // 3. Damped Bike Suspension Dip on landing (t5: 0.65 -> 0.82)
    if (t5 >= 0.65 && t5 < 0.82) {
      const d = (t5 - 0.65) / 0.17
      // Damped harmonic oscillation: e^(-6d) * sin(3 * pi * d) * 6.5
      bikeDipY = Math.exp(-6 * d) * Math.sin(d * Math.PI * 3) * 6.5
    }

    // 4. Rev & Zip Off rightward (t5: 0.76 -> 1.00)
    if (t5 >= 0.76) {
      const z = (t5 - 0.76) / 0.24
      vehicleOffset = z * z * 640
      exhaustScale = Math.sin(z * Math.PI) * 1.5
      exhaustOpacity = Math.max(0, 1 - z * 1.25)
    }
  }

  // Fade-out entire intro screen at the very end
  const containerOpacity = progress > 0.92 ? (1 - progress) / 0.08 : 1

  return (
    <div
      style={{ opacity: containerOpacity }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--bg-canvas)] transition-opacity duration-200 select-none overflow-hidden"
      role="dialog"
      aria-label="ZENWAY Origin Intro Animation"
    >
      <div className="relative w-full max-w-2xl px-6 flex flex-col items-center">
        {/* Synchronized Vector Canvas (420 x 220) */}
        <div className="w-full flex items-center justify-center">
          <svg
            viewBox="0 0 420 220"
            className="w-full max-w-[560px] sm:max-w-[640px] h-auto overflow-visible drop-shadow-sm text-foreground"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Dynamic wordmark revelation clip-path */}
              <clipPath id="wordmark-reveal-clip">
                <rect x="42" y="0" width={wordmarkClipWidth} height="40" />
              </clipPath>

              {/* Spark Glow filter */}
              <filter id="spark-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#EA2E00" floodOpacity="0.5" />
              </filter>
            </defs>

            {/* Ground Line & Contact Marks (Only visible once world/bike emerges) */}
            {(bikeVisible || isSplashActive) && (
              <path
                d="M20 185h380"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray="6 6"
                strokeOpacity="0.22"
              />
            )}

            {/* ================================================================= */}
            {/* PHASES 1 & 2: CUT-RIBBON Z BRAND MARK & WORDMARK EMERGENCE       */}
            {/* ================================================================= */}
            {logoOpacity > 0 && (
              <g
                id="brand-origin-logo"
                transform={`translate(${logoX}, ${logoY}) scale(${logoScale})`}
                opacity={logoOpacity}
                className="transition-transform duration-75 ease-out"
              >
                {/* 1. Cut-Ribbon Z Mark Geometry (40x40 local space) */}
                <g id="cut-ribbon-z-geometry">
                  {/* Top horizontal bar with crisp 45-degree ribbon cut */}
                  <path d="M6 8H22L17 14.5H6V8Z" fill="currentColor" />
                  {/* Continuous bold diagonal sweep + bottom bar */}
                  <path d="M25.5 8H34L20 25.5H34V32H6L25.5 8Z" fill="currentColor" />
                  {/* Single separated Signal Vermilion kinetic spark (when still attached) */}
                  {sparkAttached && (
                    <circle cx="8.5" cy="21" r="3" fill="#EA2E00" />
                  )}
                </g>

                {/* 2. Lowercase "zenway" Wordmark sliding out from clip mask */}
                <g clipPath="url(#wordmark-reveal-clip)">
                  <text
                    x="44"
                    y="27.5"
                    fontFamily="var(--font-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                    fontSize="23.5"
                    fontWeight="900"
                    letterSpacing="-0.04em"
                    fill="currentColor"
                  >
                    zenway
                  </text>
                  {/* Vermilion Accent Dot */}
                  <circle cx="138" cy="24.5" r="3" fill="#EA2E00" />
                </g>
              </g>
            )}

            {/* ================================================================= */}
            {/* PHASE 3: VERMILION SPARK FLYING ALONG PARABOLIC BOUNCE ARC       */}
            {/* ================================================================= */}
            {sparkVisible && (
              <g id="detached-kinetic-spark" filter="url(#spark-glow)">
                {/* Spark Motion trail line */}
                <line
                  x1={sparkX + 6}
                  y1={sparkY - 8}
                  x2={sparkX}
                  y2={sparkY}
                  stroke="#EA2E00"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeOpacity="0.4"
                />
                <circle cx={sparkX} cy={sparkY} r={3 * sparkScale} fill="#EA2E00" />
              </g>
            )}

            {/* ================================================================= */}
            {/* PHASE 4: 2D FLAT PURE-WHITE VECTOR SPLASH (AT GROUND IMPACT)     */}
            {/* ================================================================= */}
            {isSplashActive && (
              <g id="vector-splash" transform="translate(90, 175)">
                {/* Expanding White Shockwave Ring */}
                <ellipse
                  cx="0"
                  cy="0"
                  rx={splashProgress * 44}
                  ry={splashProgress * 14}
                  fill="#FFFFFF"
                  stroke="#141413"
                  strokeWidth="2.5"
                  opacity={splashProgress < 0.6 ? 1 : (1 - splashProgress) / 0.4}
                />

                {/* 8 Crisp 2D White Radial Vector Droplets with #141413 strokes */}
                {[
                  { angle: -15, dist: 38, size: 4.5 },
                  { angle: 30, dist: 46, size: 5.5 },
                  { angle: 75, dist: 36, size: 4 },
                  { angle: 120, dist: 42, size: 5 },
                  { angle: 165, dist: 48, size: 4.5 },
                  { angle: 210, dist: 34, size: 3.5 },
                  { angle: 255, dist: 40, size: 4 },
                  { angle: 300, dist: 44, size: 4.5 },
                ].map((d, i) => {
                  const rad = (d.angle * Math.PI) / 180
                  const curDist = splashProgress * d.dist
                  const curSize = Math.sin(splashProgress * Math.PI) * d.size
                  return (
                    <circle
                      key={i}
                      cx={Math.cos(rad) * curDist}
                      cy={Math.sin(rad) * curDist * 0.45 - (1 - splashProgress) * 12}
                      r={Math.max(0.5, curSize)}
                      fill="#FFFFFF"
                      stroke="#141413"
                      strokeWidth="1.8"
                    />
                  )
                })}

                {/* Micro Vermilion Sparkles rebounding from impact */}
                <circle
                  cx={-18 * splashProgress}
                  cy={-22 * Math.sin(splashProgress * Math.PI)}
                  r={2.5 * (1 - splashProgress)}
                  fill="#EA2E00"
                />
                <circle
                  cx={20 * splashProgress}
                  cy={-26 * Math.sin(splashProgress * Math.PI)}
                  r={2.5 * (1 - splashProgress)}
                  fill="#EA2E00"
                />
              </g>
            )}

            {/* ================================================================= */}
            {/* PHASE 4 & 5: PARKED / MOVING SCOOTER & FLUSH DOG MASCOT          */}
            {/* ================================================================= */}
            {(bikeVisible || dogVisible) && (
              <g transform={`translate(${vehicleOffset}, 0)`}>
                {/* Bike Ground Shadow */}
                <ellipse
                  cx="210"
                  cy={185 + bikeDipY * 0.4}
                  rx={progress >= 0.75 ? "85" : "75"}
                  ry="6"
                  fill="#141413"
                  fillOpacity={0.12 * bikeOpacity}
                />

                {/* Exhaust Puffs (Only during Rev/Zip in Phase 5) */}
                {exhaustScale > 0 && (
                  <g
                    id="exhaust"
                    transform={`translate(100, ${160 + bikeDipY}) scale(${exhaustScale})`}
                    opacity={exhaustOpacity}
                  >
                    <circle cx="-10" cy="-2" r="5" fill="#FAF6EE" stroke="#141413" strokeWidth="1.5" />
                    <circle cx="-20" cy="-6" r="7" fill="#FAF6EE" stroke="#141413" strokeWidth="1.5" />
                    <circle cx="-32" cy="-12" r="9" fill="#FAF6EE" stroke="#141413" strokeWidth="1.5" />
                  </g>
                )}

                {/* Scooter Body */}
                <g
                  id="bike"
                  transform={`translate(${130 + bikeOffsetX}, ${48 + bikeDipY})`}
                  opacity={bikeOpacity}
                >
                  {/* Wheels */}
                  <g id="rear-wheel">
                    <circle cx="20" cy="116" r="19" fill="#FAF6EE" stroke="#141413" strokeWidth="3" />
                    <circle cx="20" cy="116" r="11" fill="#141413" />
                    <circle cx="20" cy="116" r="4" fill="#FAF6EE" />
                  </g>
                  <g id="front-wheel">
                    <circle cx="136" cy="116" r="19" fill="#FAF6EE" stroke="#141413" strokeWidth="3" />
                    <circle cx="136" cy="116" r="11" fill="#141413" />
                    <circle cx="136" cy="116" r="4" fill="#FAF6EE" />
                  </g>

                  {/* Frame & Vermilion Bodywork */}
                  <path
                    d="M20 116h42l28-24 38-2 10 26"
                    stroke="#141413"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Front Steering Column */}
                  <path d="M136 116l-14-56 6-4" stroke="#141413" strokeWidth="3.5" strokeLinecap="round" />
                  <path d="M120 56h20" stroke="#141413" strokeWidth="4" strokeLinecap="round" />
                  <rect x="134" y="53" width="7" height="6" rx="2" fill="#EA2E00" />

                  {/* Vermilion Fairing */}
                  <path
                    d="M50 96c0-6 6-12 14-12h26c8 0 14 6 14 12l-8 18H58l-8-18z"
                    fill="#EA2E00"
                    stroke="#141413"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />

                  {/* Saddle (Dog lands directly flush here) */}
                  <path
                    d="M38 84c0-4 4-7 12-7h24c6 0 10 3 10 7 0 2-4 4-10 4H50c-8 0-12-2-12-4z"
                    fill="#141413"
                  />

                  {/* Headlight beam on during rev */}
                  {progress >= 0.82 && (
                    <polygon points="144,58 220,40 220,86 144,66" fill="#EA2E00" fillOpacity="0.14" />
                  )}
                </g>

                {/* The White Dog Mascot (Births from splash, pulls helmet, flush saddle jump) */}
                {dogVisible && (
                  <g
                    id="dog-group"
                    transform={`translate(${dogX}, ${dogY + (progress >= 0.70 ? bikeDipY : 0)}) scale(${dogScale}, ${dogScale * dogSquashY})`}
                    opacity={dogOpacity}
                  >
                    {/* Tail */}
                    <path
                      d="M-6 24c-6-6-10-2-12 4"
                      stroke="#141413"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />

                    {/* Muted Sage Backpack on back */}
                    <g id="dog-backpack">
                      <rect
                        x="-6"
                        y="4"
                        width="14"
                        height="22"
                        rx="4"
                        fill="#9DBDB8"
                        stroke="#141413"
                        strokeWidth="2.5"
                      />
                      <path d="-4 10h10" stroke="#141413" strokeWidth="1.5" />
                      <rect x="-1" y="13" width="4" height="4" rx="1" fill="#FAF6EE" stroke="#141413" strokeWidth="1.2" />
                    </g>

                    {/* Dog Torso */}
                    <path
                      d="M6 30c-2-12 2-26 14-28 10-1 14 8 16 16l2 20c0 2-2 4-5 4H10c-3 0-4-2-4-4z"
                      fill="#FFFFFF"
                      stroke="#141413"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />

                    {/* Dog Legs/Paws */}
                    {progress < 0.70 ? (
                      // Standing/jumping legs
                      <g>
                        <path d="M10 40v14M22 40v14" stroke="#141413" strokeWidth="3" strokeLinecap="round" />
                        <ellipse cx="10" cy="54" rx="4" ry="2" fill="#FFFFFF" stroke="#141413" strokeWidth="2" />
                        <ellipse cx="22" cy="54" rx="4" ry="2" fill="#FFFFFF" stroke="#141413" strokeWidth="2" />
                      </g>
                    ) : (
                      // Locked flush onto bike footrest & handlebars
                      <g>
                        {/* Front paw stretching to handlebar */}
                        <path d="M30 18l32-4" stroke="#141413" strokeWidth="3.5" strokeLinecap="round" />
                        <ellipse cx="62" cy="14" rx="3.5" ry="3" fill="#FFFFFF" stroke="#141413" strokeWidth="2" />
                        {/* Hind paw on footrest */}
                        <ellipse cx="16" cy="42" rx="5" ry="3.5" fill="#FFFFFF" stroke="#141413" strokeWidth="2" />
                      </g>
                    )}

                    {/* Head */}
                    <circle cx="24" cy="-10" r="16" fill="#FFFFFF" stroke="#141413" strokeWidth="2.5" />

                    {/* Snout & Smile */}
                    <path
                      d="M34 -8c4 0 7 2 7 5 0 3-4 5-8 5h-4"
                      fill="#FFFFFF"
                      stroke="#141413"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    <circle cx="41" cy="-5" r="2.5" fill="#141413" />
                    <circle cx="30" cy="-14" r="2.2" fill="#141413" />
                    <circle cx="31" cy="-15" r="0.8" fill="#FFFFFF" />

                    {/* Floppy Ear */}
                    <path
                      d="M12 -14c-4 4-4 12 1 15 3 2 6-1 5-6"
                      fill="#FFFFFF"
                      stroke="#141413"
                      strokeWidth="2"
                    />

                    {/* Attached helmet after Bezier pull completes */}
                    {helmetAttached && (
                      <g id="attached-helmet">
                        <path
                          d="M12 -16c0-10 7-16 16-16s16 6 16 16c0 2-1 3-3 3H15c-2 0-3-1-3-3z"
                          fill="#EA2E00"
                          stroke="#141413"
                          strokeWidth="2.5"
                          strokeLinejoin="round"
                        />
                        {/* Snapped Visor */}
                        <path
                          d="M24 -24h16c2 0 3 2 3 3s-1 3-3 3H24"
                          fill="#141413"
                          stroke="#141413"
                          strokeWidth="1.5"
                        />
                        <path d="M27 -22h9" stroke="#9DBDB8" strokeWidth="1" strokeLinecap="round" />
                        <path d="M16 -15l3 8" stroke="#141413" strokeWidth="2" strokeLinecap="round" />
                      </g>
                    )}
                  </g>
                )}

                {/* CONTINUOUS HELMET OBJECT (Single element moving along Bezier curve before lock) */}
                {!helmetAttached && progress >= 0.569 && (
                  <g
                    id="airborne-helmet"
                    transform={`translate(${helmetX}, ${helmetY}) scale(${helmetScale}) rotate(${helmetRot})`}
                  >
                    <path
                      d="M-12 -16c0-10 7-16 16-16s16 6 16 16c0 2-1 3-3 3H-9c-2 0-3-1-3-3z"
                      fill="#EA2E00"
                      stroke="#141413"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M0 -24h16c2 0 3 2 3 3s-1 3-3 3H0"
                      fill="#141413"
                      stroke="#141413"
                      strokeWidth="1.5"
                    />
                    <path d="M3 -22h9" stroke="#9DBDB8" strokeWidth="1" strokeLinecap="round" />
                  </g>
                )}
              </g>
            )}
          </svg>
        </div>

        {/* Dynamic Storytelling Micro-Caption */}
        <div className="mt-5 text-center flex flex-col items-center">
          <div className="font-heading text-xl sm:text-2xl font-extrabold tracking-tight text-foreground flex items-center justify-center gap-2">
            <span>ZENWAY</span>
            <span className="size-2 rounded-full bg-primary animate-ping" />
          </div>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
            {progress < 0.292 && "Precision Campus Mobility System"}
            {progress >= 0.292 && progress < 0.458 && "Igniting peer-to-peer telemetry..."}
            {progress >= 0.458 && progress < 0.569 && "Meet Zen, your verified commute co-pilot!"}
            {progress >= 0.569 && progress < 0.76 && "Fastening helmet & locking onto saddle..."}
            {progress >= 0.76 && "Rolling out across campus!"}
          </p>
        </div>
      </div>

      {/* Subtle Skip button in bottom-right corner */}
      <button
        type="button"
        onClick={handleSkip}
        className="fixed bottom-6 right-6 z-50 text-xs font-semibold px-3.5 py-1.5 rounded-full border border-border/80 bg-card/80 backdrop-blur-md text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs"
        aria-label="Skip intro animation"
      >
        Skip →
      </button>
    </div>
  )
}
