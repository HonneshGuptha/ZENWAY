import type { Variants, Transition } from "motion/react"

// ============================================================================
// ZENWAY MOTION DESIGN SYSTEM
// Premium Apple & Automotive Inspired Easing & Timing Scales
// ============================================================================

export const EASE_APPLE = [0.16, 1, 0.3, 1] as const // Fluid decelerate
export const EASE_AUTOMOTIVE = [0.22, 1, 0.36, 1] as const // Controlled acceleration & settle
export const EASE_SPRING = { type: "spring", stiffness: 380, damping: 30 } as const

export const DURATION = {
  instant: 0.12,
  fast: 0.22,
  normal: 0.38,
  smooth: 0.55,
  cinematic: 0.8,
} as const

export const TRANSITION_SMOOTH: Transition = {
  duration: DURATION.normal,
  ease: EASE_APPLE,
}

export const TRANSITION_CINEMATIC: Transition = {
  duration: DURATION.cinematic,
  ease: EASE_AUTOMOTIVE,
}

// ----------------------------------------------------------------------------
// Reusable Animation Variants
// ----------------------------------------------------------------------------

export const pageTransitionVariants: Variants = {
  initial: { opacity: 0, y: 10, filter: "blur(4px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: DURATION.normal,
      ease: EASE_APPLE,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: "blur(3px)",
    transition: {
      duration: DURATION.fast,
      ease: EASE_APPLE,
    },
  },
}

export const fadeInVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: DURATION.normal, ease: EASE_APPLE },
  },
  exit: {
    opacity: 0,
    transition: { duration: DURATION.fast, ease: EASE_APPLE },
  },
}

export const fadeUpVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.smooth, ease: EASE_APPLE },
  },
}

export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
}

export const heroSequenceVariants: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.cinematic,
      ease: EASE_APPLE,
    },
  },
}

export const cardInteractiveVariants: Variants = {
  initial: { y: 0, scale: 1 },
  hover: {
    y: -4,
    scale: 1.01,
    transition: { duration: DURATION.fast, ease: EASE_APPLE },
  },
  tap: {
    y: 0,
    scale: 0.99,
    transition: { duration: DURATION.instant },
  },
}

export const buttonMotionProps = {
  whileHover: { scale: 1.015 },
  whileTap: { scale: 0.985 },
  transition: { duration: DURATION.instant, ease: EASE_APPLE },
}
