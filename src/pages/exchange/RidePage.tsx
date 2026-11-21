import * as React from "react"
import { motion } from "motion/react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Car,
  Search,
  Plus,
  Clock,
  ShieldCheck,
  Loader2,
  Star,
  Users,
  User,
  MapPin,
  MessageSquare,
  ShieldAlert,
  Navigation,
  QrCode,
} from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"
import { LocationPickerModal } from "@/components/location/LocationPickerModal"
import { CampusMap } from "@/components/location/CampusMap"
import { StudentPublicProfileModal } from "@/components/profile/StudentPublicProfileModal"
import { ReportModal } from "@/components/safety/ReportModal"
import { CancellationModal } from "@/components/exchange/CancellationModal"
import { DisputeModal } from "@/components/exchange/DisputeModal"
import { UPIPaymentModal } from "@/components/UPIPaymentModal"
import { ContactHandoffCard } from "@/components/ContactHandoffCard"
import { StatusBadge } from "@/components/ui/StatusBadge"

interface RideWithDriver {
  id: string
  driver_id: string
  origin_name: string
  destination_name: string
  departure_time: string
  total_seats: number
  available_seats: number
  price_per_seat: number
  notes: string | null
  status: "scheduled" | "in_progress" | "completed" | "cancelled"
  created_at: string
  driver?: {
    full_name: string | null
    university_name: string | null
    verification_status: string | null
    upi_id?: string | null
  }
}

interface RideRequestItem {
  id: string
  ride_id: string
  passenger_id: string
  seats_requested: number
  pickup_note: string | null
  status: "pending" | "accepted" | "rejected" | "cancelled"
  created_at: string
  ride?: {
    origin_name: string
    destination_name: string
    departure_time: string
    price_per_seat: number
    available_seats: number
    driver_id?: string
    driver?: {
      full_name?: string | null
      upi_id?: string | null
    } | null
  }
  passenger?: {
    full_name: string | null
    university_name: string | null
    upi_id?: string | null
  }
}

export function RidePage() {
  const { user, profile, isVerified } = useAuth()

  const [activeTab, setActiveTab] = React.useState<"browse" | "manage">("browse")
  const [rides, setRides] = React.useState<RideWithDriver[]>([])
  const [incomingRequests, setIncomingRequests] = React.useState<RideRequestItem[]>([])
  const [mySentRequests, setMySentRequests] = React.useState<RideRequestItem[]>([])
  const [myPublishedRides, setMyPublishedRides] = React.useState<RideWithDriver[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Publish Ride Modal
  const [isPublishModalOpen, setIsPublishModalOpen] = React.useState(false)
  const [isSubmittingRide, setIsSubmittingRide] = React.useState(false)
  const [origin, setOrigin] = React.useState("")
  const [destination, setDestination] = React.useState("")
  const [departureTime, setDepartureTime] = React.useState("")
  const [seats, setSeats] = React.useState("3")
  const [pricePerSeat, setPricePerSeat] = React.useState("50")
  const [rideNotes, setRideNotes] = React.useState("")

  // Join Ride Modal
  const [joiningRide, setJoiningRide] = React.useState<RideWithDriver | null>(null)
  const [seatsRequested, setSeatsRequested] = React.useState("1")
  const [joinNotes, setJoinNotes] = React.useState("")
  const [isSubmittingJoin, setIsSubmittingJoin] = React.useState(false)

  // Review Modal
  const [reviewRide, setReviewRide] = React.useState<RideRequestItem | null>(null)
  const [reviewRating, setReviewRating] = React.useState(5)
  const [reviewComment, setReviewComment] = React.useState("")
  const [isSubmittingReview, setIsSubmittingReview] = React.useState(false)

  // Location & Route Map & Profiles
  const [locationPickerTarget, setLocationPickerTarget] = React.useState<"origin" | "destination" | null>(null)
  const [viewProfileStudentId, setViewProfileStudentId] = React.useState<string | null>(null)
  const [reportTarget, setReportTarget] = React.useState<{ id: string; title: string; type: "user" | "ride" } | null>(null)
  const [routePreviewRide, setRoutePreviewRide] = React.useState<RideWithDriver | null>(null)

  // Cancellation & Dispute Modals
  const [cancelModalState, setCancelModalState] = React.useState<{ isOpen: boolean; requestId: string; title: string }>({
    isOpen: false,
    requestId: "",
    title: "",
  })
  const [disputeModalState, setDisputeModalState] = React.useState<{ isOpen: boolean; transactionId: string; respondentId: string; title: string }>({
    isOpen: false,
    transactionId: "",
    respondentId: "",
    title: "",
  })

  // UPI Payment Modal
  const [showUPI, setShowUPI] = React.useState(false)
  const [upiPaymentData, setUpiPaymentData] = React.useState<{ amount: number; txId: string; payeeName?: string; payeeUpi?: string | null }>({
    amount: 0,
    txId: "",
    payeeName: "Student Peer",
    payeeUpi: null,
  })

  // Fetch Available Rides
  const fetchRides = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("rides")
        .select(`
          id, driver_id, origin_name, destination_name, departure_time,
          available_seats, price_per_seat, notes, status, created_at,
          driver:public_profiles!rides_driver_id_fkey(full_name, university_name, verification_status, upi_id)
        `)
        .eq("status", "scheduled")
        .gt("available_seats", 0)
        .order("departure_time", { ascending: true })

      if (error) throw error

      const formatted: RideWithDriver[] = (data || []).map((r: any) => ({
        ...r,
        driver: Array.isArray(r.driver) ? r.driver[0] : r.driver,
      }))

      setRides(formatted)
    } catch (err: any) {
      console.error("[RidePage] Fetch rides error:", err)
      toast.error(err.message || "Failed to load carpools.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch User's Published Rides & Requests
  const fetchUserRides = React.useCallback(async () => {
    if (!user) return
    try {
      // My published rides
      const { data: myRides } = await supabase
        .from("rides")
        .select(`
          id, driver_id, origin_name, destination_name, departure_time,
          available_seats, price_per_seat, notes, status, created_at
        `)
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false })

      setMyPublishedRides((myRides || []) as RideWithDriver[])

      const myRideIds = (myRides || []).map((r) => r.id)
      if (myRideIds.length > 0) {
        const { data: incomingData } = await supabase
          .from("ride_requests")
          .select(`
            id, ride_id, passenger_id, seats_requested, pickup_note, status, created_at,
            ride:rides(origin_name, destination_name, departure_time, price_per_seat, available_seats, driver_id, driver:public_profiles!rides_driver_id_fkey(full_name, upi_id)),
            passenger:public_profiles!ride_requests_passenger_id_fkey(full_name, university_name, upi_id)
          `)
          .in("ride_id", myRideIds)
          .order("created_at", { ascending: false })

        setIncomingRequests((incomingData || []) as any)
      } else {
        setIncomingRequests([])
      }

      // My sent seat requests
      const { data: sentData } = await supabase
        .from("ride_requests")
        .select(`
          id, ride_id, passenger_id, seats_requested, pickup_note, status, created_at,
          ride:rides(origin_name, destination_name, departure_time, price_per_seat, available_seats, driver_id, driver:public_profiles!rides_driver_id_fkey(full_name, upi_id)),
          passenger:public_profiles!ride_requests_passenger_id_fkey(full_name, university_name, upi_id)
        `)
        .eq("passenger_id", user.id)
        .order("created_at", { ascending: false })

      setMySentRequests((sentData || []) as any)
    } catch (err: any) {
      console.error("[RidePage] Fetch user rides error:", err)
    }
  }, [user])

  React.useEffect(() => {
    fetchRides()
    if (user) {
      fetchUserRides()
    }
  }, [fetchRides, fetchUserRides, user])

  // Publish Ride Handler
  const handlePublishRide = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!isVerified) {
      toast.error("Student ID verification required before offering carpools.")
      return
    }
    if (!origin.trim() || !destination.trim() || !departureTime) {
      toast.error("Origin, destination, and departure time are required.")
      return
    }

    try {
      setIsSubmittingRide(true)
      const seatsCount = parseInt(seats, 10) || 3
      const { error } = await supabase.from("rides").insert({
        driver_id: user.id,
        origin_name: origin.trim(),
        destination_name: destination.trim(),
        departure_time: new Date(departureTime).toISOString(),
        total_seats: seatsCount,
        available_seats: seatsCount,
        price_per_seat: parseFloat(pricePerSeat) || 0,
        notes: rideNotes.trim() || null,
        status: "scheduled",
      })

      if (error) throw error

      toast.success("Carpool published! Students can now request seats.")
      setIsPublishModalOpen(false)
      setOrigin("")
      setDestination("")
      setDepartureTime("")
      setRideNotes("")
      await fetchRides()
      await fetchUserRides()
    } catch (err: any) {
      console.error("[RidePage] Publish ride error:", err)
      toast.error(err.message || "Failed to publish ride.")
    } finally {
      setIsSubmittingRide(false)
    }
  }

  // Join Ride Handler
  const handleConfirmJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !joiningRide) return
    if (!isVerified) {
      toast.error("Student ID verification required before reserving seats.")
      return
    }

    const seatsNum = parseInt(seatsRequested, 10) || 1
    if (seatsNum > joiningRide.available_seats) {
      toast.error(`Only ${joiningRide.available_seats} seats available.`)
      return
    }

    try {
      setIsSubmittingJoin(true)
      const { error } = await supabase.from("ride_requests").insert({
        ride_id: joiningRide.id,
        passenger_id: user.id,
        seats_requested: seatsNum,
        total_price: (joiningRide.price_per_seat || 0) * seatsNum,
        pickup_note: joinNotes.trim() || null,
        status: "pending",
      })

      if (error) throw error

      toast.success("Seat request sent! The driver will review and confirm.")
      setJoiningRide(null)
      setSeatsRequested("1")
      setJoinNotes("")
      await fetchUserRides()
      setActiveTab("manage")
    } catch (err: any) {
      console.error("[RidePage] Join request error:", err)
      toast.error(err.message || "Failed to request seat.")
    } finally {
      setIsSubmittingJoin(false)
    }
  }

  // Driver Action: Accept Request (Calls atomic accept_ride_request RPC)
  const handleAcceptRequest = async (requestId: string) => {
    try {
      setActionLoadingId(requestId)
      const { error } = await supabase.rpc("accept_ride_request", {
        p_request_id: requestId,
      })
      if (error) throw error
      toast.success("Passenger accepted! Seats decremented.")
      setIncomingRequests((prev) =>
        prev.map((req) => (req.id === requestId ? { ...req, status: "accepted" } : req))
      )
      await fetchUserRides()
      await fetchRides()
    } catch (err: any) {
      console.error("[RidePage] Accept request error:", err)
      toast.error(err.message || "Failed to accept seat request.")
    } finally {
      setActionLoadingId(null)
    }
  }

  // Driver Action: Reject Request
  const handleRejectRequest = async (requestId: string) => {
    try {
      setActionLoadingId(requestId)
      const { error } = await supabase
        .from("ride_requests")
        .update({ status: "rejected" })
        .eq("id", requestId)
      if (error) throw error
      toast.success("Seat request declined.")
      setIncomingRequests((prev) => prev.filter((req) => req.id !== requestId))
      await fetchUserRides()
    } catch (err: any) {
      console.error("[RidePage] Reject error:", err)
      toast.error(err.message || "Failed to reject request.")
    } finally {
      setActionLoadingId(null)
    }
  }

  // Complete Ride
  const handleCompleteRide = async (rideId: string) => {
    try {
      setActionLoadingId(rideId)
      const { error } = await supabase
        .from("rides")
        .update({ status: "completed" })
        .eq("id", rideId)
      if (error) throw error
      toast.success("Ride marked completed!")
      setMyPublishedRides((prev) =>
        prev.map((ride) => (ride.id === rideId ? { ...ride, status: "completed" } : ride))
      )
      setRides((prev) => prev.filter((ride) => ride.id !== rideId))
      await fetchUserRides()
      await fetchRides()
    } catch (err: any) {
      console.error("[RidePage] Complete error:", err)
      toast.error(err.message || "Failed to complete ride.")
    } finally {
      setActionLoadingId(null)
    }
  }



  // Review Submit
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !reviewRide) return

    try {
      setIsSubmittingReview(true)
      const revieweeId = reviewRide.passenger_id === user.id ? reviewRide.ride?.driver_id || user.id : reviewRide.passenger_id
      const { error } = await supabase.from("reviews").insert({
        reviewer_id: user.id,
        reviewee_id: revieweeId,
        exchange_type: "ride",
        ride_request_id: reviewRide.id,
        rating: reviewRating,
        comment: reviewComment.trim() || null,
      })
      if (error) throw error

      toast.success("Ride review submitted!")
      setReviewRide(null)
      setReviewComment("")
      setReviewRating(5)
    } catch (err: any) {
      console.error("[RidePage] Review submit error:", err)
      toast.error(err.message || "Failed to submit review.")
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const filteredRides = rides.filter((r) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      r.origin_name.toLowerCase().includes(q) ||
      r.destination_name.toLowerCase().includes(q) ||
      r.driver?.full_name?.toLowerCase().includes(q)
    )
  })

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-6xl mx-auto space-y-6 pt-2 pb-16 px-4 sm:px-6"
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-[11px] font-semibold">
            <Car className="size-3.5" />
            <span>Campus Carpools & Seat Sharing</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            RIDE — Peer Carpooling
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Share rides and split commute costs between university residence halls, metro hubs, and campus gates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <Button
              onClick={() => setIsPublishModalOpen(true)}
              className="gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
            >
              <Plus className="size-4" />
              <span>Offer Carpool</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tab Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("browse")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "browse"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Available Rides ({filteredRides.length})
          </button>
          {user && (
            <button
              type="button"
              onClick={() => setActiveTab("manage")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "manage"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              My Rides & Seats ({myPublishedRides.length + mySentRequests.length})
            </button>
          )}
        </div>

        {activeTab === "browse" && (
          <div className="relative w-full sm:w-64">
            <Input
              type="search"
              placeholder="Search by destination or origin..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
            <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-2.5 pointer-events-none" />
          </div>
        )}
      </div>

      {/* BROWSE TAB */}
      {activeTab === "browse" && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="min-h-[30vh] flex flex-col items-center justify-center space-y-3">
              <Loader2 className="size-7 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground font-mono">Loading scheduled rides...</span>
            </div>
          ) : filteredRides.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border rounded-xl space-y-2 bg-muted/10">
              <Car className="size-10 text-muted-foreground/50 mx-auto" />
              <h3 className="font-semibold text-sm text-foreground">No carpools available</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No active carpools match your search. Post a carpool if you are driving across campus!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRides.map((ride) => {
                const isDriver = user?.id === ride.driver_id
                return (
                  <Card key={ride.id} className="border-border/80 flex flex-col justify-between overflow-hidden shadow-xs hover:border-primary/40 transition-all">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <span>{ride.origin_name}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-primary">{ride.destination_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                            <Clock className="size-3" />
                            <span>{new Date(ride.departure_time).toLocaleString()}</span>
                          </div>
                        </div>

                        <Badge className="text-[10px] font-bold">
                          {ride.available_seats} {ride.available_seats === 1 ? "seat" : "seats"} left
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 space-y-2.5 text-xs">
                      {/* Price contribution */}
                      <div className="flex items-baseline justify-between pt-1">
                        <div>
                          <span className="text-lg font-bold text-foreground">₹{ride.price_per_seat}</span>
                          <span className="text-[11px] text-muted-foreground font-medium"> /seat</span>
                        </div>
                      </div>

                      {ride.notes && (
                        <p className="text-[11px] text-muted-foreground italic line-clamp-2">
                          "{ride.notes}"
                        </p>
                      )}

                      {/* Driver Info & Profile */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                        <button
                          type="button"
                          onClick={() => setViewProfileStudentId(ride.driver_id)}
                          className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer text-left"
                          title="View student profile & reputation"
                        >
                          <User className="size-3" />
                          <span className="font-medium underline-offset-2 hover:underline">{ride.driver?.full_name || "Campus Driver"}</span>
                        </button>
                        <div className="flex items-center gap-1.5">
                          {ride.driver?.verification_status === "verified" && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <ShieldCheck className="size-3" />
                              <span>Verified</span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setReportTarget({ id: ride.id, title: `${ride.origin_name} → ${ride.destination_name}`, type: "ride" })}
                            className="text-muted-foreground/70 hover:text-destructive transition-colors cursor-pointer p-0.5"
                            title="Report this carpool"
                          >
                            <ShieldAlert className="size-3" />
                          </button>
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="p-4 pt-2 border-t border-border/60 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRoutePreviewRide(ride)}
                        className="text-xs h-8 cursor-pointer gap-1 text-muted-foreground hover:text-foreground"
                        title="View Route Map"
                      >
                        <Navigation className="size-3" />
                        <span>Map</span>
                      </Button>

                      {isDriver ? (
                        <span className="text-xs text-muted-foreground italic flex-1 text-center py-1">
                          Your carpool
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setJoiningRide(ride)}
                          className="flex-1 text-xs font-semibold cursor-pointer shadow-xs gap-1.5"
                        >
                          <Users className="size-3.5" />
                          <span>Request Seat</span>
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* MANAGE TAB */}
      {activeTab === "manage" && (
        <div className="space-y-8">
          {/* Driver: My Published Rides & Passenger Requests */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Car className="size-4 text-primary" />
              <span>Rides You Are Driving</span>
            </h2>

            {myPublishedRides.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border/80 rounded-2xl bg-card/50 flex flex-col items-center justify-center space-y-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Car className="size-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">No Scheduled Rides</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Heading somewhere on or around campus? Publish your route and share empty car seats with fellow students.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsPublishModalOpen(true)}
                  className="text-xs h-8 gap-1.5 cursor-pointer mt-1"
                >
                  <Plus className="size-3.5" />
                  <span>Offer a Ride</span>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myPublishedRides.map((ride) => (
                  <Card key={ride.id} className="border-border/80">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm font-semibold">
                            {ride.origin_name} → {ride.destination_name}
                          </CardTitle>
                          <CardDescription className="text-xs font-mono">
                            {new Date(ride.departure_time).toLocaleString()}
                          </CardDescription>
                        </div>
                        <StatusBadge status={ride.status} showIcon />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-1 text-xs text-muted-foreground">
                      <p>Remaining seats: <span className="font-semibold text-foreground">{ride.available_seats}</span></p>
                      <p>Price contribution: <span className="font-semibold text-foreground">₹{ride.price_per_seat}</span></p>
                    </CardContent>
                    <CardFooter className="p-4 pt-2 border-t border-border/60 flex items-center justify-end gap-2">
                      {ride.status === "scheduled" && (
                        <Button
                          size="sm"
                          disabled={actionLoadingId === ride.id}
                          onClick={() => handleCompleteRide(ride.id)}
                          className="text-xs h-8 cursor-pointer gap-1.5"
                        >
                          {actionLoadingId === ride.id && <Loader2 className="size-3 animate-spin" />}
                          <span>Mark Completed</span>
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}

            {/* Incoming Passenger Requests */}
            {incomingRequests.length > 0 && (
              <div className="pt-2 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Passenger Requests for Your Rides</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {incomingRequests.map((req) => (
                    <Card key={req.id} className="border-border/80 p-3 flex flex-col justify-between">
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            {req.passenger?.full_name} ({req.seats_requested} seat{req.seats_requested > 1 ? "s" : ""})
                          </span>
                          <StatusBadge status={req.status} showIcon />
                        </div>
                        <p className="text-muted-foreground text-[11px]">
                          Route: {req.ride?.origin_name} → {req.ride?.destination_name}
                        </p>
                        {req.pickup_note && <p className="italic text-muted-foreground text-[11px]">"{req.pickup_note}"</p>}
                        {req.status === "accepted" && (
                          <ContactHandoffCard
                            service="ride"
                            requestId={req.id}
                            fallbackName={req.passenger?.full_name}
                          />
                        )}
                      </div>

                      {req.status === "accepted" && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setUpiPaymentData({
                                amount: (req.ride?.price_per_seat || 0) * req.seats_requested,
                                txId: req.id,
                                payeeName: profile?.full_name || "Driver",
                                payeeUpi: profile?.upi_id || null,
                              })
                              setShowUPI(true)
                            }}
                            className="text-xs h-7 gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
                          >
                            <QrCode className="size-3" />
                            <span>Receive Payment (QR)</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewProfileStudentId(req.passenger_id)}
                            className="text-xs h-7 gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
                          >
                            <MessageSquare className="size-3" />
                            <span>Contact Passenger (WhatsApp)</span>
                          </Button>
                        </div>
                      )}
                      {req.status === "pending" && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60 mt-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={actionLoadingId === req.id}
                            onClick={() => handleRejectRequest(req.id)}
                            className="text-xs h-7 cursor-pointer gap-1.5"
                          >
                            {actionLoadingId === req.id && <Loader2 className="size-3 animate-spin" />}
                            <span>Decline</span>
                          </Button>
                          <Button
                            size="sm"
                            disabled={actionLoadingId === req.id}
                            onClick={() => handleAcceptRequest(req.id)}
                            className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1.5"
                          >
                            {actionLoadingId === req.id && <Loader2 className="size-3 animate-spin" />}
                            <span>Accept</span>
                          </Button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Passenger: My Seat Requests */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <span>Your Seat Reservations (As Passenger)</span>
            </h2>

            {mySentRequests.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border/80 rounded-2xl bg-card/50 flex flex-col items-center justify-center space-y-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Users className="size-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">No Carpool Reservations</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Looking for a ride? Search active routes and reserve seats with verified campus drivers.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setActiveTab("browse")}
                  className="text-xs h-8 gap-1.5 cursor-pointer mt-1"
                >
                  <Search className="size-3.5" />
                  <span>Find a Ride</span>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mySentRequests.map((req) => (
                  <Card key={req.id} className="border-border/80">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm font-semibold">
                            {req.ride?.origin_name} → {req.ride?.destination_name}
                          </CardTitle>
                          <CardDescription className="text-xs font-mono">
                            {req.ride?.departure_time ? new Date(req.ride.departure_time).toLocaleString() : ""}
                          </CardDescription>
                        </div>
                        <StatusBadge status={req.status} showIcon />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-1 text-xs text-muted-foreground">
                      <p>Seats booked: <span className="font-semibold text-foreground">{req.seats_requested}</span></p>
                      <p>Cost contribution: <span className="font-semibold text-foreground">₹{(req.ride?.price_per_seat || 0) * req.seats_requested}</span></p>
                      {req.status === "accepted" && (
                        <ContactHandoffCard
                          service="ride"
                          requestId={req.id}
                          fallbackName={req.ride?.driver?.full_name}
                        />
                      )}
                    </CardContent>
                    <CardFooter className="p-4 pt-2 border-t border-border/60 flex items-center justify-end gap-2 flex-wrap">
                      {req.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCancelModalState({
                            isOpen: true,
                            requestId: req.id,
                            title: `Carpool from ${req.ride?.origin_name || "Origin"}`,
                          })}
                          className="text-xs h-7 text-destructive cursor-pointer hover:bg-destructive/10"
                        >
                          Cancel Request
                        </Button>
                      )}
                      {req.status === "accepted" && (
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setUpiPaymentData({
                                amount: (req.ride?.price_per_seat || 0) * req.seats_requested,
                                txId: req.id,
                                payeeName: req.ride?.driver?.full_name || "Driver",
                                payeeUpi: req.ride?.driver?.upi_id || null,
                              })
                              setShowUPI(true)
                            }}
                            className="text-xs h-7 gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
                          >
                            <QrCode className="size-3" />
                            <span>Pay via UPI</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewProfileStudentId(req.ride?.driver_id || null)}
                            className="text-xs h-7 gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
                          >
                            <MessageSquare className="size-3" />
                            <span>Contact Driver (WhatsApp)</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDisputeModalState({
                              isOpen: true,
                              transactionId: req.id,
                              respondentId: req.ride?.driver_id || "",
                              title: `Carpool: ${req.ride?.origin_name} → ${req.ride?.destination_name}`,
                            })}
                            className="text-xs h-7 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 gap-1.5 cursor-pointer"
                          >
                            <ShieldAlert className="size-3" />
                            <span>File Dispute</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReviewRide(req)}
                            className="text-xs h-7 gap-1.5 cursor-pointer"
                          >
                            <Star className="size-3.5 text-amber-500 fill-amber-500" />
                            <span>Rate Driver</span>
                          </Button>
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Publish Carpool Modal */}
      <Dialog open={isPublishModalOpen} onOpenChange={setIsPublishModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Offer a Campus Carpool</DialogTitle>
            <DialogDescription className="text-xs">
              Publish your drive schedule so students along your route can join.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePublishRide} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="r-origin" className="text-xs">Pickup / Origin *</Label>
                <button
                  type="button"
                  onClick={() => setLocationPickerTarget("origin")}
                  className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <MapPin className="size-3" />
                  <span>Choose on Map</span>
                </button>
              </div>
              <Input
                id="r-origin"
                placeholder="e.g. MSRUAS Main Gate / Central Library"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                disabled={isSubmittingRide}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="r-dest" className="text-xs">Destination *</Label>
                <button
                  type="button"
                  onClick={() => setLocationPickerTarget("destination")}
                  className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <MapPin className="size-3" />
                  <span>Choose on Map</span>
                </button>
              </div>
              <Input
                id="r-dest"
                placeholder="e.g. Yeshwanthpur Metro / Peenya Campus"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                disabled={isSubmittingRide}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="r-dept" className="text-xs">Departure Time</Label>
              <Input
                id="r-dept"
                type="datetime-local"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                disabled={isSubmittingRide}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="r-seats" className="text-xs">Available Seats</Label>
                <Input
                  id="r-seats"
                  type="number"
                  min="1"
                  max="7"
                  value={seats}
                  onChange={(e) => setSeats(e.target.value)}
                  disabled={isSubmittingRide}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="r-price" className="text-xs">Contribution / Seat (₹)</Label>
                <Input
                  id="r-price"
                  type="number"
                  placeholder="₹50"
                  value={pricePerSeat}
                  onChange={(e) => setPricePerSeat(e.target.value)}
                  disabled={isSubmittingRide}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="r-notes" className="text-xs">Notes (Optional)</Label>
              <Textarea
                id="r-notes"
                placeholder="Leaving right after 5 PM lab. AC car, space for backpacks."
                value={rideNotes}
                onChange={(e) => setRideNotes(e.target.value)}
                disabled={isSubmittingRide}
                className="text-xs min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPublishModalOpen(false)}
                disabled={isSubmittingRide}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingRide}
                className="gap-1.5 cursor-pointer"
              >
                {isSubmittingRide ? <Loader2 className="size-3.5 animate-spin" /> : <Car className="size-3.5" />}
                <span>Publish Carpool</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Join Ride Modal */}
      <Dialog open={!!joiningRide} onOpenChange={(open) => !open && setJoiningRide(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Join Carpool</DialogTitle>
            <DialogDescription className="text-xs">
              Request a seat from {joiningRide?.origin_name} to {joiningRide?.destination_name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmJoin} className="space-y-3 py-2 text-xs">
            <div className="p-2.5 rounded-lg bg-muted text-xs space-y-1">
              <p className="font-semibold text-foreground">
                {joiningRide?.origin_name} → {joiningRide?.destination_name}
              </p>
              <p className="text-muted-foreground font-mono">
                Departure: {joiningRide ? new Date(joiningRide.departure_time).toLocaleString() : ""}
              </p>
              <p className="font-mono text-primary font-bold">
                Price: ₹{joiningRide?.price_per_seat} per seat
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="j-seats" className="text-xs">Seats Requested</Label>
              <Input
                id="j-seats"
                type="number"
                min="1"
                max={joiningRide?.available_seats || 1}
                value={seatsRequested}
                onChange={(e) => setSeatsRequested(e.target.value)}
                disabled={isSubmittingJoin}
                className="h-9 text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="j-notes" className="text-xs">Message for Driver</Label>
              <Textarea
                id="j-notes"
                placeholder="I will be waiting near the gate clock tower with a red backpack."
                value={joinNotes}
                onChange={(e) => setJoinNotes(e.target.value)}
                disabled={isSubmittingJoin}
                className="text-xs min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setJoiningRide(null)}
                disabled={isSubmittingJoin}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingJoin}
                className="gap-1.5 cursor-pointer"
              >
                {isSubmittingJoin ? <Loader2 className="size-3.5 animate-spin" /> : <Users className="size-3.5" />}
                <span>Send Seat Request</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review Modal */}
      <Dialog open={!!reviewRide} onOpenChange={(open) => !open && setReviewRide(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Rate Your Carpool</DialogTitle>
            <DialogDescription className="text-xs">
              Provide peer feedback for this trip.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitReview} className="space-y-3 py-2 text-xs">
            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className="cursor-pointer transition-transform hover:scale-110"
                >
                  <Star
                    className={`size-6 ${
                      star <= reviewRating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <Label htmlFor="cr-comment" className="text-xs">Feedback</Label>
              <Textarea
                id="cr-comment"
                placeholder="On-time pickup and safe driving!"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                disabled={isSubmittingReview}
                className="text-xs min-h-[70px]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReviewRide(null)}
                disabled={isSubmittingReview}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmittingReview}>
                {isSubmittingReview ? <Loader2 className="size-3.5 animate-spin" /> : <span>Submit Rating</span>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Map Location Picker */}
      <LocationPickerModal
        isOpen={!!locationPickerTarget}
        onClose={() => setLocationPickerTarget(null)}
        initialLocationName={locationPickerTarget === "origin" ? origin : destination}
        onSelect={(loc) => {
          if (locationPickerTarget === "origin") {
            setOrigin(loc.name)
          } else if (locationPickerTarget === "destination") {
            setDestination(loc.name)
          }
        }}
        title={locationPickerTarget === "origin" ? "Select Origin / Pickup Location" : "Select Destination Location"}
      />

      {/* Route Map Preview Modal */}
      <Dialog open={!!routePreviewRide} onOpenChange={(open) => !open && setRoutePreviewRide(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden sm:rounded-2xl">
          <DialogHeader className="p-4 pb-2 border-b border-border/80">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Navigation className="size-4 text-primary" />
              <span>Carpool Route Visualization</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {routePreviewRide?.origin_name} → {routePreviewRide?.destination_name}
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 space-y-3">
            <CampusMap
              height="280px"
              selectedLocation={{
                name: routePreviewRide?.origin_name || "Origin",
                lat: 13.0304,
                lng: 77.5649,
              }}
              destinationLocation={{
                name: routePreviewRide?.destination_name || "Destination",
                lat: 13.0235,
                lng: 77.5503,
              }}
              showRoute={true}
            />

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                <span className="text-[10px] text-muted-foreground uppercase font-mono block">Pickup Point:</span>
                <span className="font-semibold text-foreground truncate block">{routePreviewRide?.origin_name}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-[10px] text-muted-foreground uppercase font-mono block">Drop-off Point:</span>
                <span className="font-semibold text-foreground truncate block">{routePreviewRide?.destination_name}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 pt-2 border-t border-border/80">
            <Button size="sm" variant="outline" onClick={() => setRoutePreviewRide(null)} className="text-xs">
              Close Route
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student Public Profile Modal */}
      {viewProfileStudentId && (
        <StudentPublicProfileModal
          isOpen={!!viewProfileStudentId}
          onClose={() => setViewProfileStudentId(null)}
          studentId={viewProfileStudentId}
          hasAcceptedBooking={true}
        />
      )}

      {/* Safety Report Modal */}
      {reportTarget && (
        <ReportModal
          isOpen={!!reportTarget}
          onClose={() => setReportTarget(null)}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          targetTitle={reportTarget.title}
        />
      )}

      {/* Structured Cancellation Modal */}
      {cancelModalState.isOpen && (
        <CancellationModal
          isOpen={cancelModalState.isOpen}
          onClose={() => setCancelModalState({ isOpen: false, requestId: "", title: "" })}
          service="ride"
          requestId={cancelModalState.requestId}
          title={cancelModalState.title}
          onSuccess={async () => {
            const cancelledId = cancelModalState.requestId
            setCancelModalState({ isOpen: false, requestId: "", title: "" })
            setMySentRequests((prev) => prev.filter((req) => req.id !== cancelledId))
            setIncomingRequests((prev) => prev.filter((req) => req.id !== cancelledId))
            await fetchUserRides()
            await fetchRides()
          }}
        />
      )}

      {/* Transaction Dispute Modal */}
      {disputeModalState.isOpen && (
        <DisputeModal
          isOpen={disputeModalState.isOpen}
          onClose={() => setDisputeModalState({ isOpen: false, transactionId: "", respondentId: "", title: "" })}
          service="ride"
          transactionId={disputeModalState.transactionId}
          respondentId={disputeModalState.respondentId}
          transactionTitle={disputeModalState.title}
          onSuccess={() => {
            setDisputeModalState({ isOpen: false, transactionId: "", respondentId: "", title: "" })
          }}
        />
      )}

      {/* UPI Payment Modal */}
      <UPIPaymentModal
        isOpen={showUPI}
        onClose={() => setShowUPI(false)}
        payeeUpi={upiPaymentData.payeeUpi || null}
        payeeName={upiPaymentData.payeeName || "Student Peer"}
        amount={upiPaymentData.amount}
        txId={upiPaymentData.txId}
      />
    </motion.div>
  )
}
