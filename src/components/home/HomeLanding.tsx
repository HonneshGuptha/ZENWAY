import { motion } from "motion/react"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ZenwayLogo } from "@/components/brand/ZenwayLogo"
import type { NavTab } from "@/components/layout/Header"
import { useRouter } from "@/context/RouterContext"
import { useAuth } from "@/context/AuthContext"
import {
  cardInteractiveVariants,
  EASE_APPLE,
  DURATION,
} from "@/lib/motion"

interface HomeLandingProps {
  onNavigate: (tab: NavTab) => void
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
      scrollToSection("services")
    }
  }

  return (
    <div className="space-y-24 sm:space-y-32 lg:space-y-40 pt-2 pb-16 overflow-hidden">
      {/* =========================================================================
          1. HERO SECTION (High-Contrast, Editorial, Real Campus Mobility Visual)
         ========================================================================= */}
      <section className="relative min-h-[calc(88vh-4rem)] flex flex-col justify-center py-8 sm:py-14 border-b border-border/60">
        {/* Subtle geometric dot grid background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-35 dark:opacity-20 [mask-image:radial-gradient(ellipse_65%_50%_at_50%_40%,#000_70%,transparent_100%)]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, var(--color-border) 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Column: Headline, Subheading, CTAs & Proof Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.cinematic, ease: EASE_APPLE }}
            className="lg:col-span-7 space-y-6 sm:space-y-8"
          >
            {/* Campus Verification Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 px-3.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 shadow-xs">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="tracking-tight">Verified Campus Peer Mobility</span>
            </div>

            {/* Editorial Display Headline */}
            <div className="space-y-3.5">
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.07]">
                Campus mobility, <br />
                <span className="text-primary bg-gradient-to-r from-primary via-emerald-600 to-teal-500 bg-clip-text text-transparent">
                  built for students.
                </span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl font-normal pt-1">
                ZENWAY connects verified classmates to share bicycles and vehicles, carpool on daily commutes, and coordinate small campus deliveries—with automated email approvals and direct WhatsApp handoffs.
              </p>
            </div>

            {/* Primary & Secondary Action Buttons */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <Button
                size="lg"
                onClick={handleGetStarted}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-7 h-12 text-sm sm:text-base gap-2 cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                <span>{user ? (isVerified ? "Explore Services" : "Complete Verification") : "Get Started"}</span>
                <ArrowRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => scrollToSection("services")}
                className="border-border hover:bg-muted/70 text-foreground px-6 h-12 text-sm sm:text-base cursor-pointer transition-colors"
              >
                Explore Services
              </Button>
            </div>

            {/* Key Assurance Metrics Strip */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border/60 max-w-lg">
              <div className="space-y-0.5">
                <span className="font-mono text-xl sm:text-2xl font-bold text-foreground">100%</span>
                <p className="text-xs text-muted-foreground leading-tight">Student ID Verified</p>
              </div>
              <div className="space-y-0.5">
                <span className="font-mono text-xl sm:text-2xl font-bold text-primary">3 Modes</span>
                <p className="text-xs text-muted-foreground leading-tight">Rent, Ride & Carry</p>
              </div>
              <div className="space-y-0.5">
                <span className="font-mono text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">Direct</span>
                <p className="text-xs text-muted-foreground leading-tight">WhatsApp Handoff</p>
              </div>
            </div>
          </motion.div>

          {/* Right Column: High-Fidelity Exchange Dispatch & Real Campus Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: DURATION.cinematic, delay: 0.15, ease: EASE_APPLE }}
            className="lg:col-span-5 relative"
          >
            <div className="relative mx-auto max-w-md lg:max-w-none rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-lg backdrop-blur-md space-y-4">
              {/* Header Badge Strip */}
              <div className="flex items-center justify-between pb-3 border-b border-border/60 text-xs">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-foreground">Live Exchange Dispatch</span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/50">
                  Campus Peer-to-Peer
                </span>
              </div>

              {/* Real Campus Mobility Photograph (Anti-Slop Visual) */}
              <div className="group relative overflow-hidden rounded-xl border border-border/70 bg-muted/20 aspect-video">
                <img
                  src="/assets/img/photo-f29678913-960.jpg"
                  alt="Student bicycle mobility on campus"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs text-foreground font-medium">
                  <span className="inline-flex items-center gap-1.5 bg-background/80 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] font-semibold border border-border/60">
                    <MapPin className="size-3 text-primary" />
                    Central Campus • Engineering Quad
                  </span>
                  <span className="font-mono text-[11px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded shadow-xs">
                    ₹15/hr
                  </span>
                </div>
              </div>

              {/* Sample Active Listing Snapshot */}
              <div className="p-3.5 rounded-xl border border-border/70 bg-muted/30 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <KeyRound className="size-3.5 text-primary" />
                      <span>Hero Sprint 21-Speed Bicycle</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                      <Clock className="size-3 text-muted-foreground" />
                      <span>Today, 4:00 PM – 8:00 PM (4 hrs)</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    accepted
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40 font-mono text-muted-foreground">
                  <span>Owner: Aarav Sharma (Hostel 7)</span>
                  <span className="font-bold text-foreground">Total: ₹60</span>
                </div>
              </div>

              {/* Simulated Post-Acceptance Contact Reveal Card */}
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Verified Contact Reveal</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium">
                    Unlocked
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">Aarav Sharma</span>
                  <span className="font-mono text-xs text-muted-foreground">+91 98450 •••••</span>
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <div className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-[#25D366] text-white text-xs font-semibold shadow-xs">
                    <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.531 1.761.815 2.796.815 3.181 0 5.767-2.586 5.768-5.766 0-3.18-2.586-5.766-5.768-5.766zm9.969 5.766c0 5.518-4.482 10-10 10-1.745 0-3.376-.449-4.795-1.233l-5.205 1.365 1.391-5.077c-.886-1.488-1.391-3.23-1.391-5.055 0-5.518 4.482-10 10-10 5.518 0 10 4.482 10 10z"/>
                    </svg>
                    <span>Chat on WhatsApp</span>
                  </div>
                  <div className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-border/80 bg-background text-foreground text-xs font-semibold">
                    <Phone className="size-3 text-muted-foreground" />
                    <span>Call Peer</span>
                  </div>
                </div>
              </div>

              {/* Security Footnote */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                <span className="flex items-center gap-1">
                  <Lock className="size-3 text-emerald-600" />
                  <span>Hidden before approval</span>
                </span>
                <span className="font-mono text-[10px]">PostgreSQL RPC Definer</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =========================================================================
          2. THREE-SERVICE SHOWCASE (Clean, Structured, Distinct Value Props)
         ========================================================================= */}
      <section id="services" className="space-y-12 scroll-mt-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: DURATION.normal, ease: EASE_APPLE }}
          className="text-center max-w-2xl mx-auto space-y-3"
        >
          <Badge variant="outline" className="font-mono text-[11px] uppercase tracking-wider text-primary border-primary/25 bg-primary/5">
            Core Exchange Ecosystem
          </Badge>
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Three services, one verified student network
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Engineered exclusively for university campuses. Choose a service to rent peer transport, share rides, or deliver packages.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Service 1: RENT — Vehicles & Micro-Mobility */}
          <motion.div
            variants={cardInteractiveVariants}
            initial="initial"
            whileHover="hover"
            whileTap="tap"
            className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs hover:border-primary/50 hover:shadow-md transition-all duration-300"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                  <KeyRound className="size-5" />
                </div>
                <span className="font-mono text-[11px] font-semibold uppercase text-primary tracking-widest bg-primary/10 px-2.5 py-0.5 rounded-full">
                  01 / RENT
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  Vehicle Rental
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Rent bicycles, electric scooters, and shared vehicles directly from verified campus peers for fast commutes between hostels and academic blocks.
                </p>
              </div>

              {/* Tag Badges */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] font-medium bg-muted/60 px-2.5 py-1 rounded-md text-foreground">
                  Bicycles
                </span>
                <span className="text-[11px] font-medium bg-muted/60 px-2.5 py-1 rounded-md text-foreground">
                  E-Scooters
                </span>
                <span className="text-[11px] font-medium bg-muted/60 px-2.5 py-1 rounded-md text-foreground">
                  Motorcycles
                </span>
              </div>

              {/* Feature Points */}
              <div className="space-y-2.5 pt-3 border-t border-border/60 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>Student-listed hourly or daily pricing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>Direct peer UPI settlements (zero cuts)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>Safe key handoff at campus landmarks</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button
                variant="outline"
                onClick={() => onNavigate("rent")}
                className="w-full justify-between border-border group-hover:border-primary/40 group-hover:bg-primary/5 text-foreground group-hover:text-primary cursor-pointer transition-all h-10 text-xs font-semibold"
              >
                <span>Browse Vehicles</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>

          {/* Service 2: RIDE — Campus Carpool */}
          <motion.div
            variants={cardInteractiveVariants}
            initial="initial"
            whileHover="hover"
            whileTap="tap"
            className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all duration-300"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <Car className="size-5" />
                </div>
                <span className="font-mono text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-300 tracking-widest bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                  02 / RIDE
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Campus Carpool
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Heading to the train station, airport, or off-campus housing? Discover empty seats in student rides and split travel expenses cleanly.
                </p>
              </div>

              {/* Tag Badges */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] font-medium bg-muted/60 px-2.5 py-1 rounded-md text-foreground">
                  Daily Commute
                </span>
                <span className="text-[11px] font-medium bg-muted/60 px-2.5 py-1 rounded-md text-foreground">
                  Station Runs
                </span>
                <span className="text-[11px] font-medium bg-muted/60 px-2.5 py-1 rounded-md text-foreground">
                  Airport Sharing
                </span>
              </div>

              {/* Feature Points */}
              <div className="space-y-2.5 pt-3 border-t border-border/60 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Zone-to-zone campus route matching</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Verified university student drivers</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Fair per-seat cost contribution</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button
                variant="outline"
                onClick={() => onNavigate("ride")}
                className="w-full justify-between border-border group-hover:border-emerald-500/40 group-hover:bg-emerald-500/5 text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 cursor-pointer transition-all h-10 text-xs font-semibold"
              >
                <span>Find Carpools</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>

          {/* Service 3: CARRY — Peer Item Transport */}
          <motion.div
            variants={cardInteractiveVariants}
            initial="initial"
            whileHover="hover"
            whileTap="tap"
            className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs hover:border-teal-500/50 hover:shadow-md transition-all duration-300"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="size-11 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20">
                  <Package className="size-5" />
                </div>
                <span className="font-mono text-[11px] font-semibold uppercase text-teal-700 dark:text-teal-300 tracking-widest bg-teal-500/10 px-2.5 py-0.5 rounded-full">
                  03 / CARRY
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  Peer Item Delivery
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Need library textbooks picked up, dorm items transported, or lab gear moved? Coordinate small deliveries with students already walking your route.
                </p>
              </div>

              {/* Tag Badges */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] font-medium bg-muted/60 px-2.5 py-1 rounded-md text-foreground">
                  Library Books
                </span>
                <span className="text-[11px] font-medium bg-muted/60 px-2.5 py-1 rounded-md text-foreground">
                  Lab Gear
                </span>
                <span className="text-[11px] font-medium bg-muted/60 px-2.5 py-1 rounded-md text-foreground">
                  Dorm Parcels
                </span>
              </div>

              {/* Feature Points */}
              <div className="space-y-2.5 pt-3 border-t border-border/60 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>On-campus pickup and drop checkpoints</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>Clear token rewards for student couriers</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>Live delivery state: In-Transit & Delivered</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button
                variant="outline"
                onClick={() => onNavigate("carry")}
                className="w-full justify-between border-border group-hover:border-teal-500/40 group-hover:bg-teal-500/5 text-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400 cursor-pointer transition-all h-10 text-xs font-semibold"
              >
                <span>Explore Deliveries</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =========================================================================
          3. HOW IT WORKS STRIP (3-Step Linear Flow: Request → Approval → Handoff)
         ========================================================================= */}
      <section id="how-it-works" className="space-y-12 scroll-mt-20 border-t border-border/60 pt-16 sm:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: DURATION.normal, ease: EASE_APPLE }}
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
            whileHover={{ y: -3 }}
            transition={{ duration: DURATION.fast, ease: EASE_APPLE }}
            className="p-6 sm:p-7 rounded-2xl border border-border/80 bg-card space-y-4 shadow-xs relative"
          >
            <div className="flex items-center justify-between">
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-mono font-bold text-sm">
                01
              </div>
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider bg-primary/10 px-2.5 py-0.5 rounded-full">
                Step 1
              </span>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-heading text-base font-bold text-foreground">
                Request in Seconds
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Choose a bicycle, carpool seat, or post a parcel transport request. Specify your campus pickup spot and time with a single click.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/50">
              <Clock className="size-3.5 text-primary" />
              <span>Real-time availability filters</span>
            </div>
          </motion.div>

          {/* Step 2 */}
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ duration: DURATION.fast, ease: EASE_APPLE }}
            className="p-6 sm:p-7 rounded-2xl border border-border/80 bg-card space-y-4 shadow-xs relative"
          >
            <div className="flex items-center justify-between">
              <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-mono font-bold text-sm">
                02
              </div>
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                Step 2
              </span>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-heading text-base font-bold text-foreground">
                Instant Email Approval
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                The listing owner or driver immediately receives an automated notification email via database webhook to approve or decline the exchange.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/50">
              <Send className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Brevo Transactional Dispatch</span>
            </div>
          </motion.div>

          {/* Step 3 */}
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ duration: DURATION.fast, ease: EASE_APPLE }}
            className="p-6 sm:p-7 rounded-2xl border border-border/80 bg-card space-y-4 shadow-xs relative"
          >
            <div className="flex items-center justify-between">
              <div className="size-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-mono font-bold text-sm">
                03
              </div>
              <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 uppercase tracking-wider bg-teal-500/10 px-2.5 py-0.5 rounded-full">
                Step 3
              </span>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-heading text-base font-bold text-foreground">
                Direct WhatsApp Handoff
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Upon acceptance, both students unlock verified phone contact details with one-click WhatsApp messaging and direct calling for easy campus meetups.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/50">
              <Phone className="size-3.5 text-teal-600 dark:text-teal-400" />
              <span>Anti-scraping RPC protection</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =========================================================================
          4. TRUST & CAMPUS ACCOUNTABILITY BANNER
         ========================================================================= */}
      <section id="trust-safety" className="space-y-6 scroll-mt-20 border-t border-border/60 pt-16 sm:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: DURATION.normal, ease: EASE_APPLE }}
          className="p-8 sm:p-10 lg:p-12 rounded-3xl border border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-950/20 space-y-6 shadow-xs"
        >
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="size-4" />
              <span>Safety & Verified Identity</span>
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Peer accountability grounded in real student identity
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Anonymous profiles are strictly eliminated. Every member must upload official student identification, verified by campus administrators before exchange privileges activate.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>Admin Student ID Review</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                ID card proof and campus standing are confirmed before users can post listings or accept bookings.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>Mutual Peer Ratings</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Two-sided reviews on vehicles, carpool reliability, and parcel deliveries maintain high community standards.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                <MapPin className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>Public Landmark Handoffs</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Exchanges take place at well-lit, central campus spots like the Student Union, Central Library, or Transit Plaza.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* =========================================================================
          5. FOOTER (With Taste-Skill Single Line Photo Credits)
         ========================================================================= */}
      <footer className="border-t border-border/80 pt-12 pb-6 space-y-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-3">
            <ZenwayLogo size="sm" withBadge={false} />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Campus mobility exchange platform designed for verified university students.
            </p>
            <div className="text-[11px] text-muted-foreground font-mono">
              Zero-Slop Peer Transit System
            </div>
          </div>

          {/* Core Services Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Services
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate("rent")}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  RENT Vehicles & Micro-Mobility
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate("ride")}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  RIDE Campus Carpool
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate("carry")}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  CARRY Peer Item Delivery
                </button>
              </li>
            </ul>
          </div>

          {/* Platform Standards */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Platform
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
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
                  Trust & Verification Model
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

          {/* Account & Security */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Account & Security
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
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
                      Register New Account
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <button
                      type="button"
                      onClick={() => navigate("/verification-status")}
                      className="hover:text-primary transition-colors cursor-pointer"
                    >
                      Verification Standing
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => onNavigate("profile")}
                      className="hover:text-primary transition-colors cursor-pointer"
                    >
                      Student Profile
                    </button>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Licence Credits Line (Taste Skill Rule 1: "Licence credits go in one footer line") */}
        <div className="pt-4 border-t border-border/40 text-[11px] text-muted-foreground">
          <p>
            Photography: Tulane Public Relations &amp; Richard Masoner via Wikimedia Commons (CC BY 2.0 / CC BY-SA 2.0).
          </p>
        </div>

        <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} ZENWAY. Peer-to-peer student mobility exchange.</p>
          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <button type="button" onClick={() => navigate("/help")} className="hover:text-foreground cursor-pointer">Help</button>
            <button type="button" onClick={() => navigate("/contact")} className="hover:text-foreground cursor-pointer">Contact</button>
            <button type="button" onClick={() => navigate("/privacy")} className="hover:text-foreground cursor-pointer">Privacy</button>
            <button type="button" onClick={() => navigate("/terms")} className="hover:text-foreground cursor-pointer">Terms</button>
            <span className="font-mono text-muted-foreground/60">•</span>
            <span className="font-mono">Supabase Auth &amp; RLS Protected</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
