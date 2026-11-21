import * as React from "react"
import { motion, type Variants } from "motion/react"
import {
  KeyRound,
  Car,
  Package,
  ShieldCheck,
  Clock,
  ArrowRight,
  QrCode,
  Activity,
  CheckCircle2,
  Navigation,
  ChevronRight,
  Bell,
  ShieldAlert,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import { ZenwayMascot } from "@/components/ui/ZenwayMascot"
import { EASE_APPLE } from "@/lib/motion"
import type { NavTab } from "@/components/layout/Header"

interface AuthenticatedHomeProps {
  onNavigate: (tab: NavTab) => void
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE_APPLE },
  },
}

export function AuthenticatedHome({ onNavigate }: AuthenticatedHomeProps) {
  const { user, profile, isVerified, isPending } = useAuth()
  const { navigate } = useRouter()

  // Null-safe first name extraction
  const displayName = (() => {
    if (profile?.full_name?.trim()) {
      return profile.full_name.trim().split(" ")[0]
    }
    if (user?.email) {
      return user.email.split("@")[0]
    }
    return "Rider"
  })()

  // Time-based greeting
  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  })()

  // Query pending incoming exchange requests awaiting current user action
  const [pendingCounts, setPendingCounts] = React.useState<{
    rent: number
    ride: number
    carry: number
  }>({ rent: 0, ride: 0, carry: 0 })

  React.useEffect(() => {
    if (!user) return
    let isMounted = true

    async function checkPendingRequests() {
      try {
        // 1. Rent: pending requests on my vehicles
        const { data: userVehicles } = await supabase
          .from("vehicles")
          .select("id")
          .eq("owner_id", user!.id)
        const vehicleIds = (userVehicles || []).map((v) => v.id)
        let rentCount = 0
        if (vehicleIds.length > 0) {
          const { count } = await supabase
            .from("rental_requests")
            .select("id", { count: "exact", head: true })
            .in("vehicle_id", vehicleIds)
            .eq("status", "pending")
          rentCount = count || 0
        }

        // 2. Ride: pending requests on my rides
        const { data: userRides } = await supabase
          .from("rides")
          .select("id")
          .eq("driver_id", user!.id)
        const rideIds = (userRides || []).map((r) => r.id)
        let rideCount = 0
        if (rideIds.length > 0) {
          const { count } = await supabase
            .from("ride_requests")
            .select("id", { count: "exact", head: true })
            .in("ride_id", rideIds)
            .eq("status", "pending")
          rideCount = count || 0
        }

        // 3. Carry: pending offers on my open carry requests
        const { data: userCarries } = await supabase
          .from("carry_requests")
          .select("id")
          .eq("requester_id", user!.id)
          .eq("status", "open")
        const carryIds = (userCarries || []).map((c) => c.id)
        let carryCount = 0
        if (carryIds.length > 0) {
          const { count } = await supabase
            .from("carry_offers")
            .select("id", { count: "exact", head: true })
            .in("request_id", carryIds)
            .eq("status", "pending")
          carryCount = count || 0
        }

        if (isMounted) {
          setPendingCounts({ rent: rentCount, ride: rideCount, carry: carryCount })
        }
      } catch (err) {
        console.error("[AuthenticatedHome] Check pending error:", err)
      }
    }

    checkPendingRequests()
    return () => {
      isMounted = false
    }
  }, [user])

  const totalPending = pendingCounts.rent + pendingCounts.ride + pendingCounts.carry

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-6xl mx-auto space-y-6 pt-2 pb-16 px-4 sm:px-6"
    >
      {/* 1. PERSONALIZED CAMPUS HEADER */}
      <motion.div
        variants={itemVariants}
        className="rounded-3xl border border-border/80 bg-gradient-to-r from-card via-card to-secondary/30 p-6 sm:p-8 relative overflow-hidden shadow-xs"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-xl">
            {/* Status Chip */}
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-semibold backdrop-blur-xs">
              <span className="size-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
              <span className="text-foreground">
                {profile?.university_name?.trim() || "Campus Mobility Hub"}
              </span>
              {isVerified ? (
                <span className="inline-flex items-center gap-1 text-[var(--accent-secondary)] font-bold text-[11px] ml-1">
                  <ShieldCheck className="size-3.5" />
                  Verified
                </span>
              ) : isPending ? (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold text-[11px] ml-1">
                  <Clock className="size-3.5" />
                  Review Pending
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate("/verify-student")}
                  className="inline-flex items-center gap-1 text-[var(--accent-primary)] font-bold text-[11px] ml-1 cursor-pointer hover:underline"
                >
                  Verify ID →
                </button>
              )}
            </div>

            {/* Personalized Headline */}
            <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              {greeting}, {displayName}!
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Where are you heading today? Borrow peer wheels, carpool to save on fuel, or get essentials ferried across campus.
            </p>
          </div>

          {/* Mascot Quick Peek */}
          <div className="hidden lg:flex items-center justify-center shrink-0">
            <ZenwayMascot pose="riding" size={130} />
          </div>
        </div>
      </motion.div>

      {/* ACTION REQUIRED: PENDING PEER REQUESTS ALERT */}
      {totalPending > 0 && (
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="size-4.5 animate-bounce" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold text-sm text-foreground">Action Required: Pending Peer Requests</span>
                  <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[10px] px-2 py-0.2">
                    {totalPending} waiting
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {pendingCounts.rent > 0 && `${pendingCounts.rent} rental request${pendingCounts.rent > 1 ? "s" : ""}`}
                  {pendingCounts.rent > 0 && (pendingCounts.ride > 0 || pendingCounts.carry > 0) && " · "}
                  {pendingCounts.ride > 0 && `${pendingCounts.ride} ride reservation${pendingCounts.ride > 1 ? "s" : ""}`}
                  {(pendingCounts.rent > 0 || pendingCounts.ride > 0) && pendingCounts.carry > 0 && " · "}
                  {pendingCounts.carry > 0 && `${pendingCounts.carry} carry offer${pendingCounts.carry > 1 ? "s" : ""}`}
                  {" "}awaiting your confirmation.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              {pendingCounts.rent > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate("rent")}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                >
                  Manage Rentals
                </button>
              )}
              {pendingCounts.ride > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate("ride")}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                >
                  Manage Rides
                </button>
              )}
              {pendingCounts.carry > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate("carry")}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                >
                  Manage Carry
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* UNVERIFIED STUDENT ONBOARDING PROMPT */}
      {!isVerified && (
        <motion.div
          variants={itemVariants}
          className={`rounded-2xl border p-4 sm:p-5 shadow-xs ${
            isPending
              ? "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200"
              : "border-primary/30 bg-primary/5 text-foreground"
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`size-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  isPending ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-primary/20 text-primary"
                }`}
              >
                {isPending ? <Clock className="size-4.5" /> : <ShieldAlert className="size-4.5" />}
              </div>
              <div className="space-y-0.5">
                <h3 className="font-heading font-bold text-sm text-foreground">
                  {isPending ? "Student ID Under Campus Review" : "Unlock Full Campus Mobility Access"}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                  {isPending
                    ? "Your student credentials have been submitted and are currently being reviewed by campus administration (typically 12–24 business hours). You will receive an in-app alert when approved."
                    : "Student verification is required to borrow peer vehicles, reserve carpool seats, and request deliveries on ZENWAY. Submit your university ID card to get verified."}
                </p>
              </div>
            </div>

            <div className="shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => navigate(isPending ? "/verification-status" : "/verify-student")}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-semibold cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>{isPending ? "View Verification Standing" : "Complete Student Verification"}</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* 2. PRIMARY 3-WAY ACTION DOCK */}
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Campus Commute Services</span>
            <span className="text-xs font-mono font-normal text-muted-foreground">0% Platform Fee</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {/* Card 1: RENT */}
          <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onNavigate("rent")}
            className="group cursor-pointer rounded-3xl border border-border/80 bg-card p-6 flex flex-col justify-between hover:border-[var(--accent-primary)]/50 transition-all shadow-xs relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="size-12 rounded-2xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <KeyRound className="size-6" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-foreground">
                  Fleet
                </span>
              </div>

              <div>
                <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-[var(--accent-primary)] transition-colors">
                  Rent a Vehicle
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Cycles, e-bikes & scooties rented directly from peers for hours or full semesters.
                </p>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between border-t border-border/60 mt-4">
              <span className="text-xs font-medium text-foreground">Explore available rides</span>
              <div className="size-8 rounded-full bg-[var(--accent-primary)] text-[var(--bg-surface)] flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ArrowRight className="size-4" />
              </div>
            </div>
          </motion.div>

          {/* Card 2: RIDE */}
          <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onNavigate("ride")}
            className="group cursor-pointer rounded-3xl border border-border/80 bg-card p-6 flex flex-col justify-between hover:border-[var(--text-primary)]/50 transition-all shadow-xs relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="size-12 rounded-2xl bg-[var(--text-primary)]/10 text-foreground flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Car className="size-6" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-foreground">
                  Share
                </span>
              </div>

              <div>
                <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  Share a Ride
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Join or offer empty seats for trips to metro, train stations, airport, or markets.
                </p>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between border-t border-border/60 mt-4">
              <span className="text-xs font-medium text-foreground">Find or post route</span>
              <div className="size-8 rounded-full bg-foreground text-background flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ArrowRight className="size-4" />
              </div>
            </div>
          </motion.div>

          {/* Card 3: CARRY */}
          <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onNavigate("carry")}
            className="group cursor-pointer rounded-3xl border border-border/80 bg-card p-6 flex flex-col justify-between hover:border-[var(--accent-secondary)]/70 transition-all shadow-xs relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="size-12 rounded-2xl bg-[var(--accent-secondary)]/25 text-foreground flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Package className="size-6" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-foreground">
                  Drop
                </span>
              </div>

              <div>
                <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  Carry & Logistics
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Get parcels, lab supplies, or canteen takeaway delivered safely to your campus gate.
                </p>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between border-t border-border/60 mt-4">
              <span className="text-xs font-medium text-foreground">Request delivery</span>
              <div className="size-8 rounded-full bg-secondary text-foreground flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ArrowRight className="size-4" />
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* 3. QUICK ACCESS & LIVE SUMMARY STRIP */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* UPI Payment Status */}
        <div
          onClick={() => onNavigate("profile")}
          className="rounded-2xl border border-border/80 bg-card/70 p-4 flex items-center justify-between cursor-pointer hover:border-primary/40 transition-colors shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <QrCode className="size-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">
                {profile?.upi_id ? "UPI Connected" : "Link UPI ID"}
              </div>
              <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                {profile?.upi_id ? profile.upi_id : "For 1-click payouts"}
              </div>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>

        {/* Active Activity Hub */}
        <div
          onClick={() => onNavigate("activity")}
          className="rounded-2xl border border-border/80 bg-card/70 p-4 flex items-center justify-between cursor-pointer hover:border-primary/40 transition-colors shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Activity className="size-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">My Activity</div>
              <div className="text-[11px] text-muted-foreground">Requests & Bookings</div>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>

        {/* Verified Student Standing */}
        <div
          onClick={() => navigate("/verification-status")}
          className="rounded-2xl border border-border/80 bg-card/70 p-4 flex items-center justify-between cursor-pointer hover:border-primary/40 transition-colors shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[var(--accent-secondary)]/25 text-foreground flex items-center justify-center">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Campus Trust</div>
              <div className="text-[11px] text-muted-foreground">5.0 ★ Standing</div>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>

        {/* Direct Landmark Handoff */}
        <div className="rounded-2xl border border-border/80 bg-card/70 p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-secondary text-foreground flex items-center justify-center">
              <Navigation className="size-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Safe Handoff</div>
              <div className="text-[11px] text-muted-foreground">Hostel & Main Gates</div>
            </div>
          </div>
          <CheckCircle2 className="size-4 text-emerald-500" />
        </div>
      </motion.div>
    </motion.div>
  )
}
