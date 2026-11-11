import { motion } from "motion/react"
import {
  KeyRound,
  Car,
  Package,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Compass,
  FileCheck2,
  Users2,
  Clock,
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
    <div className="space-y-16 sm:space-y-24 pt-2 pb-12 overflow-hidden">
      {/* =========================================================================
          1. HERO SECTION (Asymmetric 2-col desktop layout, verified mobility visual)
         ========================================================================= */}
      <section className="relative min-h-[calc(80vh-4rem)] flex flex-col justify-center py-6 sm:py-10 border-b border-border/60">
        {/* Subtle architectural urban grid background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-30 dark:opacity-20 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, var(--color-border) 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Editorial Headline, Explanation, CTAs & Trust Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.cinematic, ease: EASE_APPLE }}
            className="lg:col-span-7 space-y-6 sm:space-y-8"
          >
            {/* Verification Process Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: DURATION.normal, delay: 0.1, ease: EASE_APPLE }}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
            >
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Verified Student Community</span>
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </motion.div>

            {/* Editorial Display Headline */}
            <div className="space-y-3">
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
                Campus mobility, <br />
                <span className="text-primary bg-gradient-to-r from-primary to-primary/80 bg-clip-text">
                  engineered for students.
                </span>
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed max-w-xl font-normal pt-1">
                ZENWAY is a peer-to-peer campus mobility exchange. Rent shared bikes and vehicles, join student carpools along daily routes, or coordinate small parcel drop-offs—verified through student ID review.
              </p>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                size="lg"
                onClick={handleGetStarted}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 h-11 text-sm sm:text-base gap-2 cursor-pointer shadow-xs hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                <span>{user ? (isVerified ? "Explore Services" : "Complete Verification") : "Get Started"}</span>
                <ArrowRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => scrollToSection("how-it-works")}
                className="border-border hover:bg-muted/70 text-foreground px-6 h-11 text-sm sm:text-base cursor-pointer transition-colors"
              >
                How It Works
              </Button>
            </div>

            {/* Grounded Campus Trust Pillars (Metrics Strip) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-border/60">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary mt-0.5 shrink-0">
                  <FileCheck2 className="size-4" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-foreground">Student ID Verification</p>
                  <p className="text-muted-foreground mt-0.5 leading-normal">
                    Email sign-up with manual admin ID review.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-md bg-accent/10 text-accent mt-0.5 shrink-0">
                  <Compass className="size-4" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-foreground">3 Exchange Modes</p>
                  <p className="text-muted-foreground mt-0.5 leading-normal">
                    RENT vehicles, RIDE carpools, CARRY items.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-md bg-safety/10 text-safety mt-0.5 shrink-0">
                  <MapPin className="size-4" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-foreground">Campus Handoffs</p>
                  <p className="text-muted-foreground mt-0.5 leading-normal">
                    Meet at high-visibility campus landmarks.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Premium Mobility Visual Composition */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: DURATION.cinematic, delay: 0.15, ease: EASE_APPLE }}
            className="lg:col-span-5 relative"
          >
            <div className="relative mx-auto max-w-md lg:max-w-none rounded-2xl border border-border/80 bg-card/60 p-2 shadow-sm backdrop-blur-xs">
              <div className="relative aspect-4/3 sm:aspect-16/11 overflow-hidden rounded-xl bg-muted/40 border border-border/60">
                <img
                  src="/assets/img/photo-f89300022-960.jpg"
                  srcSet="/assets/img/photo-f89300022-500.jpg 500w, /assets/img/photo-f89300022-960.jpg 960w"
                  sizes="(max-width: 639px) 90vw, (max-width: 1023px) 80vw, 40vw"
                  width={960}
                  height={800}
                  alt="Student campus bike share commute across university grounds (Photo: Richard Masoner / Cyclelicious, CC BY-SA 2.0)"
                  title="Photo: Richard Masoner / Cyclelicious (CC BY-SA 2.0 via Wikimedia Commons)"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  data-source="stand-in"
                  data-subject="campus-mobility"
                  className="size-full object-cover object-center transition-transform duration-700 hover:scale-[1.03]"
                />

                {/* Visual Overlay Tag */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 via-background/50 to-transparent p-3 sm:p-4 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>Campus Transit Corridor</span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground bg-background/80 px-2 py-0.5 rounded border border-border/60">
                    Peer Mobility
                  </span>
                </div>
              </div>

              {/* Sub-card floating info strip */}
              <div className="mt-2.5 px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 text-primary" />
                  <span>Flexible hourly & route scheduling</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Student ID Check</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =========================================================================
          2. SERVICE DISCOVERY SECTION (Distinct visual identity for RENT, RIDE, CARRY)
         ========================================================================= */}
      <section id="services" className="space-y-8 scroll-mt-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: DURATION.normal, ease: EASE_APPLE }}
          className="space-y-2"
        >
          <Badge variant="outline" className="font-mono text-[11px] uppercase tracking-wider text-primary border-primary/25 bg-primary/5">
            Core Mobility Services
          </Badge>
          <h2 className="font-heading text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
            Three exchange services, one verified network
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
            Choose a service to explore peer-listed rentals, discover carpool commutes, or arrange item transfers.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: RENT — Blue Architecture */}
          <motion.div
            variants={cardInteractiveVariants}
            initial="initial"
            whileHover="hover"
            whileTap="tap"
            className="group relative flex flex-col justify-between rounded-xl border border-border/80 border-t-2 border-t-primary bg-card p-6 shadow-xs hover:border-primary/50 hover:shadow-md transition-all duration-200"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <KeyRound className="size-5" />
                </div>
                <span className="font-mono text-[11px] font-semibold uppercase text-primary tracking-widest bg-primary/10 px-2 py-0.5 rounded">
                  01 / RENT
                </span>
              </div>

              <div>
                <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  Vehicles & Micro-Mobility
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Rent bicycles, electric scooters, and shared vehicles directly from fellow students for hourly errands or full-day campus transit.
                </p>
              </div>

              {/* Service categories */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded text-foreground/80">
                  Bicycles
                </span>
                <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded text-foreground/80">
                  E-Scooters
                </span>
                <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded text-foreground/80">
                  Shared Cars
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>Student-listed bikes, e-scooters & cars</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>Hourly or daily peer arrangements</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>Key handoff at designated campus points</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button
                variant="outline"
                onClick={() => onNavigate("rent")}
                className="w-full justify-between border-border group-hover:border-primary/40 group-hover:bg-primary/5 text-foreground group-hover:text-primary cursor-pointer transition-all"
              >
                <span className="font-medium text-xs">Open RENT View</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>

          {/* Card 2: RIDE — Tangerine Architecture */}
          <motion.div
            variants={cardInteractiveVariants}
            initial="initial"
            whileHover="hover"
            whileTap="tap"
            className="group relative flex flex-col justify-between rounded-xl border border-border/80 border-t-2 border-t-accent bg-card p-6 shadow-xs hover:border-accent/50 hover:shadow-md transition-all duration-200"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-accent/10 text-accent border border-accent/20">
                  <Car className="size-5" />
                </div>
                <span className="font-mono text-[11px] font-semibold uppercase text-accent tracking-widest bg-accent/10 px-2 py-0.5 rounded">
                  02 / RIDE
                </span>
              </div>

              <div>
                <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-accent transition-colors">
                  Carpooling & Seat Sharing
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Heading to off-campus housing, the train station, or weekend study sessions? Discover empty seats in student rides and split travel expenses.
                </p>
              </div>

              {/* Service categories */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded text-foreground/80">
                  Campus Commute
                </span>
                <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded text-foreground/80">
                  Station Runs
                </span>
                <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded text-foreground/80">
                  Lab Transit
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-accent shrink-0" />
                  <span>Campus zone-to-zone route discovery</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-accent shrink-0" />
                  <span>Verified university student drivers</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-accent shrink-0" />
                  <span>Direct, transparent travel cost contribution</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button
                variant="outline"
                onClick={() => onNavigate("ride")}
                className="w-full justify-between border-border group-hover:border-accent/40 group-hover:bg-accent/5 text-foreground group-hover:text-accent cursor-pointer transition-all"
              >
                <span className="font-medium text-xs">Open RIDE View</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>

          {/* Card 3: CARRY — Emerald Architecture */}
          <motion.div
            variants={cardInteractiveVariants}
            initial="initial"
            whileHover="hover"
            whileTap="tap"
            className="group relative flex flex-col justify-between rounded-xl border border-border/80 border-t-2 border-t-safety bg-card p-6 shadow-xs hover:border-safety/50 hover:shadow-md transition-all duration-200"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-safety/10 text-safety border border-safety/20">
                  <Package className="size-5" />
                </div>
                <span className="font-mono text-[11px] font-semibold uppercase text-safety tracking-widest bg-safety/10 px-2 py-0.5 rounded">
                  03 / CARRY
                </span>
              </div>

              <div>
                <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-safety transition-colors">
                  Peer Item Delivery
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Need books collected from the library or lab supplies moved between campus buildings? Coordinate peer drop-offs with students walking that route.
                </p>
              </div>

              {/* Service categories */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded text-foreground/80">
                  Library Books
                </span>
                <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded text-foreground/80">
                  Lab Supplies
                </span>
                <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded text-foreground/80">
                  Dorm Gear
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-safety shrink-0" />
                  <span>On-campus peer delivery requests</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-safety shrink-0" />
                  <span>Clear sender-to-carrier handoff instructions</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-safety shrink-0" />
                  <span>Convenient for books, notes & lightweight supplies</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button
                variant="outline"
                onClick={() => onNavigate("carry")}
                className="w-full justify-between border-border group-hover:border-safety/40 group-hover:bg-safety/5 text-foreground group-hover:text-safety cursor-pointer transition-all"
              >
                <span className="font-medium text-xs">Open CARRY View</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =========================================================================
          3. HOW IT WORKS SECTION (Accurate student verification & exchange workflow)
         ========================================================================= */}
      <section id="how-it-works" className="space-y-8 scroll-mt-20 border-t border-border/60 pt-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: DURATION.normal, ease: EASE_APPLE }}
          className="space-y-2"
        >
          <Badge variant="outline" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Platform Workflow
          </Badge>
          <h2 className="font-heading text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
            How ZENWAY operates
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
            A clear step-by-step process designed for safety and convenience across university grounds.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            whileHover={{ y: -3 }}
            onClick={() => (!user ? navigate("/register") : navigate("/verify-student"))}
            className="p-6 rounded-xl border border-border/80 bg-card space-y-3 cursor-pointer hover:border-primary/40 transition-colors shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-bold text-primary">01</span>
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded">
                Action Required
              </span>
            </div>
            <h3 className="font-heading text-base font-semibold text-foreground">
              Register & Upload Student ID
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sign up using your personal email, then submit an official student ID photo or enrollment proof for administrative verification.
            </p>
          </motion.div>

          <div className="p-6 rounded-xl border border-border/80 bg-card space-y-3 shadow-xs">
            <span className="font-mono text-2xl font-bold text-primary">02</span>
            <h3 className="font-heading text-base font-semibold text-foreground">
              Admin Review & Access Unlock
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Once verified by campus administrators, your profile unlocks full access to list vehicles, join carpools, or create delivery requests.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-border/80 bg-card space-y-3 shadow-xs">
            <span className="font-mono text-2xl font-bold text-primary">03</span>
            <h3 className="font-heading text-base font-semibold text-foreground">
              Direct Campus Handshake
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Coordinate exchange details and meet peer students at designated, high-visibility campus landmark locations.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. TRUST & ACCOUNTABILITY SECTION (Refined vertical space, accurate claims)
         ========================================================================= */}
      <section id="trust-safety" className="space-y-6 scroll-mt-20 border-t border-border/60 pt-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: DURATION.normal, ease: EASE_APPLE }}
          className="p-6 sm:p-8 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/10 space-y-5"
        >
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="size-4" />
              <span>Trust & Accountability Model</span>
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Accountability grounded in verified identity
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              ZENWAY eliminates anonymous interaction by requiring every member to register and verify their student status before participating in campus exchanges.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                <FileCheck2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>Admin-Verified Student ID</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Users submit official student identification, manually reviewed and confirmed by administrators before exchange privileges activate.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                <Users2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>Peer Accountability Model</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Fosters mutual responsibility through verified real student identities and agreed terms during every in-person exchange.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                <MapPin className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>Public Campus Handoffs</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We encourage handoffs at well-lit, high-visibility campus landmarks such as student unions, library entrances, and transit shelters.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="italic">
              *Verification workflow: Personal email registration → Student ID verification by admin → Feature unlock.
            </span>
            <span className="font-mono text-emerald-700 dark:text-emerald-300 font-medium">
              Database security enforced via PostgreSQL RLS & strict grants.
            </span>
          </div>
        </motion.div>
      </section>

      {/* =========================================================================
          5. FOOTER (Clean closing multi-column layout, unverified claims removed)
         ========================================================================= */}
      <footer className="border-t border-border/80 pt-10 pb-6 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-3">
            <ZenwayLogo size="sm" withBadge={false} />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Campus mobility exchange platform designed for verified university students.
            </p>
            <div className="text-[11px] text-muted-foreground pt-0.5">
              Student Peer Exchange System
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

          {/* Technical Architecture */}
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
          {/* Campus & Community Help */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Community & Safety
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <button
                  type="button"
                  onClick={() => navigate("/help")}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  Help Center & FAQs
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate("/contact")}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  Campus Operations Desk
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate("/privacy")}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  Privacy Policy & ID Data
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate("/terms")}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  Terms of Service
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} ZENWAY. Peer-to-peer student mobility exchange.</p>
          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <button type="button" onClick={() => navigate("/help")} className="hover:text-foreground cursor-pointer">Help</button>
            <button type="button" onClick={() => navigate("/contact")} className="hover:text-foreground cursor-pointer">Contact</button>
            <button type="button" onClick={() => navigate("/privacy")} className="hover:text-foreground cursor-pointer">Privacy</button>
            <button type="button" onClick={() => navigate("/terms")} className="hover:text-foreground cursor-pointer">Terms</button>
            <span className="font-mono text-muted-foreground/60">•</span>
            <span className="font-mono">Supabase Auth & RLS Protected</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
