import { motion, type Variants } from "motion/react"
import {
  KeyRound,
  Car,
  Package,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Clock,
  Sparkles,
  Phone,
  Send,
  Lock,
  Bike,
  Zap,
  Users,
  ChevronRight,
  Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ZenwayLogo } from "@/components/brand/ZenwayLogo"
import type { NavTab } from "@/components/layout/Header"
import { useRouter } from "@/context/RouterContext"
import { useAuth } from "@/context/AuthContext"
import { EASE_APPLE, DURATION } from "@/lib/motion"

interface HomeLandingProps {
  onNavigate: (tab: NavTab) => void
}

// ----------------------------------------------------------------------------
// Motion Variants for Staggered Hero Entrance and Scroll Reveals
// ----------------------------------------------------------------------------
const heroContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
}

const heroItemVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: EASE_APPLE,
    },
  },
}

const sectionRevealVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: EASE_APPLE,
    },
  },
}

export function HomeLanding({ onNavigate }: HomeLandingProps) {
  const { navigate } = useRouter()
  const { user, isVerified, isPending, isUnverified } = useAuth()

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth" })
    }
  }

  const handleGetStarted = () => {
    if (!user) {
      navigate("/register")
    } else if (isUnverified) {
      navigate("/verify-student")
    } else if (isPending) {
      navigate("/verification-status")
    } else {
      onNavigate("rent")
    }
  }

  return (
    <div className="space-y-24 sm:space-y-32 lg:space-y-40 pt-2 pb-16 overflow-x-hidden">
      {/* =========================================================================
          1. HERO SECTION (Supahero & 21st.dev Style Editorial Layout)
         ========================================================================= */}
      <section className="relative min-h-[calc(90vh-4.5rem)] flex flex-col justify-center py-6 sm:py-12 border-b border-border/50">
        {/* Subtle Ambient Background Mesh */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-30 dark:opacity-15 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,#000_60%,transparent_100%)]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, var(--color-border) 1.2px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        <motion.div
          variants={heroContainerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-10 sm:space-y-12"
        >
          {/* Top Pill, Editorial Display Headline & Value Proposition */}
          <div className="max-w-4xl mx-auto text-center space-y-6">
            {/* Campus Mobility Pill Badge */}
            <motion.div variants={heroItemVariants} className="inline-flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-[var(--accent-secondary)]/20 px-4 py-1 text-xs font-semibold text-foreground backdrop-blur-xs">
                <span className="size-2 rounded-full bg-primary" />
                <span className="tracking-tight uppercase text-[10px] tracking-[0.1em]">Verified Campus Peer Mobility</span>
                <span className="text-muted-foreground/60">•</span>
                <span className="text-muted-foreground text-[10px] tracking-[0.05em] uppercase hidden sm:inline">Zero Platform Cuts</span>
              </div>
            </motion.div>

            {/* Massive Display Headline */}
            <motion.h1
              variants={heroItemVariants}
              className="font-heading text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight sm:tracking-tighter text-foreground leading-[1.02]"
            >
              Campus mobility, <br />
              <span className="text-primary">
                reimagined for peers.
              </span>
            </motion.h1>

            {/* Crisp 2-line Subheading */}
            <motion.p
              variants={heroItemVariants}
              className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto font-normal"
            >
              Rent bicycles and scooters from verified classmates, split rides on daily commutes, and coordinate campus deliveries—with automated approvals and direct WhatsApp handoffs.
            </motion.p>

            {/* High-Contrast Action CTAs */}
            <motion.div
              variants={heroItemVariants}
              className="flex flex-wrap items-center justify-center gap-3.5 pt-2"
            >
              <motion.button
                type="button"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGetStarted}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary hover:bg-primary/95 text-primary-foreground font-semibold px-8 py-3.5 text-sm sm:text-base shadow-md hover:shadow-xl transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>{user ? (isVerified ? "Explore Fleet" : "Complete Verification") : "Get Started Free"}</span>
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => scrollToSection("services")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border/80 hover:bg-muted/70 text-foreground font-medium px-7 py-3.5 text-sm sm:text-base transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring backdrop-blur-xs"
              >
                <span>Explore Services</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </motion.button>
            </motion.div>

            {/* Clean Proof Metrics Strip */}
            <motion.div
              variants={heroItemVariants}
              className="grid grid-cols-3 gap-6 pt-6 max-w-lg mx-auto border-t border-border/50 text-left"
            >
              <div className="space-y-0.5">
                <span className="font-mono text-xl sm:text-2xl font-bold text-foreground">100%</span>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">Student Verified</p>
              </div>
              <div className="space-y-0.5">
                <span className="font-mono text-xl sm:text-2xl font-bold text-primary">3 Modes</span>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">Rent, Ride &amp; Carry</p>
              </div>
              <div className="space-y-0.5">
                <span className="font-mono text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">Direct</span>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">WhatsApp Handoff</p>
              </div>
            </motion.div>
          </div>

          {/* Framed Cinematic Hero Visual Showcase (Real Campus Mobility Photograph) */}
          <motion.div
            variants={heroItemVariants}
            className="relative mx-auto max-w-5xl rounded-3xl border border-border/80 bg-card/60 p-2 sm:p-3 shadow-2xl backdrop-blur-xs overflow-hidden group"
          >
            <div className="relative overflow-hidden rounded-2xl aspect-16/9 sm:aspect-21/9 bg-muted/20">
              <img
                src="/assets/img/photo-f29678913-960.jpg"
                alt="Student bicycle mobility on campus"
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                loading="eager"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent pointer-events-none" />

              {/* High-Fidelity Bottom Telemetry Bar */}
              <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-semibold text-foreground border border-border/60 shadow-xs">
                    <MapPin className="size-3.5 text-primary" />
                    Central Campus • Engineering Quad
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 bg-background/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground border border-border/50">
                    <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    ID Verified Station
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg shadow-xs">
                    From ₹15/hr
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* =========================================================================
          2. THREE-SERVICE MODERN BENTO GRID (21st.dev Style Architecture)
         ========================================================================= */}
      <section id="services" className="space-y-12 scroll-mt-24">
        <motion.div
          variants={sectionRevealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="text-center max-w-2xl mx-auto space-y-3"
        >
          <Badge variant="outline" className="font-mono text-[11px] uppercase tracking-wider text-primary border-primary/25 bg-primary/5">
            Core Exchange Ecosystem
          </Badge>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
            Three services, one unified campus network
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Everything you need to commute, explore, and move essentials across university grounds.
          </p>
        </motion.div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Bento Card 1 (Major Anchor - Span 7): RENT Vehicles */}
          <motion.div
            variants={sectionRevealVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            whileHover={{ y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE_APPLE }}
            className="lg:col-span-7 flex flex-col justify-between rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/5 p-7 sm:p-9 shadow-xs hover:border-primary/50 hover:shadow-lg transition-all group"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-2xs">
                  <KeyRound className="size-6" />
                </div>
                <span className="font-mono text-xs font-bold uppercase text-primary tracking-widest bg-primary/10 px-3 py-1 rounded-full">
                  01 / RENT
                </span>
              </div>

              <div className="space-y-2.5">
                <h3 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground group-hover:text-primary transition-colors">
                  Peer Vehicle Sharing
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                  Rent bicycles, e-scooters, and shared vehicles directly from verified classmates for fast commutes between hostel blocks, campus gates, and academic quads.
                </p>
              </div>

              {/* Tag Badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-muted/80 px-3 py-1.5 rounded-lg text-foreground border border-border/60">
                  <Bike className="size-3.5 text-primary" />
                  Bicycles (₹15/hr)
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-muted/80 px-3 py-1.5 rounded-lg text-foreground border border-border/60">
                  <Zap className="size-3.5 text-amber-500" />
                  Campus E-Scooters
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-muted/80 px-3 py-1.5 rounded-lg text-foreground border border-border/60">
                  <Car className="size-3.5 text-blue-500" />
                  Shared Cars
                </span>
              </div>

              {/* Feature Points */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary shrink-0" />
                  <span>Student hourly or daily rates</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary shrink-0" />
                  <span>Direct peer UPI settlements</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary shrink-0" />
                  <span>Safe landmark key meetups</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary shrink-0" />
                  <span>Condition inspection checklist</span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              <Button
                onClick={() => onNavigate("rent")}
                className="w-full sm:w-auto justify-between sm:justify-start gap-3 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold px-6 h-11 rounded-xl cursor-pointer shadow-xs transition-all"
              >
                <span>Browse Vehicles</span>
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>

          {/* Bento Card 2 (Upper Right - Span 5): RIDE Carpool */}
          <motion.div
            variants={sectionRevealVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            whileHover={{ y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE_APPLE }}
            className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-emerald-500/5 p-7 sm:p-9 shadow-xs hover:border-emerald-500/50 hover:shadow-lg transition-all group"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-2xs">
                  <Car className="size-6" />
                </div>
                <span className="font-mono text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300 tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">
                  02 / RIDE
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="font-heading text-2xl font-extrabold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Campus Carpool
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Heading to transit hubs, railway stations, or off-campus housing? Discover empty seats in student rides and split travel costs cleanly.
                </p>
              </div>

              {/* Route Matching Snippet */}
              <div className="p-3.5 rounded-xl border border-border/70 bg-muted/40 space-y-2 text-xs">
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <div className="flex items-center gap-1.5">
                    <Users className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Hostel 7 &rarr; Metro Station</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">₹40/seat</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Departure: Today, 5:30 PM</span>
                  <span>2 seats open</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button
                variant="outline"
                onClick={() => onNavigate("ride")}
                className="w-full justify-between border-border hover:border-emerald-500/40 hover:bg-emerald-500/5 text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 font-semibold px-5 h-11 rounded-xl cursor-pointer transition-all"
              >
                <span>Find Carpools</span>
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>

          {/* Bento Card 3 (Lower Left - Span 5): CARRY Peer Item Delivery */}
          <motion.div
            variants={sectionRevealVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            whileHover={{ y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE_APPLE }}
            className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-[var(--accent-secondary)]/10 p-7 sm:p-9 shadow-xs hover:border-[var(--accent-secondary)]/60 hover:shadow-lg transition-all group"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="size-12 rounded-2xl bg-[var(--accent-secondary)]/20 text-foreground flex items-center justify-center border border-[var(--accent-secondary)]/30 shadow-2xs">
                  <Package className="size-6" />
                </div>
                <span className="font-mono text-xs font-bold uppercase text-foreground tracking-widest bg-[var(--accent-secondary)]/20 px-3 py-1 rounded-full">
                  03 / CARRY
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="font-heading text-2xl font-extrabold text-foreground group-hover:text-primary transition-colors">
                  Peer Parcel Transport
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Need library textbooks picked up, dorm items transported, or lab gear moved? Coordinate small deliveries with students already walking your route.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-xs font-medium bg-muted/60 px-3 py-1 rounded-lg text-foreground">
                  Library Books
                </span>
                <span className="text-xs font-medium bg-muted/60 px-3 py-1 rounded-lg text-foreground">
                  Lab Equipment
                </span>
                <span className="text-xs font-medium bg-muted/60 px-3 py-1 rounded-lg text-foreground">
                  Dorm Packages
                </span>
              </div>
            </div>

            <div className="pt-6">
              <Button
                variant="outline"
                onClick={() => onNavigate("carry")}
                className="w-full justify-between border-border hover:border-[var(--accent-secondary)]/50 hover:bg-[var(--accent-secondary)]/10 text-foreground hover:text-primary font-semibold px-5 h-11 rounded-xl cursor-pointer transition-all"
              >
                <span>Explore Deliveries</span>
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>

          {/* Bento Card 4 (Lower Right - Span 7): CAMPUS PRIVACY & SECURE RPC HANDOFF */}
          <motion.div
            variants={sectionRevealVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            whileHover={{ y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE_APPLE }}
            className="lg:col-span-7 flex flex-col justify-between rounded-3xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 p-7 sm:p-9 shadow-xs hover:border-emerald-500/50 hover:shadow-lg transition-all"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <Lock className="size-3.5" />
                  <span>Privacy-First Architecture</span>
                </div>
                <span className="font-mono text-xs font-bold text-muted-foreground">
                  PostgreSQL RPC Definer
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="font-heading text-2xl font-extrabold text-foreground">
                  Anti-Scraping Contact Protection
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Student phone numbers and WhatsApp links remain strictly encrypted and confidential until an exchange request is formally accepted by the owner. No scrapers, no spam, and zero public data leaks.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-background/60 border border-border/60 space-y-1">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Send className="size-3 text-emerald-600 dark:text-emerald-400" />
                    Instant Email Alerts
                  </span>
                  <p className="text-[11px] text-muted-foreground">Automated database email notifications trigger immediately.</p>
                </div>
                <div className="p-3 rounded-xl bg-background/60 border border-border/60 space-y-1">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Phone className="size-3 text-emerald-600 dark:text-emerald-400" />
                    WhatsApp Handoff
                  </span>
                  <p className="text-[11px] text-muted-foreground">1-click direct peer coordination for campus meetups.</p>
                </div>
                <div className="p-3 rounded-xl bg-background/60 border border-border/60 space-y-1">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
                    Verified Campus ID
                  </span>
                  <p className="text-[11px] text-muted-foreground">College ID verified before listing privileges activate.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =========================================================================
          3. HOW IT WORKS (Connected 3-Step Linear Flow)
         ========================================================================= */}
      <section id="how-it-works" className="space-y-12 scroll-mt-24 border-t border-border/50 pt-16 sm:pt-20">
        <motion.div
          variants={sectionRevealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="text-center max-w-xl mx-auto space-y-3"
        >
          <Badge variant="outline" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            End-to-End Workflow
          </Badge>
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            How ZENWAY operates
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            From search to campus meetup in three simple, privacy-first steps.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Step 1 */}
          <motion.div
            variants={sectionRevealVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            whileHover={{ y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE_APPLE }}
            className="p-7 rounded-3xl border border-border/80 bg-card space-y-5 shadow-xs relative"
          >
            <div className="flex items-center justify-between">
              <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-mono font-bold text-sm border border-primary/20">
                01
              </div>
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider bg-primary/10 px-3 py-1 rounded-full">
                Step 1
              </span>
            </div>
            <div className="space-y-2">
              <h3 className="font-heading text-lg font-bold text-foreground">
                Request in Seconds
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Choose a bicycle, reserve a carpool seat, or post a parcel transport request. Specify your campus pickup spot with one click.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs text-muted-foreground font-medium border-t border-border/50">
              <Clock className="size-3.5 text-primary" />
              <span>Real-time availability filters</span>
            </div>
          </motion.div>

          {/* Step 2 */}
          <motion.div
            variants={sectionRevealVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            whileHover={{ y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE_APPLE }}
            className="p-7 rounded-3xl border border-border/80 bg-card space-y-5 shadow-xs relative"
          >
            <div className="flex items-center justify-between">
              <div className="size-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-mono font-bold text-sm border border-emerald-500/20">
                02
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider bg-emerald-500/10 px-3 py-1 rounded-full">
                Step 2
              </span>
            </div>
            <div className="space-y-2">
              <h3 className="font-heading text-lg font-bold text-foreground">
                Automated Email Approval
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                The listing owner receives an automated notification email via database webhook to approve or decline the exchange immediately.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs text-muted-foreground font-medium border-t border-border/50">
              <Send className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Instant Email Alerts</span>
            </div>
          </motion.div>

          {/* Step 3 */}
          <motion.div
            variants={sectionRevealVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            whileHover={{ y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE_APPLE }}
            className="p-7 rounded-3xl border border-border/80 bg-card space-y-5 shadow-xs relative"
          >
            <div className="flex items-center justify-between">
              <div className="size-11 rounded-2xl bg-[var(--accent-secondary)]/20 text-foreground flex items-center justify-center font-mono font-bold text-sm border border-[var(--accent-secondary)]/30">
                03
              </div>
              <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider bg-[var(--accent-secondary)]/20 px-3 py-1 rounded-full">
                Step 3
              </span>
            </div>
            <div className="space-y-2">
              <h3 className="font-heading text-lg font-bold text-foreground">
                Direct WhatsApp Handoff
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Upon acceptance, both students unlock verified phone contact details with 1-click WhatsApp messaging and direct calling for easy campus meetups.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs text-muted-foreground font-medium border-t border-border/50">
              <Phone className="size-3.5 text-primary" />
              <span>Anti-scraping RPC protection</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =========================================================================
          4. CAMPUS SAFETY & TRUST (Authentic Campus Photography Showcase)
         ========================================================================= */}
      <section id="trust-safety" className="space-y-6 scroll-mt-24 border-t border-border/50 pt-16 sm:pt-20">
        <motion.div
          variants={sectionRevealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="p-7 sm:p-10 lg:p-12 rounded-3xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 shadow-xs"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="size-4" />
                  <span>Safety &amp; Verified Identity</span>
                </div>
                <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
                  Peer accountability grounded in real student identity
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Anonymous profiles are strictly eliminated. Every member must upload official student identification, verified by campus administrators before exchange privileges activate.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Admin Review</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    ID card proof and campus standing are confirmed before users can list or book.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Mutual Ratings</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Two-sided reviews on vehicles, carpool punctuality, and deliveries.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <MapPin className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Landmark Meetups</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Exchanges take place at well-lit central campus spots like the Library or Transit Quad.
                  </p>
                </div>
              </div>
            </div>

            {/* Authentic Campus Mobility Photo */}
            <div className="lg:col-span-5">
              <div className="group relative overflow-hidden rounded-2xl border border-emerald-500/30 aspect-4/3 shadow-sm bg-muted/20">
                <img
                  src="/assets/img/photo-f89300022-960.jpg"
                  alt="Student campus mobility and transit handoff"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 bg-background/85 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] font-semibold text-foreground border border-border/60">
                    <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    Campus Verified Network
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* =========================================================================
          5. HIGH-CONTRAST CONVERSION CTA (CTA Gallery Style Frame)
         ========================================================================= */}
      <section className="scroll-mt-24">
        <motion.div
          variants={sectionRevealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="relative overflow-hidden rounded-3xl bg-foreground text-background p-8 sm:p-14 lg:p-16 shadow-2xl"
        >
          {/* Subtle Ambient Radial Glow */}
          <div
            aria-hidden="true"
            className="absolute -top-32 -right-32 size-96 rounded-full bg-primary/25 blur-3xl pointer-events-none"
          />

          <div className="relative z-10 max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-background/20 bg-background/10 px-3.5 py-1 text-xs font-semibold tracking-wider uppercase">
              <Sparkles className="size-3.5 text-primary" />
              <span>Campus Peer Transit</span>
            </div>

            <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.08]">
              Ready to move smarter across campus?
            </h2>

            <p className="text-sm sm:text-base text-background/80 leading-relaxed max-w-xl">
              Join verified students renting bicycles, sharing commutes, and coordinating deliveries. Free to sign up with your personal email.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <motion.button
                type="button"
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/register")}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-background text-foreground font-bold px-8 py-3.5 text-sm sm:text-base shadow-lg hover:bg-background/90 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>Create Student Account</span>
                <ArrowRight className="size-4" />
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/login")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-background/30 hover:bg-background/10 text-background font-medium px-6 py-3.5 text-sm sm:text-base transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>Sign In Instead</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* =========================================================================
          6. STARTUP FOOTER (Footer Design Style Multi-Column Grid)
         ========================================================================= */}
      <footer className="border-t border-border/80 pt-16 pb-8 space-y-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Info & Mission (Span 2 on LG) */}
          <div className="lg:col-span-2 space-y-4">
            <ZenwayLogo size="md" withBadge={false} />
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm">
              ZENWAY is the campus-exclusive peer mobility exchange. Built for verified university students to rent micro-vehicles, share carpools, and coordinate peer item transit.
            </p>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-mono">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Campus Operational</span>
            </div>
          </div>

          {/* Services Column */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Services
            </h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate("rent")}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  RENT Vehicles
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate("ride")}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  RIDE Carpool
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate("carry")}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  CARRY Delivery
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate("activity")}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  My Activity
                </button>
              </li>
            </ul>
          </div>

          {/* Platform Column */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Platform
            </h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("how-it-works")}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("trust-safety")}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  Safety &amp; ID Proof
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate("/help")}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  Help Center
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate("/contact")}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  Contact Support
                </button>
              </li>
            </ul>
          </div>

          {/* Account Column */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Account
            </h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              {!user ? (
                <>
                  <li>
                    <button
                      type="button"
                      onClick={() => navigate("/login")}
                      className="hover:text-primary transition-colors cursor-pointer"
                    >
                      Student Sign In
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => navigate("/register")}
                      className="hover:text-primary transition-colors cursor-pointer"
                    >
                      Create Account
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => navigate("/admin/login")}
                      className="hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Shield className="size-3 text-destructive" />
                      <span>Admin Portal</span>
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <button
                      type="button"
                      onClick={() => onNavigate("profile")}
                      className="hover:text-primary transition-colors cursor-pointer"
                    >
                      Student Profile
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => navigate("/verification-status")}
                      className="hover:text-primary transition-colors cursor-pointer"
                    >
                      Verification Status
                    </button>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Licence Credits Line (Taste Skill Rule 1: Licence credits go in one footer line) */}
        <div className="pt-4 border-t border-border/40 text-[11px] text-muted-foreground">
          <p>
            Photography: Tulane Public Relations &amp; Richard Masoner via Wikimedia Commons (CC BY 2.0 / CC BY-SA 2.0).
          </p>
        </div>

        {/* Bottom Bar: Copyright, Credits & Security Assurance */}
        <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <p>&copy; {new Date().getFullYear()} ZENWAY. Peer-to-peer student mobility exchange.</p>
            <span className="hidden sm:inline text-muted-foreground/40">•</span>
            <p className="text-[11px] font-mono text-muted-foreground/80">Engineered by Honnesh N Guptha</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <button type="button" onClick={() => navigate("/privacy")} className="hover:text-foreground cursor-pointer">
              Privacy
            </button>
            <button type="button" onClick={() => navigate("/terms")} className="hover:text-foreground cursor-pointer">
              Terms
            </button>
            <span className="font-mono text-muted-foreground/60">•</span>
            <span className="font-mono text-[10px]">Supabase Auth &amp; RLS Protected</span>
            <span className="font-mono text-muted-foreground/60">•</span>
            <span className="font-mono text-[10px]">Instant Email Alerts</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
