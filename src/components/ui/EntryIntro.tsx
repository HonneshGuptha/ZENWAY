import * as React from "react"
import {
  MASCOT_COLORS,
  hasSeenIntro,
  markIntroSeen,
  prefersReducedMotion,
} from "./mascotConstants"

interface EntryIntroProps {
  onComplete: () => void
}

/**
 * Droplet configuration for Phase 4 vector splash.
 */
const SPLASH_DROPLETS = [
  { angle: -15, dist: 38, size: 4.5 },
  { angle: 30, dist: 46, size: 5.5 },
  { angle: 75, dist: 36, size: 4 },
  { angle: 120, dist: 42, size: 5 },
  { angle: 165, dist: 48, size: 4.5 },
  { angle: 210, dist: 34, size: 3.5 },
  { angle: 255, dist: 40, size: 4 },
  { angle: 300, dist: 44, size: 4.5 },
] as const

const SPARK_START_X = 156.5
const SPARK_START_Y = 103.3
const SPARK_TARGET_X = 90
const SPARK_TARGET_Y = 175
const TOTAL_DURATION = 3600 // ms

/**
 * EntryIntro:
 * Choreographed 5-Phase Origin Sequence (3.6s total):
 *
 * Phase 1 (0.0s – 0.55s): Cut-Ribbon Z Mark Reveal (scale + opacity pop)
 * Phase 2 (0.55s – 1.05s): zenway Wordmark Emergence (clip-path slide out)
 * Phase 3 (1.05s – 1.65s): Vermilion Spark Detach & Parabolic Bounce (logo dissolves)
 * Phase 4 (1.65s – 2.05s): Pure-White 2D Vector Splash → Dog Mascot Birth
 * Phase 5 (2.05s – 3.60s): Continuous Helmet Pull (Bézier) → Flush Saddle Jump → Zip Off
 *
 * Performance-optimized: Uses a single delta-time requestAnimationFrame loop updating
 * SVG transforms and attributes via direct DOM refs, eliminating frame-by-frame React
 * re-renders for true 60fps/120fps smoothness without main-thread blocking.
 */
export function EntryIntro({ onComplete }: EntryIntroProps) {
  const [isSkipped, setIsSkipped] = React.useState(false)

  // Direct DOM refs to avoid frame-by-frame React re-renders
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const captionRef = React.useRef<HTMLParagraphElement | null>(null)
  const wordmarkClipRef = React.useRef<SVGRectElement | null>(null)
  const logoGroupRef = React.useRef<SVGGElement | null>(null)
  const sparkAttachedRef = React.useRef<SVGCircleElement | null>(null)
  const sparkDetachedRef = React.useRef<SVGGElement | null>(null)
  const sparkLineRef = React.useRef<SVGLineElement | null>(null)
  const sparkCircleRef = React.useRef<SVGCircleElement | null>(null)
  const groundLineRef = React.useRef<SVGPathElement | null>(null)
  const splashGroupRef = React.useRef<SVGGElement | null>(null)
  const splashRingRef = React.useRef<SVGEllipseElement | null>(null)
  const dropletRefs = React.useRef<(SVGCircleElement | null)[]>([])
  const sparkle1Ref = React.useRef<SVGCircleElement | null>(null)
  const sparkle2Ref = React.useRef<SVGCircleElement | null>(null)
  const vehicleGroupRef = React.useRef<SVGGElement | null>(null)
  const shadowRef = React.useRef<SVGEllipseElement | null>(null)
  const exhaustRef = React.useRef<SVGGElement | null>(null)
  const bikeRef = React.useRef<SVGGElement | null>(null)
  const headlightRef = React.useRef<SVGPolygonElement | null>(null)
  const dogGroupRef = React.useRef<SVGGElement | null>(null)
  const standingLegsRef = React.useRef<SVGGElement | null>(null)
  const ridingLegsRef = React.useRef<SVGGElement | null>(null)
  const attachedHelmetRef = React.useRef<SVGGElement | null>(null)
  const airborneHelmetRef = React.useRef<SVGGElement | null>(null)

  const startTimeRef = React.useRef<number | null>(null)
  const animFrameRef = React.useRef<number | null>(null)
  const safetyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCaptionPhaseRef = React.useRef<number>(-1)
  const completedRef = React.useRef<boolean>(false)

  const handleFinish = React.useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current)
      safetyTimeoutRef.current = null
    }

    markIntroSeen()
    onComplete()
  }, [onComplete])

  const handleSkip = React.useCallback(() => {
    setIsSkipped(true)
    handleFinish()
  }, [handleFinish])

  React.useEffect(() => {
    // 1. If returning user has already seen intro, skip immediately
    if (hasSeenIntro()) {
      onComplete()
      return
    }

    // 2. Accessibility: Respect prefers-reduced-motion
    if (prefersReducedMotion()) {
      handleFinish()
      return
    }

    // 3. Fail-safe timeout: Ensure user is never stuck on a blank overlay
    safetyTimeoutRef.current = setTimeout(() => {
      handleFinish()
    }, TOTAL_DURATION + 600)

    // 4. Update function: Apply physics and transforms directly to SVG DOM nodes
    const applyFrame = (progress: number) => {
      // Container fade-out at the very end
      if (containerRef.current) {
        const containerOpacity = progress > 0.92 ? (1 - progress) / 0.08 : 1
        containerRef.current.style.opacity = containerOpacity.toString()
      }

      // Micro-caption update only at phase boundaries
      if (captionRef.current) {
        let phaseIndex = 0
        let captionText = "Precision Campus Mobility System"
        if (progress >= 0.76) {
          phaseIndex = 4
          captionText = "Rolling out across campus!"
        } else if (progress >= 0.569) {
          phaseIndex = 3
          captionText = "Fastening helmet & locking onto saddle..."
        } else if (progress >= 0.458) {
          phaseIndex = 2
          captionText = "Meet Zen, your verified commute co-pilot!"
        } else if (progress >= 0.292) {
          phaseIndex = 1
          captionText = "Igniting peer-to-peer telemetry..."
        }

        if (lastCaptionPhaseRef.current !== phaseIndex) {
          lastCaptionPhaseRef.current = phaseIndex
          captionRef.current.textContent = captionText
        }
      }

      // --- PHASES 1, 2 & 3: LOGO REVEAL & WORDMARK SLIDE ---
      let logoX = 145
      let logoY = 75
      let logoScale = 1.35
      let logoOpacity = 0
      let wordmarkClipWidth = 0
      let sparkAttached = true

      if (progress < 0.153) {
        const t1 = progress / 0.153
        logoOpacity = Math.min(1, t1 * 2)
        const springScale = 0.4 + 0.95 * Math.sin(t1 * Math.PI * 0.5)
        const centerBias = Math.max(0, 1 - t1 * 1.5)
        logoX = 145 + centerBias * 45
        logoY = 75
        logoScale = springScale
        wordmarkClipWidth = 0
        sparkAttached = true
      } else if (progress < 0.292) {
        const t2 = (progress - 0.153) / 0.139
        logoOpacity = 1
        logoX = 145
        logoY = 75
        logoScale = 1.35
        wordmarkClipWidth = Math.min(115, t2 * 115)
        sparkAttached = true
      } else if (progress < 0.458) {
        const t3 = (progress - 0.292) / 0.166
        sparkAttached = false
        logoOpacity = Math.max(0, 1 - t3 * 1.5)
        logoScale = 1.35 - t3 * 0.2
        logoX = 145
        logoY = 75
        wordmarkClipWidth = 115
      }

      if (logoGroupRef.current) {
        if (logoOpacity > 0) {
          logoGroupRef.current.style.display = ""
          logoGroupRef.current.setAttribute("transform", `translate(${logoX}, ${logoY}) scale(${logoScale})`)
          logoGroupRef.current.setAttribute("opacity", logoOpacity.toString())
        } else {
          logoGroupRef.current.style.display = "none"
        }
      }
      if (sparkAttachedRef.current) {
        sparkAttachedRef.current.style.display = sparkAttached ? "" : "none"
      }
      if (wordmarkClipRef.current) {
        wordmarkClipRef.current.setAttribute("width", wordmarkClipWidth.toString())
      }

      // --- PHASE 3: VERMILION SPARK DETACH & PARABOLIC BOUNCE ---
      const sparkVisible = progress >= 0.292 && progress < 0.458
      if (sparkDetachedRef.current) {
        if (sparkVisible) {
          sparkDetachedRef.current.style.display = ""
          const t3 = (progress - 0.292) / 0.166
          const sparkX = (1 - t3) * SPARK_START_X + t3 * SPARK_TARGET_X
          const arcHeight = 4 * t3 * (1 - t3) * 65
          const sparkY = (1 - t3) * SPARK_START_Y + t3 * SPARK_TARGET_Y - arcHeight
          const sparkScale = 1 + Math.sin(t3 * Math.PI) * 0.5

          if (sparkLineRef.current) {
            sparkLineRef.current.setAttribute("x1", (sparkX + 6).toString())
            sparkLineRef.current.setAttribute("y1", (sparkY - 8).toString())
            sparkLineRef.current.setAttribute("x2", sparkX.toString())
            sparkLineRef.current.setAttribute("y2", sparkY.toString())
          }
          if (sparkCircleRef.current) {
            sparkCircleRef.current.setAttribute("cx", sparkX.toString())
            sparkCircleRef.current.setAttribute("cy", sparkY.toString())
            sparkCircleRef.current.setAttribute("r", (3 * sparkScale).toString())
          }
        } else {
          sparkDetachedRef.current.style.display = "none"
        }
      }

      // --- PHASE 4: 2D WHITE VECTOR SPLASH (1.65s - 2.05s) ---
      const isSplashActive = progress >= 0.458 && progress < 0.569
      const splashProgress = isSplashActive ? (progress - 0.458) / 0.111 : 0

      if (splashGroupRef.current) {
        if (isSplashActive) {
          splashGroupRef.current.style.display = ""
          if (splashRingRef.current) {
            splashRingRef.current.setAttribute("rx", (splashProgress * 44).toString())
            splashRingRef.current.setAttribute("ry", (splashProgress * 14).toString())
            splashRingRef.current.setAttribute(
              "opacity",
              (splashProgress < 0.6 ? 1 : (1 - splashProgress) / 0.4).toString()
            )
          }

          SPLASH_DROPLETS.forEach((d, i) => {
            const el = dropletRefs.current[i]
            if (!el) return
            const rad = (d.angle * Math.PI) / 180
            const curDist = splashProgress * d.dist
            const curSize = Math.sin(splashProgress * Math.PI) * d.size
            const cx = Math.cos(rad) * curDist
            const cy = Math.sin(rad) * curDist * 0.45 - (1 - splashProgress) * 12
            el.setAttribute("cx", cx.toString())
            el.setAttribute("cy", cy.toString())
            el.setAttribute("r", Math.max(0.5, curSize).toString())
          })

          if (sparkle1Ref.current) {
            sparkle1Ref.current.setAttribute("cx", (-18 * splashProgress).toString())
            sparkle1Ref.current.setAttribute("cy", (-22 * Math.sin(splashProgress * Math.PI)).toString())
            sparkle1Ref.current.setAttribute("r", (2.5 * (1 - splashProgress)).toString())
          }
          if (sparkle2Ref.current) {
            sparkle2Ref.current.setAttribute("cx", (20 * splashProgress).toString())
            sparkle2Ref.current.setAttribute("cy", (-26 * Math.sin(splashProgress * Math.PI)).toString())
            sparkle2Ref.current.setAttribute("r", (2.5 * (1 - splashProgress)).toString())
          }
        } else {
          splashGroupRef.current.style.display = "none"
        }
      }

      // Ground line
      if (groundLineRef.current) {
        groundLineRef.current.style.display = progress >= 0.458 ? "" : "none"
      }

      // --- PHASE 4 & 5: DOG & BIKE REVEAL, HELMET PULL, SADDLE JUMP & ZIP ---
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

      const vehicleActive = progress >= 0.458
      if (vehicleGroupRef.current) {
        vehicleGroupRef.current.style.display = vehicleActive ? "" : "none"
      }

      if (progress >= 0.458 && progress < 0.569) {
        // Phase 4: Dog births out from splash
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
        // Phase 5: Continuous physics choreography (2.05s - 3.60s)
        dogScale = 1
        dogOpacity = 1
        bikeOpacity = 1
        bikeOffsetX = 0

        const t5 = (progress - 0.569) / 0.431 // 0.0 -> 1.0

        // 1. Continuous Helmet Pull along quadratic Bézier curve (t5: 0.00 -> 0.35)
        if (t5 < 0.35) {
          helmetAttached = false
          const u = t5 / 0.35
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
          const c = (t5 - 0.35) / 0.07
          dogSquashY = 1 - c * 0.16
          dogY = 82 + c * 3.5
          dogX = 90
        } else if (t5 >= 0.42 && t5 < 0.65) {
          const j = (t5 - 0.42) / 0.23
          dogX = 90 + j * 58
          const parabola = 4 * j * (1 - j)
          dogY = 82 - parabola * 38
          dogSquashY = 1 + (0.5 - Math.abs(j - 0.5)) * 0.12
        } else if (t5 >= 0.65) {
          dogX = 148
          dogY = 78
          dogSquashY = 1
        }

        // 3. Damped Bike Suspension Dip on landing (t5: 0.65 -> 0.82)
        if (t5 >= 0.65 && t5 < 0.82) {
          const d = (t5 - 0.65) / 0.17
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

      if (vehicleActive) {
        if (vehicleGroupRef.current) {
          vehicleGroupRef.current.setAttribute("transform", `translate(${vehicleOffset}, 0)`)
        }
        if (shadowRef.current) {
          shadowRef.current.setAttribute("cy", (185 + bikeDipY * 0.4).toString())
          shadowRef.current.setAttribute("rx", progress >= 0.75 ? "85" : "75")
          shadowRef.current.setAttribute("fill-opacity", (0.12 * bikeOpacity).toString())
        }
        if (exhaustRef.current) {
          if (exhaustScale > 0) {
            exhaustRef.current.style.display = ""
            exhaustRef.current.setAttribute("transform", `translate(100, ${160 + bikeDipY}) scale(${exhaustScale})`)
            exhaustRef.current.setAttribute("opacity", exhaustOpacity.toString())
          } else {
            exhaustRef.current.style.display = "none"
          }
        }
        if (bikeRef.current) {
          bikeRef.current.setAttribute("transform", `translate(${130 + bikeOffsetX}, ${48 + bikeDipY})`)
          bikeRef.current.setAttribute("opacity", bikeOpacity.toString())
        }
        if (headlightRef.current) {
          headlightRef.current.style.display = progress >= 0.82 ? "" : "none"
        }
        if (dogGroupRef.current) {
          dogGroupRef.current.setAttribute(
            "transform",
            `translate(${dogX}, ${dogY + (progress >= 0.7 ? bikeDipY : 0)}) scale(${dogScale}, ${dogScale * dogSquashY})`
          )
          dogGroupRef.current.setAttribute("opacity", dogOpacity.toString())
        }
        if (standingLegsRef.current) {
          standingLegsRef.current.style.display = progress < 0.7 ? "" : "none"
        }
        if (ridingLegsRef.current) {
          ridingLegsRef.current.style.display = progress >= 0.7 ? "" : "none"
        }
        if (attachedHelmetRef.current) {
          attachedHelmetRef.current.style.display = helmetAttached ? "" : "none"
        }
        if (airborneHelmetRef.current) {
          if (!helmetAttached && progress >= 0.569) {
            airborneHelmetRef.current.style.display = ""
            airborneHelmetRef.current.setAttribute(
              "transform",
              `translate(${helmetX}, ${helmetY}) scale(${helmetScale}) rotate(${helmetRot})`
            )
          } else {
            airborneHelmetRef.current.style.display = "none"
          }
        }
      }
    }

    // 5. Delta-time based animation loop
    const step = (timestamp: number) => {
      try {
        if (!startTimeRef.current) startTimeRef.current = timestamp
        const elapsed = timestamp - startTimeRef.current
        const p = Math.min(Math.max(elapsed / TOTAL_DURATION, 0), 1)

        applyFrame(p)

        if (p < 1) {
          animFrameRef.current = requestAnimationFrame(step)
        } else {
          handleFinish()
        }
      } catch (err) {
        // Fail-safe: Any rendering error immediately finishes intro cleanly
        console.error("[ZENWAY EntryIntro] Animation error:", err)
        handleFinish()
      }
    }

    // Initial render pass
    applyFrame(0)
    animFrameRef.current = requestAnimationFrame(step)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current)
        safetyTimeoutRef.current = null
      }
    }
  }, [handleFinish, onComplete])

  if (isSkipped) return null

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--bg-canvas)] transition-opacity duration-200 select-none overflow-hidden"
      role="dialog"
      aria-label="ZENWAY Origin Intro Animation"
    >
      <div className="relative w-full max-w-2xl px-6 flex flex-col items-center">
        {/* Synchronized Vector Canvas (420 x 220) */}
        <div className="w-full flex items-center justify-center">
          <svg
            viewBox="0 0 420 220"
            className="w-full max-w-[560px] sm:max-w-[640px] h-auto overflow-hidden sm:overflow-visible drop-shadow-sm text-foreground"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Dynamic wordmark revelation clip-path */}
              <clipPath id="wordmark-reveal-clip">
                <rect ref={wordmarkClipRef} x="42" y="0" width="0" height="40" />
              </clipPath>

              {/* Spark Glow filter */}
              <filter id="spark-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor={MASCOT_COLORS.vermilion} floodOpacity="0.5" />
              </filter>
            </defs>

            {/* Ground Line & Contact Marks */}
            <path
              ref={groundLineRef}
              style={{ display: "none" }}
              d="M20 185h380"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray="6 6"
              strokeOpacity="0.22"
            />

            {/* ================================================================= */}
            {/* PHASES 1 & 2: CUT-RIBBON Z BRAND MARK & WORDMARK EMERGENCE       */}
            {/* ================================================================= */}
            <g
              ref={logoGroupRef}
              id="brand-origin-logo"
              transform="translate(190, 75) scale(0.4)"
              opacity="0"
              style={{ display: "none" }}
            >
              {/* Cut-Ribbon Z Mark Geometry (40x40 local space) */}
              <g id="cut-ribbon-z-geometry">
                <path d="M6 8H22L17 14.5H6V8Z" fill="currentColor" />
                <path d="M25.5 8H34L20 25.5H34V32H6L25.5 8Z" fill="currentColor" />
                <circle ref={sparkAttachedRef} cx="8.5" cy="21" r="3" fill={MASCOT_COLORS.vermilion} />
              </g>

              {/* Lowercase "zenway" Wordmark sliding out from clip mask */}
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
                <circle cx="138" cy="24.5" r="3" fill={MASCOT_COLORS.vermilion} />
              </g>
            </g>

            {/* ================================================================= */}
            {/* PHASE 3: VERMILION SPARK FLYING ALONG PARABOLIC BOUNCE ARC       */}
            {/* ================================================================= */}
            <g ref={sparkDetachedRef} id="detached-kinetic-spark" filter="url(#spark-glow)" style={{ display: "none" }}>
              <line
                ref={sparkLineRef}
                x1="162.5"
                y1="95.3"
                x2="156.5"
                y2="103.3"
                stroke={MASCOT_COLORS.vermilion}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeOpacity="0.4"
              />
              <circle ref={sparkCircleRef} cx="156.5" cy="103.3" r="3" fill={MASCOT_COLORS.vermilion} />
            </g>

            {/* ================================================================= */}
            {/* PHASE 4: 2D FLAT PURE-WHITE VECTOR SPLASH (AT GROUND IMPACT)     */}
            {/* ================================================================= */}
            <g ref={splashGroupRef} id="vector-splash" transform="translate(90, 175)" style={{ display: "none" }}>
              {/* Expanding White Shockwave Ring */}
              <ellipse
                ref={splashRingRef}
                cx="0"
                cy="0"
                rx="0"
                ry="0"
                fill={MASCOT_COLORS.white}
                stroke={MASCOT_COLORS.outline}
                strokeWidth="2.5"
                opacity="1"
              />

              {/* 8 Crisp 2D White Radial Vector Droplets */}
              {SPLASH_DROPLETS.map((_, i) => (
                <circle
                  key={i}
                  ref={(el) => {
                    dropletRefs.current[i] = el
                  }}
                  cx="0"
                  cy="0"
                  r="0.5"
                  fill={MASCOT_COLORS.white}
                  stroke={MASCOT_COLORS.outline}
                  strokeWidth="1.8"
                />
              ))}

              {/* Micro Vermilion Sparkles rebounding from impact */}
              <circle ref={sparkle1Ref} cx="0" cy="0" r="0" fill={MASCOT_COLORS.vermilion} />
              <circle ref={sparkle2Ref} cx="0" cy="0" r="0" fill={MASCOT_COLORS.vermilion} />
            </g>

            {/* ================================================================= */}
            {/* PHASE 4 & 5: PARKED / MOVING SCOOTER & FLUSH DOG MASCOT          */}
            {/* ================================================================= */}
            <g ref={vehicleGroupRef} style={{ display: "none" }}>
              {/* Bike Ground Shadow */}
              <ellipse
                ref={shadowRef}
                cx="210"
                cy="185"
                rx="75"
                ry="6"
                fill={MASCOT_COLORS.outline}
                fillOpacity="0.12"
              />

              {/* Exhaust Puffs (Only during Rev/Zip in Phase 5) */}
              <g ref={exhaustRef} id="exhaust" style={{ display: "none" }}>
                <circle cx="-10" cy="-2" r="5" fill={MASCOT_COLORS.cream} stroke={MASCOT_COLORS.outline} strokeWidth="1.5" />
                <circle cx="-20" cy="-6" r="7" fill={MASCOT_COLORS.cream} stroke={MASCOT_COLORS.outline} strokeWidth="1.5" />
                <circle cx="-32" cy="-12" r="9" fill={MASCOT_COLORS.cream} stroke={MASCOT_COLORS.outline} strokeWidth="1.5" />
              </g>

              {/* Scooter Body */}
              <g ref={bikeRef} id="bike" transform="translate(130, 48)">
                {/* Wheels */}
                <g id="rear-wheel">
                  <circle cx="20" cy="116" r="19" fill={MASCOT_COLORS.cream} stroke={MASCOT_COLORS.outline} strokeWidth="3" />
                  <circle cx="20" cy="116" r="11" fill={MASCOT_COLORS.outline} />
                  <circle cx="20" cy="116" r="4" fill={MASCOT_COLORS.cream} />
                </g>
                <g id="front-wheel">
                  <circle cx="136" cy="116" r="19" fill={MASCOT_COLORS.cream} stroke={MASCOT_COLORS.outline} strokeWidth="3" />
                  <circle cx="136" cy="116" r="11" fill={MASCOT_COLORS.outline} />
                  <circle cx="136" cy="116" r="4" fill={MASCOT_COLORS.cream} />
                </g>

                {/* Frame & Vermilion Bodywork */}
                <path
                  d="M20 116h42l28-24 38-2 10 26"
                  stroke={MASCOT_COLORS.outline}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M136 116l-14-56 6-4" stroke={MASCOT_COLORS.outline} strokeWidth="3.5" strokeLinecap="round" />
                <path d="M120 56h20" stroke={MASCOT_COLORS.outline} strokeWidth="4" strokeLinecap="round" />
                <rect x="134" y="53" width="7" height="6" rx="2" fill={MASCOT_COLORS.vermilion} />

                {/* Vermilion Fairing */}
                <path
                  d="M50 96c0-6 6-12 14-12h26c8 0 14 6 14 12l-8 18H58l-8-18z"
                  fill={MASCOT_COLORS.vermilion}
                  stroke={MASCOT_COLORS.outline}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />

                {/* Saddle */}
                <path
                  d="M38 84c0-4 4-7 12-7h24c6 0 10 3 10 7 0 2-4 4-10 4H50c-8 0-12-2-12-4z"
                  fill={MASCOT_COLORS.outline}
                />

                {/* Headlight beam */}
                <polygon
                  ref={headlightRef}
                  points="144,58 220,40 220,86 144,66"
                  fill={MASCOT_COLORS.vermilion}
                  fillOpacity="0.14"
                  style={{ display: "none" }}
                />
              </g>

              {/* The White Dog Mascot */}
              <g ref={dogGroupRef} id="dog-group" transform="translate(90, 82)">
                {/* Tail */}
                <path d="M-6 24c-6-6-10-2-12 4" stroke={MASCOT_COLORS.outline} strokeWidth="3" strokeLinecap="round" />

                {/* Sage Backpack */}
                <g id="dog-backpack">
                  <rect
                    x="-6"
                    y="4"
                    width="14"
                    height="22"
                    rx="4"
                    fill={MASCOT_COLORS.sage}
                    stroke={MASCOT_COLORS.outline}
                    strokeWidth="2.5"
                  />
                  <path d="-4 10h10" stroke={MASCOT_COLORS.outline} strokeWidth="1.5" />
                  <rect x="-1" y="13" width="4" height="4" rx="1" fill={MASCOT_COLORS.cream} stroke={MASCOT_COLORS.outline} strokeWidth="1.2" />
                </g>

                {/* Dog Torso */}
                <path
                  d="M6 30c-2-12 2-26 14-28 10-1 14 8 16 16l2 20c0 2-2 4-5 4H10c-3 0-4-2-4-4z"
                  fill={MASCOT_COLORS.white}
                  stroke={MASCOT_COLORS.outline}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />

                {/* Standing Legs */}
                <g ref={standingLegsRef}>
                  <path d="M10 40v14M22 40v14" stroke={MASCOT_COLORS.outline} strokeWidth="3" strokeLinecap="round" />
                  <ellipse cx="10" cy="54" rx="4" ry="2" fill={MASCOT_COLORS.white} stroke={MASCOT_COLORS.outline} strokeWidth="2" />
                  <ellipse cx="22" cy="54" rx="4" ry="2" fill={MASCOT_COLORS.white} stroke={MASCOT_COLORS.outline} strokeWidth="2" />
                </g>

                {/* Riding Legs */}
                <g ref={ridingLegsRef} style={{ display: "none" }}>
                  <path d="M30 18l32-4" stroke={MASCOT_COLORS.outline} strokeWidth="3.5" strokeLinecap="round" />
                  <ellipse cx="62" cy="14" rx="3.5" ry="3" fill={MASCOT_COLORS.white} stroke={MASCOT_COLORS.outline} strokeWidth="2" />
                  <ellipse cx="16" cy="42" rx="5" ry="3.5" fill={MASCOT_COLORS.white} stroke={MASCOT_COLORS.outline} strokeWidth="2" />
                </g>

                {/* Head */}
                <circle cx="24" cy="-10" r="16" fill={MASCOT_COLORS.white} stroke={MASCOT_COLORS.outline} strokeWidth="2.5" />

                {/* Snout & Smile */}
                <path
                  d="M34 -8c4 0 7 2 7 5 0 3-4 5-8 5h-4"
                  fill={MASCOT_COLORS.white}
                  stroke={MASCOT_COLORS.outline}
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <circle cx="41" cy="-5" r="2.5" fill={MASCOT_COLORS.outline} />
                <circle cx="30" cy="-14" r="2.2" fill={MASCOT_COLORS.outline} />
                <circle cx="31" cy="-15" r="0.8" fill={MASCOT_COLORS.white} />

                {/* Floppy Ear */}
                <path
                  d="M12 -14c-4 4-4 12 1 15 3 2 6-1 5-6"
                  fill={MASCOT_COLORS.white}
                  stroke={MASCOT_COLORS.outline}
                  strokeWidth="2"
                />

                {/* Attached helmet */}
                <g ref={attachedHelmetRef} id="attached-helmet" style={{ display: "none" }}>
                  <path
                    d="M12 -16c0-10 7-16 16-16s16 6 16 16c0 2-1 3-3 3H15c-2 0-3-1-3-3z"
                    fill={MASCOT_COLORS.vermilion}
                    stroke={MASCOT_COLORS.outline}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M24 -24h16c2 0 3 2 3 3s-1 3-3 3H24"
                    fill={MASCOT_COLORS.outline}
                    stroke={MASCOT_COLORS.outline}
                    strokeWidth="1.5"
                  />
                  <path d="M27 -22h9" stroke={MASCOT_COLORS.sage} strokeWidth="1" strokeLinecap="round" />
                  <path d="M16 -15l3 8" stroke={MASCOT_COLORS.outline} strokeWidth="2" strokeLinecap="round" />
                </g>
              </g>

              {/* AIRBORNE HELMET (Continuous Bézier flight before lock) */}
              <g ref={airborneHelmetRef} id="airborne-helmet" style={{ display: "none" }}>
                <path
                  d="M-12 -16c0-10 7-16 16-16s16 6 16 16c0 2-1 3-3 3H-9c-2 0-3-1-3-3z"
                  fill={MASCOT_COLORS.vermilion}
                  stroke={MASCOT_COLORS.outline}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M0 -24h16c2 0 3 2 3 3s-1 3-3 3H0"
                  fill={MASCOT_COLORS.outline}
                  stroke={MASCOT_COLORS.outline}
                  strokeWidth="1.5"
                />
                <path d="M3 -22h9" stroke={MASCOT_COLORS.sage} strokeWidth="1" strokeLinecap="round" />
              </g>
            </g>
          </svg>
        </div>

        {/* Dynamic Storytelling Micro-Caption */}
        <div className="mt-5 text-center flex flex-col items-center">
          <div className="font-heading text-xl sm:text-2xl font-extrabold tracking-tight text-foreground flex items-center justify-center gap-2">
            <span>ZENWAY</span>
            <span className="size-2 rounded-full bg-primary animate-ping" />
          </div>
          <p ref={captionRef} className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
            Precision Campus Mobility System
          </p>
        </div>
      </div>

      {/* Skip button with accessible touch target */}
      <button
        type="button"
        onClick={handleSkip}
        className="fixed bottom-6 right-6 z-50 text-xs font-semibold px-3.5 py-1.5 rounded-full border border-border/80 bg-card/80 backdrop-blur-md text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs touch-manipulation active:scale-95"
        aria-label="Skip intro animation"
      >
        Skip →
      </button>
    </div>
  )
}
