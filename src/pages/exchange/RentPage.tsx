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
  KeyRound,
  Bike,
  Zap,
  Car,
  Search,
  Plus,
  MapPin,
  Clock,
  Calendar,
  ShieldCheck,
  Loader2,
  Star,
  User,
  MessageSquare,
  ShieldAlert,
  QrCode,
} from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"
import { LocationPickerModal } from "@/components/location/LocationPickerModal"
import { StudentPublicProfileModal } from "@/components/profile/StudentPublicProfileModal"
import { ReportModal } from "@/components/safety/ReportModal"
import { CancellationModal } from "@/components/exchange/CancellationModal"
import { DisputeModal } from "@/components/exchange/DisputeModal"
import { UPIPaymentModal } from "@/components/UPIPaymentModal"
import { ContactHandoffCard } from "@/components/ContactHandoffCard"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { EmptyState } from "@/components/ui/EmptyState"

type VehicleType = "bicycle" | "e_scooter" | "car" | "motorcycle"

interface VehicleWithDetails {
  id: string
  owner_id: string
  title: string
  type: VehicleType
  brand_model: string | null
  hourly_rate: number | null
  daily_rate: number | null
  deposit_amount: number
  pickup_location: string
  description: string
  status: "available" | "paused" | "archived"
  created_at: string
  owner?: {
    full_name: string | null
    university_name: string | null
    verification_status: string | null
  }
  primary_image?: string | null
}

interface RentalRequestItem {
  id: string
  vehicle_id: string
  renter_id: string
  owner_id: string
  start_time: string
  end_time: string
  total_price: number
  deposit_amount: number
  status: "pending" | "accepted" | "rejected" | "active" | "completed" | "cancelled"
  created_at: string
  vehicle?: {
    title: string
    type: string
    hourly_rate: number | null
    pickup_location: string
    owner_id?: string
    owner?: {
      full_name?: string | null
      upi_id?: string | null
    } | null
  }
  renter?: {
    full_name: string | null
    university_name: string | null
    upi_id?: string | null
  }
}

export function RentPage() {
  const { user, profile, isVerified } = useAuth()

  const [activeTab, setActiveTab] = React.useState<"browse" | "manage">("browse")
  const [vehicles, setVehicles] = React.useState<VehicleWithDetails[]>([])
  const [incomingRequests, setIncomingRequests] = React.useState<RentalRequestItem[]>([])
  const [mySentRequests, setMySentRequests] = React.useState<RentalRequestItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null)

  // Filters
  const [selectedType, setSelectedType] = React.useState<string>("all")
  const [searchQuery, setSearchQuery] = React.useState("")

  // List Vehicle Modal
  const [isListModalOpen, setIsListModalOpen] = React.useState(false)
  const [isSubmittingListing, setIsSubmittingListing] = React.useState(false)
  const [newTitle, setNewTitle] = React.useState("")
  const [newType, setNewType] = React.useState<VehicleType>("bicycle")
  const [newBrand, setNewBrand] = React.useState("")
  const [newHourlyRate, setNewHourlyRate] = React.useState("")
  const [newDailyRate, setNewDailyRate] = React.useState("")
  const [newDeposit, setNewDeposit] = React.useState("0")
  const [newLocation, setNewLocation] = React.useState("")
  const [newDescription, setNewDescription] = React.useState("")
  const [imageFile, setImageFile] = React.useState<File | null>(null)

  // Booking Modal
  const [bookingVehicle, setBookingVehicle] = React.useState<VehicleWithDetails | null>(null)
  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")
  const [isSubmittingBooking, setIsSubmittingBooking] = React.useState(false)

  // Review Modal
  const [reviewBooking, setReviewBooking] = React.useState<RentalRequestItem | null>(null)
  const [reviewRating, setReviewRating] = React.useState(5)
  const [reviewComment, setReviewComment] = React.useState("")
  const [isSubmittingReview, setIsSubmittingReview] = React.useState(false)

  // Location & Profile Modals
  const [isLocationPickerOpen, setIsLocationPickerOpen] = React.useState(false)
  const [viewProfileStudentId, setViewProfileStudentId] = React.useState<string | null>(null)
  const [reportTarget, setReportTarget] = React.useState<{ id: string; title: string; type: "user" | "vehicle" } | null>(null)

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

  // Fetch Available Vehicles
  const fetchVehicles = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data: vehicleData, error: vErr } = await supabase
        .from("vehicles")
        .select(`
          id, owner_id, title, type, brand_model, hourly_rate, daily_rate,
          deposit_amount, pickup_location, description, status, created_at,
          owner:public_profiles!vehicles_owner_id_fkey(full_name, university_name, verification_status)
        `)
        .eq("status", "available")
        .order("created_at", { ascending: false })

      if (vErr) throw vErr

      // Fetch primary images
      const vehicleIds = (vehicleData || []).map((v) => v.id)
      let imageMap: Record<string, string> = {}
      if (vehicleIds.length > 0) {
        const { data: imgData } = await supabase
          .from("vehicle_images")
          .select("vehicle_id, image_path")
          .in("vehicle_id", vehicleIds)
          .eq("is_primary", true)

        if (imgData) {
          imgData.forEach((img) => {
            const pubUrl = supabase.storage
              .from("vehicle-images")
              .getPublicUrl(img.image_path).data?.publicUrl
            if (pubUrl) {
              imageMap[img.vehicle_id] = pubUrl
            }
          })
        }
      }

      const formatted: VehicleWithDetails[] = (vehicleData || []).map((v: any) => ({
        ...v,
        owner: Array.isArray(v.owner) ? v.owner[0] : v.owner,
        primary_image: imageMap[v.id] || null,
      }))

      setVehicles(formatted)
    } catch (err: any) {
      console.error("[RentPage] Fetch vehicles error:", err)
      toast.error(err.message || "Failed to load vehicle listings.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch User's Rentals & Requests
  const fetchUserRentals = React.useCallback(async () => {
    if (!user) return
    try {
      // Incoming requests for my vehicles
      const { data: myVehicles } = await supabase
        .from("vehicles")
        .select("id")
        .eq("owner_id", user.id)

      const myVehicleIds = (myVehicles || []).map((v) => v.id)
      if (myVehicleIds.length > 0) {
        const { data: incomingData } = await supabase
          .from("rental_requests")
          .select(`
            id, vehicle_id, renter_id, owner_id, start_time, end_time, total_price, deposit_amount, status, created_at,
            vehicle:vehicles(title, type, hourly_rate, pickup_location, owner_id, owner:public_profiles!vehicles_owner_id_fkey(full_name, upi_id)),
            renter:public_profiles!rental_requests_renter_id_fkey(full_name, university_name, upi_id)
          `)
          .in("vehicle_id", myVehicleIds)
          .order("created_at", { ascending: false })

        setIncomingRequests((incomingData || []) as any)
      } else {
        setIncomingRequests([])
      }

      // My sent requests
      const { data: sentData } = await supabase
        .from("rental_requests")
        .select(`
          id, vehicle_id, renter_id, owner_id, start_time, end_time, total_price, deposit_amount, status, created_at,
          vehicle:vehicles(title, type, hourly_rate, pickup_location, owner_id, owner:public_profiles!vehicles_owner_id_fkey(full_name, upi_id)),
          renter:public_profiles!rental_requests_renter_id_fkey(full_name, university_name, upi_id)
        `)
        .eq("renter_id", user.id)
        .order("created_at", { ascending: false })

      setMySentRequests((sentData || []) as any)
    } catch (err: any) {
      console.error("[RentPage] Fetch requests error:", err)
    }
  }, [user])

  React.useEffect(() => {
    fetchVehicles()
    if (user) {
      fetchUserRentals()
    }
  }, [fetchVehicles, fetchUserRentals, user])

  // Handle Listing Creation
  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      toast.error("Please sign in to list a vehicle.")
      return
    }
    if (!isVerified) {
      toast.error("Student ID verification required before listing vehicles.")
      return
    }
    if (!newTitle.trim() || !newLocation.trim()) {
      toast.error("Title and pickup location are required.")
      return
    }

    try {
      setIsSubmittingListing(true)
      const hourly = newHourlyRate ? parseFloat(newHourlyRate) : null
      const daily = newDailyRate ? parseFloat(newDailyRate) : null
      const deposit = newDeposit ? parseFloat(newDeposit) : 0

      // 1. Insert vehicle
      const { data: createdVehicle, error: vErr } = await supabase
        .from("vehicles")
        .insert({
          owner_id: user.id,
          title: newTitle.trim(),
          type: newType,
          brand_model: newBrand.trim() || null,
          hourly_rate: hourly,
          daily_rate: daily,
          deposit_amount: deposit,
          pickup_location: newLocation.trim(),
          description: newDescription.trim() || "Student campus vehicle available for rent.",
          status: "available",
        })
        .select()
        .single()

      if (vErr) throw vErr

      // 2. Upload image if provided
      if (imageFile && createdVehicle) {
        const ext = imageFile.name.split(".").pop() || "jpg"
        const storagePath = `${createdVehicle.id}/photo_${Date.now()}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from("vehicle-images")
          .upload(storagePath, imageFile, {
            contentType: imageFile.type,
            upsert: true,
          })

        if (!uploadErr) {
          await supabase.from("vehicle_images").insert({
            vehicle_id: createdVehicle.id,
            image_path: storagePath,
            is_primary: true,
          })
        }
      }

      toast.success("Vehicle listed successfully!")
      setIsListModalOpen(false)
      // Reset form
      setNewTitle("")
      setNewBrand("")
      setNewHourlyRate("")
      setNewDailyRate("")
      setNewDeposit("0")
      setNewLocation("")
      setNewDescription("")
      setImageFile(null)
      await fetchVehicles()
    } catch (err: any) {
      console.error("[RentPage] Create listing error:", err)
      toast.error(err.message || "Failed to create vehicle listing.")
    } finally {
      setIsSubmittingListing(false)
    }
  }

  // Handle Booking Submit
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !bookingVehicle) return
    if (!isVerified) {
      toast.error("Student ID verification required before reserving vehicles.")
      return
    }
    if (!startDate || !endDate) {
      toast.error("Please select start and end reservation times.")
      return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end <= start) {
      toast.error("End time must be after start time.")
      return
    }

    const durationHours = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60)))
    const rate = bookingVehicle.hourly_rate || (bookingVehicle.daily_rate ? bookingVehicle.daily_rate / 24 : 100)
    const calculatedTotal = durationHours * rate

    try {
      setIsSubmittingBooking(true)
      const { error } = await supabase.from("rental_requests").insert({
        vehicle_id: bookingVehicle.id,
        renter_id: user.id,
        owner_id: bookingVehicle.owner_id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        total_price: calculatedTotal,
        deposit_amount: bookingVehicle.deposit_amount || 0,
        status: "pending",
      })

      if (error) throw error

      toast.success("Rental request submitted! Awaiting owner confirmation.")
      setBookingVehicle(null)
      setStartDate("")
      setEndDate("")
      await fetchUserRentals()
      setActiveTab("manage")
    } catch (err: any) {
      console.error("[RentPage] Booking request error:", err)
      toast.error(err.message || "Failed to submit booking request.")
    } finally {
      setIsSubmittingBooking(false)
    }
  }

  // Owner Action: Accept Request (Calls atomic accept_rental_request RPC)
  const handleAcceptRequest = async (requestId: string) => {
    try {
      setActionLoadingId(requestId)
      const { error } = await supabase.rpc("accept_rental_request", {
        p_request_id: requestId,
      })
      if (error) throw error
      toast.success("Rental request accepted! Conflicting requests auto-resolved.")
      setIncomingRequests((prev) =>
        prev.map((req) => (req.id === requestId ? { ...req, status: "accepted" } : req))
      )
      await fetchUserRentals()
      await fetchVehicles()
    } catch (err: any) {
      console.error("[RentPage] Accept request error:", err)
      toast.error(err.message || "Failed to accept rental request.")
    } finally {
      setActionLoadingId(null)
    }
  }

  // Owner Action: Reject Request
  const handleRejectRequest = async (requestId: string) => {
    try {
      setActionLoadingId(requestId)
      const { error } = await supabase
        .from("rental_requests")
        .update({ status: "rejected" })
        .eq("id", requestId)
      if (error) throw error
      toast.success("Rental request rejected.")
      setIncomingRequests((prev) => prev.filter((req) => req.id !== requestId))
      await fetchUserRentals()
    } catch (err: any) {
      console.error("[RentPage] Reject error:", err)
      toast.error(err.message || "Failed to reject request.")
    } finally {
      setActionLoadingId(null)
    }
  }

  // Mark Completed
  const handleCompleteRental = async (requestId: string) => {
    try {
      setActionLoadingId(requestId)
      const { error } = await supabase
        .from("rental_requests")
        .update({ status: "completed" })
        .eq("id", requestId)
      if (error) throw error
      toast.success("Rental marked as completed!")
      setIncomingRequests((prev) =>
        prev.map((req) => (req.id === requestId ? { ...req, status: "completed" } : req))
      )
      setMySentRequests((prev) =>
        prev.map((req) => (req.id === requestId ? { ...req, status: "completed" } : req))
      )
      await fetchUserRentals()
    } catch (err: any) {
      console.error("[RentPage] Complete error:", err)
      toast.error(err.message || "Failed to complete rental.")
    } finally {
      setActionLoadingId(null)
    }
  }



  // Submit Review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !reviewBooking) return

    try {
      setIsSubmittingReview(true)
      const revieweeId = reviewBooking.renter_id === user.id ? reviewBooking.owner_id : reviewBooking.renter_id
      const { error } = await supabase.from("reviews").insert({
        reviewer_id: user.id,
        reviewee_id: revieweeId,
        exchange_type: "rent",
        rental_request_id: reviewBooking.id,
        rating: reviewRating,
        comment: reviewComment.trim() || null,
      })
      if (error) throw error

      toast.success("Rating and feedback submitted!")
      setReviewBooking(null)
      setReviewComment("")
      setReviewRating(5)
    } catch (err: any) {
      console.error("[RentPage] Review submit error:", err)
      toast.error(err.message || "Failed to submit review.")
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const filteredVehicles = vehicles.filter((v) => {
    const matchesType = selectedType === "all" || v.type === selectedType
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch =
      !q ||
      v.title.toLowerCase().includes(q) ||
      v.pickup_location.toLowerCase().includes(q) ||
      v.brand_model?.toLowerCase().includes(q)
    return matchesType && matchesSearch
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
            <KeyRound className="size-3.5" />
            <span>Campus Micro-Mobility & Vehicle Rentals</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            RENT — Peer Vehicle Sharing
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rent verified student bicycles, campus e-scooters, and shared cars on university grounds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <Button
              onClick={() => setIsListModalOpen(true)}
              className="gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
            >
              <Plus className="size-4" />
              <span>List Vehicle</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Tab Controls */}
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
            Available Vehicles ({filteredVehicles.length})
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
              My Fleet & Bookings ({incomingRequests.length + mySentRequests.length})
            </button>
          )}
        </div>

        {activeTab === "browse" && (
          <div className="relative w-full sm:w-64">
            <Input
              type="search"
              placeholder="Search by vehicle or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8.5 h-9 text-xs"
            />
            <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-2.5 pointer-events-none" />
          </div>
        )}
      </div>

      {/* BROWSE TAB CONTENT */}
      {activeTab === "browse" && (
        <div className="space-y-4">
          {/* Type Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: "all", label: "All Types" },
              { id: "bicycle", label: "Bicycles", icon: Bike },
              { id: "e_scooter", label: "E-Scooters", icon: Zap },
              { id: "motorcycle", label: "Motorcycles", icon: Bike },
              { id: "car", label: "Cars", icon: Car },
            ].map((type) => {
              const Icon = type.icon
              const isSelected = selectedType === type.id
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground font-semibold"
                      : "border-border/80 bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {Icon && <Icon className="size-3" />}
                  <span>{type.label}</span>
                </button>
              )
            })}
          </div>

          {isLoading ? (
            <div className="min-h-[30vh] flex flex-col items-center justify-center space-y-3">
              <Loader2 className="size-7 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground font-mono">Loading available vehicles...</span>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <EmptyState
              variant="vehicles"
              title="No student vehicles found"
              description="No active bicycles or scooters match your search or filter. Be the first classmate to list one!"
              actionLabel={user ? "List Your Vehicle" : undefined}
              onAction={user ? () => setIsListModalOpen(true) : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredVehicles.map((vehicle) => {
                const isOwner = user?.id === vehicle.owner_id
                return (
                  <Card key={vehicle.id} className="border-border/80 flex flex-col justify-between overflow-hidden shadow-xs hover:border-primary/40 transition-all">
                    {/* Vehicle Photo or Compact Styled Category Header */}
                    <div className="relative overflow-hidden border-b border-border/60">
                      {vehicle.primary_image ? (
                        <div className="h-44 w-full bg-muted/40 relative overflow-hidden">
                          <img
                            src={vehicle.primary_image}
                            alt={vehicle.title}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                          />
                        </div>
                      ) : (
                        /* Sleek Compact Styled Header Block */
                        <div className="h-28 w-full bg-gradient-to-br from-card via-secondary/50 to-[var(--accent-primary)]/10 relative flex items-center justify-center overflow-hidden">
                          {/* Subtle Dot-grid Pattern */}
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 opacity-15 pointer-events-none"
                            style={{
                              backgroundImage: `radial-gradient(circle at 1px 1px, var(--color-foreground) 1px, transparent 0)`,
                              backgroundSize: "14px 14px",
                            }}
                          />

                          {/* Floating Category Icon Badge */}
                          <div className="relative z-10 size-11 rounded-2xl bg-background/90 border border-border/80 shadow-xs flex items-center justify-center text-primary">
                            {vehicle.type === "bicycle" ? (
                              <Bike className="size-5" />
                            ) : vehicle.type === "e_scooter" ? (
                              <Zap className="size-5" />
                            ) : (
                              <Car className="size-5" />
                            )}
                          </div>
                        </div>
                      )}

                      <Badge className="absolute top-2.5 right-2.5 text-[10px] capitalize font-bold shadow-xs backdrop-blur-xs">
                        {vehicle.type.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base font-semibold truncate text-foreground">
                        {vehicle.title}
                      </CardTitle>
                      {vehicle.brand_model && (
                        <CardDescription className="text-xs text-muted-foreground">
                          {vehicle.brand_model}
                        </CardDescription>
                      )}
                    </CardHeader>

                    <CardContent className="p-4 pt-1 space-y-2.5 text-xs">
                      {/* Price & Deposit */}
                      <div className="flex items-baseline justify-between pt-1">
                        <div>
                          <span className="text-lg font-bold text-foreground">
                            ₹{vehicle.hourly_rate || vehicle.daily_rate || 50}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {vehicle.hourly_rate ? "/hour" : "/day"}
                          </span>
                        </div>
                        {vehicle.deposit_amount > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            Deposit: ₹{vehicle.deposit_amount}
                          </span>
                        )}
                      </div>

                      {/* Location */}
                      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                        <MapPin className="size-3.5 text-primary shrink-0" />
                        <span className="truncate">{vehicle.pickup_location}</span>
                      </div>

                      {/* Owner Info & Profile Link */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                        <button
                          type="button"
                          onClick={() => setViewProfileStudentId(vehicle.owner_id)}
                          className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer text-left"
                          title="View student profile & reviews"
                        >
                          <User className="size-3" />
                          <span className="font-medium underline-offset-2 hover:underline">
                            {vehicle.owner?.full_name || "Campus Student"}
                          </span>
                        </button>
                        <div className="flex items-center gap-1.5">
                          {vehicle.owner?.verification_status === "verified" && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <ShieldCheck className="size-3" />
                              <span>Verified</span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setReportTarget({ id: vehicle.id, title: vehicle.title, type: "vehicle" })}
                            className="text-muted-foreground/70 hover:text-destructive transition-colors cursor-pointer p-0.5"
                            title="Report this listing"
                          >
                            <ShieldAlert className="size-3" />
                          </button>
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="p-4 pt-2 border-t border-border/60">
                      {isOwner ? (
                        <span className="text-xs text-muted-foreground italic w-full text-center py-1">
                          Your vehicle listing
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setBookingVehicle(vehicle)}
                          className="w-full text-xs font-semibold cursor-pointer shadow-xs gap-1.5"
                        >
                          <KeyRound className="size-3.5" />
                          <span>Reserve Vehicle</span>
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

      {/* MANAGE TAB CONTENT */}
      {activeTab === "manage" && (
        <div className="space-y-8">
          {/* Incoming Requests on My Vehicles */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              <span>Incoming Rental Requests (My Vehicles)</span>
            </h2>

            {incomingRequests.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border/80 rounded-2xl bg-card/50 flex flex-col items-center justify-center space-y-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <KeyRound className="size-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">No Incoming Booking Requests</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    When students request to rent your listed vehicles, their requests will appear here for your review and approval.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsListModalOpen(true)}
                  className="text-xs h-8 gap-1.5 cursor-pointer mt-1"
                >
                  <Plus className="size-3.5" />
                  <span>List Another Vehicle</span>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {incomingRequests.map((req) => (
                  <Card key={req.id} className="border-border/80">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm font-semibold">{req.vehicle?.title}</CardTitle>
                          <CardDescription className="text-xs">
                            Renter: {req.renter?.full_name || "Student"} ({req.renter?.university_name || "Campus"})
                          </CardDescription>
                        </div>
                        <StatusBadge status={req.status} showIcon />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="size-3" />
                        <span>{new Date(req.start_time).toLocaleString()} → {new Date(req.end_time).toLocaleString()}</span>
                      </div>
                      <p className="font-semibold text-foreground">Total: ₹{req.total_price}</p>
                      {(req.status === "accepted" || req.status === "active") && (
                        <ContactHandoffCard
                          service="rental"
                          requestId={req.id}
                          fallbackName={req.renter?.full_name}
                        />
                      )}
                    </CardContent>
                    <CardFooter className="p-4 pt-2 border-t border-border/60 flex items-center justify-end gap-2 flex-wrap">
                      {req.status === "pending" && (
                        <>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={actionLoadingId === req.id}
                            onClick={() => handleRejectRequest(req.id)}
                            className="text-xs h-8 cursor-pointer gap-1.5"
                          >
                            {actionLoadingId === req.id && <Loader2 className="size-3 animate-spin" />}
                            <span>Reject</span>
                          </Button>
                          <Button
                            size="sm"
                            disabled={actionLoadingId === req.id}
                            onClick={() => handleAcceptRequest(req.id)}
                            className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1.5"
                          >
                            {actionLoadingId === req.id && <Loader2 className="size-3 animate-spin" />}
                            <span>Accept Request</span>
                          </Button>
                        </>
                      )}
                      {req.status === "accepted" && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setUpiPaymentData({
                                amount: req.total_price || 0,
                                txId: req.id,
                                payeeName: profile?.full_name || "Vehicle Owner",
                                payeeUpi: profile?.upi_id || null,
                              })
                              setShowUPI(true)
                            }}
                            className="text-xs h-8 gap-1.5 cursor-pointer text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                          >
                            <QrCode className="size-3.5" />
                            <span>Receive Payment (QR)</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewProfileStudentId(req.renter_id)}
                            className="text-xs h-8 gap-1.5 cursor-pointer text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Contact Renter</span>
                          </Button>
                          <Button
                            size="sm"
                            disabled={actionLoadingId === req.id}
                            onClick={() => handleCompleteRental(req.id)}
                            className="text-xs h-8 cursor-pointer gap-1.5"
                          >
                            {actionLoadingId === req.id && <Loader2 className="size-3 animate-spin" />}
                            <span>Mark Completed</span>
                          </Button>
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* My Sent Requests */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              <span>My Vehicle Reservations</span>
            </h2>

            {mySentRequests.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border/80 rounded-2xl bg-card/50 flex flex-col items-center justify-center space-y-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Bike className="size-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">No Active Rental Requests</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    You haven't requested any vehicles yet. Find bicycles, e-scooters, and motorcycles available on your campus.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setActiveTab("browse")}
                  className="text-xs h-8 gap-1.5 cursor-pointer mt-1"
                >
                  <Search className="size-3.5" />
                  <span>Browse Campus Vehicles</span>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mySentRequests.map((req) => (
                  <Card key={req.id} className="border-border/80">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm font-semibold">{req.vehicle?.title}</CardTitle>
                          <CardDescription className="text-xs flex items-center gap-1 mt-0.5">
                            <MapPin className="size-3" />
                            <span>{req.vehicle?.pickup_location}</span>
                          </CardDescription>
                        </div>
                        <StatusBadge status={req.status} showIcon />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="size-3" />
                        <span>{new Date(req.start_time).toLocaleString()} → {new Date(req.end_time).toLocaleString()}</span>
                      </div>
                      <p className="font-semibold text-foreground">Estimated Amount: ₹{req.total_price}</p>
                      {(req.status === "accepted" || req.status === "active") && (
                        <ContactHandoffCard
                          service="rental"
                          requestId={req.id}
                          fallbackName={req.vehicle?.owner?.full_name}
                        />
                      )}
                    </CardContent>
                    <CardFooter className="p-4 pt-2 border-t border-border/60 flex items-center justify-end gap-2 flex-wrap">
                      {req.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCancelModalState({ isOpen: true, requestId: req.id, title: req.vehicle?.title || "Rental Booking" })}
                          className="text-xs h-8 text-destructive cursor-pointer hover:bg-destructive/10"
                        >
                          Cancel Request
                        </Button>
                      )}
                      {req.status === "accepted" && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setUpiPaymentData({
                                amount: req.total_price || 0,
                                txId: req.id,
                                payeeName: req.vehicle?.owner?.full_name || "Vehicle Owner",
                                payeeUpi: req.vehicle?.owner?.upi_id || null,
                              })
                              setShowUPI(true)
                            }}
                            className="text-xs h-8 gap-1.5 cursor-pointer text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                          >
                            <QrCode className="size-3.5" />
                            <span>Pay via UPI</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewProfileStudentId(req.owner_id)}
                            className="text-xs h-8 gap-1.5 cursor-pointer text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Contact Owner (WhatsApp)</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDisputeModalState({
                              isOpen: true,
                              transactionId: req.id,
                              respondentId: req.owner_id,
                              title: req.vehicle?.title || "Rental Booking"
                            })}
                            className="text-xs h-8 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 gap-1.5 cursor-pointer"
                          >
                            <ShieldAlert className="size-3.5" />
                            <span>File Dispute</span>
                          </Button>
                        </div>
                      )}
                      {req.status === "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReviewBooking(req)}
                          className="text-xs h-8 gap-1.5 cursor-pointer"
                        >
                          <Star className="size-3.5 text-amber-500 fill-amber-500" />
                          <span>Leave Review</span>
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* List Vehicle Modal */}
      <Dialog open={isListModalOpen} onOpenChange={setIsListModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">List a Student Vehicle</DialogTitle>
            <DialogDescription className="text-xs">
              Offer your bicycle, campus e-scooter, or car for peer rental.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateListing} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label htmlFor="v-title" className="text-xs">Listing Title</Label>
              <Input
                id="v-title"
                placeholder="e.g. Trek Mountain Bike 21-Speed"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                disabled={isSubmittingListing}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="v-type" className="text-xs">Vehicle Type</Label>
                <select
                  id="v-type"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="bicycle">Bicycle</option>
                  <option value="e_scooter">E-Scooter</option>
                  <option value="motorcycle">Motorcycle</option>
                  <option value="car">Car</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="v-brand" className="text-xs">Brand & Model</Label>
                <Input
                  id="v-brand"
                  placeholder="e.g. Hero Sprint Pro"
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                  disabled={isSubmittingListing}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="v-hourly" className="text-xs">Hourly Rate (₹)</Label>
                <Input
                  id="v-hourly"
                  type="number"
                  placeholder="₹30"
                  value={newHourlyRate}
                  onChange={(e) => setNewHourlyRate(e.target.value)}
                  disabled={isSubmittingListing}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="v-daily" className="text-xs">Daily Rate (₹)</Label>
                <Input
                  id="v-daily"
                  type="number"
                  placeholder="₹150"
                  value={newDailyRate}
                  onChange={(e) => setNewDailyRate(e.target.value)}
                  disabled={isSubmittingListing}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="v-deposit" className="text-xs">Deposit (₹)</Label>
                <Input
                  id="v-deposit"
                  type="number"
                  placeholder="₹100"
                  value={newDeposit}
                  onChange={(e) => setNewDeposit(e.target.value)}
                  disabled={isSubmittingListing}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="v-location" className="text-xs">Pickup Location on Campus *</Label>
                <button
                  type="button"
                  onClick={() => setIsLocationPickerOpen(true)}
                  className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <MapPin className="size-3" />
                  <span>Choose on Map</span>
                </button>
              </div>
              <Input
                id="v-location"
                placeholder="e.g. MSRUAS Main Gate / West Campus Hostels"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                disabled={isSubmittingListing}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="v-photo" className="text-xs">Vehicle Photo</Label>
              <Input
                id="v-photo"
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                disabled={isSubmittingListing}
                className="h-9 text-xs cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="v-desc" className="text-xs">Description & Condition</Label>
              <Textarea
                id="v-desc"
                placeholder="Includes helmet and bike lock. Return with full battery charge."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                disabled={isSubmittingListing}
                className="text-xs min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsListModalOpen(false)}
                disabled={isSubmittingListing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingListing}
                className="gap-1.5 cursor-pointer"
              >
                {isSubmittingListing ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                <span>Publish Listing</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Booking Modal */}
      <Dialog open={!!bookingVehicle} onOpenChange={(open) => !open && setBookingVehicle(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Reserve {bookingVehicle?.title}</DialogTitle>
            <DialogDescription className="text-xs">
              Select your reservation window. The owner will review and confirm your booking.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmBooking} className="space-y-3 py-2 text-xs">
            <div className="p-2.5 rounded-lg bg-muted text-xs space-y-1">
              <p className="font-semibold text-foreground">{bookingVehicle?.title}</p>
              <p className="text-muted-foreground flex items-center gap-1">
                <MapPin className="size-3" />
                <span>{bookingVehicle?.pickup_location}</span>
              </p>
              <p className="font-mono text-primary font-bold">
                Rate: ₹{bookingVehicle?.hourly_rate || bookingVehicle?.daily_rate}/hr
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="b-start" className="text-xs">Start Date & Time</Label>
              <Input
                id="b-start"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isSubmittingBooking}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="b-end" className="text-xs">End Date & Time</Label>
              <Input
                id="b-end"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isSubmittingBooking}
                className="h-9 text-xs"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBookingVehicle(null)}
                disabled={isSubmittingBooking}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingBooking}
                className="gap-1.5 cursor-pointer"
              >
                {isSubmittingBooking ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
                <span>Send Booking Request</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review Modal */}
      <Dialog open={!!reviewBooking} onOpenChange={(open) => !open && setReviewBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Rate Your Rental Experience</DialogTitle>
            <DialogDescription className="text-xs">
              Provide peer feedback for {reviewBooking?.vehicle?.title}.
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
                      star <= reviewRating
                        ? "text-amber-500 fill-amber-500"
                        : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <Label htmlFor="r-comment" className="text-xs">Feedback / Comment</Label>
              <Textarea
                id="r-comment"
                placeholder="Vehicle was in excellent condition, smooth handoff!"
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
                onClick={() => setReviewBooking(null)}
                disabled={isSubmittingReview}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingReview}
              >
                {isSubmittingReview ? <Loader2 className="size-3.5 animate-spin" /> : <span>Submit Rating</span>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Map Location Picker Modal */}
      <LocationPickerModal
        isOpen={isLocationPickerOpen}
        onClose={() => setIsLocationPickerOpen(false)}
        initialLocationName={newLocation}
        onSelect={(loc) => setNewLocation(loc.name)}
        title="Select Campus Pickup Location"
      />

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
          service="rent"
          requestId={cancelModalState.requestId}
          title={cancelModalState.title}
          onSuccess={async () => {
            const cancelledId = cancelModalState.requestId
            setCancelModalState({ isOpen: false, requestId: "", title: "" })
            setMySentRequests((prev) => prev.filter((req) => req.id !== cancelledId))
            setIncomingRequests((prev) => prev.filter((req) => req.id !== cancelledId))
            await fetchUserRentals()
            await fetchVehicles()
          }}
        />
      )}

      {/* Transaction Dispute Modal */}
      {disputeModalState.isOpen && (
        <DisputeModal
          isOpen={disputeModalState.isOpen}
          onClose={() => setDisputeModalState({ isOpen: false, transactionId: "", respondentId: "", title: "" })}
          service="rent"
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
