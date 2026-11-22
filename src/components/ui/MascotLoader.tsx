import * as React from "react"
import { motion, AnimatePresence } from "motion/react"
import { ZenwayMascot } from "./ZenwayMascot"
import { MASCOT_COLORS, prefersReducedMotion } from "./mascotConstants"

interface MascotLoaderProps {
  message?: string
  className?: string
  fullscreen?: boolean
  minDuration?: number
  onMinDurationElapsed?: () => void
}

const campusQuotes = [
  "Warming up the engines...",
  "Finding your way around...",
  "Checking the available rides...",
  "Getting things ready...",
  "Almost ready. Let's roll!",
]

/**
 * MascotLoader:
 * Displays the 2D white dog mascot in vermilion helmet cruising smoothly along an infinite road,
 * with bold ZENWAY brand title and rotating friendly campus micro-copy underneath.
 * Supports configurable message props, reduced-motion accessibility, and optional minimum duration.
 */
export function MascotLoader({
  message,
  className = "",
  fullscreen = true,
  minDuration = 0,
  onMinDurationElapsed,
}: MascotLoaderProps) {
  const [quoteIndex, setQuoteIndex] = React.useState(0)
  const isReducedMotion = React.useMemo(() => prefersReducedMotion(), [])

  React.useEffect(() => {
    if (message) return

    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % campusQuotes.length)
    }, 2200)

    return () => clearInterval(interval)
  }, [message])

  React.useEffect(() => {
    if (!onMinDurationElapsed) return
    if (minDuration <= 0) {
      onMinDurationElapsed()
      return
    }
    const timer = setTimeout(() => {
      onMinDurationElapsed()
    }, minDuration)
    return () => clearTimeout(timer)
  }, [minDuration, onMinDurationElapsed])

  const content = (
    <div
      className={`flex flex-col items-center justify-center p-6 text-center select-none ${className}`}
      role="status"
      aria-live="polite"
      aria-label={message || campusQuotes[quoteIndex]}
    >
      {/* Scaled Cruiser Animation Container */}
      <div className="relative flex flex-col items-center">
        {/* Bobbing Mascot on Scooter */}
        <motion.div
          animate={
            isReducedMotion
              ? { y: 0, rotate: 0 }
              : {
                  y: [0, -5, 0, -3, 0],
                  rotate: [0, 0.6, 0, -0.6, 0],
                }
          }
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative z-10"
        >
          <ZenwayMascot pose="riding" size={240} className="w-64 sm:w-80 h-auto drop-shadow-xs" />
        </motion.div>

        {/* Infinite Scrolling Road */}
        <div className="w-72 sm:w-96 h-4 overflow-hidden relative -mt-3 flex items-center justify-center">
          <motion.div
            animate={isReducedMotion ? { x: 0 } : { x: [0, -40] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              ease: "linear",
            }}
            className="flex items-center gap-2.5 whitespace-nowrap"
          >
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                className="inline-block w-5 h-1.5 rounded-full bg-border"
              />
            ))}
          </motion.div>
        </div>
      </div>

      {/* Brand Title */}
      <div className="mt-5 text-center">
        <div className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center justify-center gap-2.5">
          <svg
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="size-7 sm:size-8 shrink-0 text-foreground"
            aria-hidden="true"
          >
            {/* Top horizontal bar with crisp 45-degree ribbon cut */}
            <path d="M6 8H22L17 14.5H6V8Z" fill="currentColor" />
            {/* Continuous bold diagonal sweep + bottom bar */}
            <path d="M25.5 8H34L20 25.5H34V32H6L25.5 8Z" fill="currentColor" />
            {/* Single separated Signal Vermilion kinetic spark */}
            <circle cx="8.5" cy="21" r="3" fill={MASCOT_COLORS.vermilion} />
          </svg>
          <span>ZENWAY</span>
          <span className="size-2 rounded-full bg-primary animate-ping" />
        </div>
      </div>

      {/* Rotating Campus Micro-copy */}
      <div className="mt-2 h-7 flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={message || campusQuotes[quoteIndex]}
            initial={isReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={isReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="text-sm sm:text-base font-medium tracking-wide text-muted-foreground"
          >
            {message || campusQuotes[quoteIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-xl transition-colors">
        {content}
      </div>
    )
  }

  return content
}
