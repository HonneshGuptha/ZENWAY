import * as React from "react"
import { motion } from "motion/react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
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
  Package,
  Search,
  Plus,
  ShieldCheck,
  Loader2,
  Star,
  User,
  Truck,
  Send,
  MapPin,
  MessageSquare,
  ShieldAlert,
  Navigation,
  Clock,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"
import { formatReadableDateTime } from "@/utils/formatters"
import { LocationPickerModal } from "@/components/location/LocationPickerModal"
import { CampusMap } from "@/components/location/CampusMap"
import { StudentPublicProfileModal } from "@/components/profile/StudentPublicProfileModal"
import { ReportModal } from "@/components/safety/ReportModal"
import { CancellationModal } from "@/components/exchange/CancellationModal"
import { DisputeModal } from "@/components/exchange/DisputeModal"
import { ContactHandoffCard } from "@/components/ContactHandoffCard"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { EmptyState } from "@/components/ui/EmptyState"

type PackageSize = "envelope" | "small_box" | "backpack" | "medium_box"

interface CarryRequestWithDetails {
  id: string
  requester_id: string
  assigned_carrier_id: string | null
  accepted_offer_id: string | null
  item_title: string
  item_description: string
  item_size: PackageSize
  pickup_location: string
  delivery_location: string
  needed_by: string
  reward_amount: number
  pickup_photo_path: string | null
  status: "open" | "accepted" | "in_transit" | "delivered" | "cancelled"
  created_at: string
  requester?: {
    full_name: string | null
    university_name: string | null
    verification_status: string | null
  }
}

interface CarryOfferItem {
  id: string
  request_id: string
  carrier_id: string
  message: string | null
  proposed_delivery_time: string | null
  status: "pending" | "accepted" | "rejected" | "cancelled"
  created_at: string
  request?: {
    item_title: string
    pickup_location: string
    delivery_location: string
    reward_amount: number
    status: string
    requester_id?: string
  }
  carrier?: {
    full_name: string | null
    university_name: string | null
  }
}

export function CarryPage() {
  const { user, isVerified } = useAuth()
  const { navigate } = useRouter()

  const [activeTab, setActiveTab] = React.useState<"browse" | "manage">("browse")
  const [requests, setRequests] = React.useState<CarryRequestWithDetails[]>([])
  const [incomingOffers, setIncomingOffers] = React.useState<CarryOfferItem[]>([])
  const [mySentOffers, setMySentOffers] = React.useState<CarryOfferItem[]>([])
  const [myRequests, setMyRequests] = React.useState<CarryRequestWithDetails[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null)

  // Filters
  const [selectedSize, setSelectedSize] = React.useState<string>("all")
  const [searchQuery, setSearchQuery] = React.useState("")

  // Create Request Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [isSubmittingRequest, setIsSubmittingRequest] = React.useState(false)
  const [newTitle, setNewTitle] = React.useState("")
  const [newSize, setNewSize] = React.useState<PackageSize>("small_box")
  const [newPickup, setNewPickup] = React.useState("")
  const [newDelivery, setNewDelivery] = React.useState("")
  const [newFee, setNewFee] = React.useState("50")
  const [newDeadline, setNewDeadline] = React.useState("")
  const [newDescription, setNewDescription] = React.useState("")
  const [photoFile, setPhotoFile] = React.useState<File | null>(null)

  // Offer Modal
  const [offeringRequest, setOfferingRequest] = React.useState<CarryRequestWithDetails | null>(null)
  const [offerMessage, setOfferMessage] = React.useState("")
  const [offerEta, setOfferEta] = React.useState("")
  const [isSubmittingOffer, setIsSubmittingOffer] = React.useState(false)

  // Review Modal
  const [reviewDelivery, setReviewDelivery] = React.useState<CarryRequestWithDetails | null>(null)
  const [reviewRating, setReviewRating] = React.useState(5)
  const [reviewComment, setReviewComment] = React.useState("")
  const [isSubmittingReview, setIsSubmittingReview] = React.useState(false)

  // Location & Route Map & Profiles
  const [locationPickerTarget, setLocationPickerTarget] = React.useState<"pickup" | "delivery" | null>(null)
  const [viewProfileStudentId, setViewProfileStudentId] = React.useState<string | null>(null)
  const [reportTarget, setReportTarget] = React.useState<{ id: string; title: string; type: "user" | "carry" } | null>(null)
  const [routePreviewCarry, setRoutePreviewCarry] = React.useState<CarryRequestWithDetails | null>(null)

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

  // Fetch Open Carry Requests
  const fetchCarryRequests = React.useCallback(async () => {
    try {
      setIsLoading(true)
      setFetchError(null)
      const { data, error } = await supabase
        .from("carry_requests")
        .select(`
          id, requester_id, assigned_carrier_id, accepted_offer_id, item_title,
          item_description, item_size, pickup_location, delivery_location,
          needed_by, reward_amount, pickup_photo_path, status, created_at,
          requester:public_profiles!carry_requests_requester_id_fkey(full_name, university_name, verification_status)
        `)
        .eq("status", "open")
        .order("created_at", { ascending: false })

      if (error) throw error

      const formatted: CarryRequestWithDetails[] = (data || []).map((c: any) => ({
        ...c,
        requester: Array.isArray(c.requester) ? c.requester[0] : c.requester,
      }))

      setRequests(formatted)
    } catch (err: any) {
      console.error("[CarryPage] Fetch requests error:", err)
      setFetchError(err.message || "Failed to load carry requests.")
      toast.error(err.message || "Failed to load carry requests.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch User's Carry Requests & Offers
  const fetchUserCarryData = React.useCallback(async () => {
    if (!user) return
    try {
      // My created transport requests
      const { data: myReqs } = await supabase
        .from("carry_requests")
        .select(`
          id, requester_id, assigned_carrier_id, accepted_offer_id, item_title,
          item_description, item_size, pickup_location, delivery_location,
          needed_by, reward_amount, pickup_photo_path, status, created_at
        `)
        .eq("requester_id", user.id)
        .order("created_at", { ascending: false })

      setMyRequests((myReqs || []) as CarryRequestWithDetails[])

      // Incoming offers on my requests
      const myReqIds = (myReqs || []).map((r) => r.id)
      if (myReqIds.length > 0) {
        const { data: offersData } = await supabase
          .from("carry_offers")
          .select(`
            id, request_id, carrier_id, message, proposed_delivery_time, status, created_at,
            request:carry_requests(item_title, pickup_location, delivery_location, reward_amount, status, requester_id),
            carrier:public_profiles!carry_offers_carrier_id_fkey(full_name, university_name)
          `)
          .in("request_id", myReqIds)
          .order("created_at", { ascending: false })

        setIncomingOffers((offersData || []) as any)
      } else {
        setIncomingOffers([])
      }

      // My sent carrier offers
      const { data: sentOffers } = await supabase
        .from("carry_offers")
        .select(`
          id, request_id, carrier_id, message, proposed_delivery_time, status, created_at,
          request:carry_requests(item_title, pickup_location, delivery_location, reward_amount, status, requester_id),
          carrier:public_profiles!carry_offers_carrier_id_fkey(full_name, university_name)
        `)
        .eq("carrier_id", user.id)
        .order("created_at", { ascending: false })

      setMySentOffers((sentOffers || []) as any)
    } catch (err: any) {
      console.error("[CarryPage] Fetch user carry error:", err)
    }
  }, [user])

  React.useEffect(() => {
    fetchCarryRequests()
    if (user) {
      fetchUserCarryData()
    }
  }, [fetchCarryRequests, fetchUserCarryData, user])

  // Create Request Handler
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!isVerified) {
      toast.error("Student ID verification required before requesting item deliveries.")
      return
    }
    if (!newTitle.trim() || !newPickup.trim() || !newDelivery.trim()) {
      toast.error("Title, pickup, and delivery locations are required.")
      return
    }

    try {
      setIsSubmittingRequest(true)
      let photoPath: string | null = null

      // Upload item photo if selected
      if (photoFile) {
        const ext = photoFile.name.split(".").pop() || "jpg"
        photoPath = `${user.id}/carry_${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from("carry-photos")
          .upload(photoPath, photoFile, { contentType: photoFile.type, upsert: true })

        if (uploadErr) {
          console.warn("[CarryPage] Photo upload fallback:", uploadErr)
          photoPath = null
        }
      }

      const { error: insertErr } = await supabase.from("carry_requests").insert({
        requester_id: user.id,
        item_title: newTitle.trim(),
        item_description: newDescription.trim() || "Peer item transport",
        item_size: newSize,
        pickup_location: newPickup.trim(),
        delivery_location: newDelivery.trim(),
        needed_by: newDeadline ? new Date(newDeadline).toISOString() : new Date(Date.now() + 86400000).toISOString(),
        reward_amount: parseFloat(newFee) || 0,
        pickup_photo_path: photoPath,
        status: "open",
      })

      if (insertErr) throw insertErr

      toast.success("Delivery request posted! Campus peers can now offer to carry.")
      setIsCreateModalOpen(false)
      setNewTitle("")
      setNewPickup("")
      setNewDelivery("")
      setNewFee("50")
      setNewDeadline("")
      setNewDescription("")
      setPhotoFile(null)
      await fetchCarryRequests()
      await fetchUserCarryData()
    } catch (err: any) {
      console.error("[CarryPage] Create request error:", err)
      toast.error(err.message || "Failed to create delivery request.")
    } finally {
      setIsSubmittingRequest(false)
    }
  }

  // Submit Carrier Offer Handler
  const handleConfirmOffer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !offeringRequest) return
    if (!isVerified) {
      toast.error("Student ID verification required before offering to carry.")
      return
    }

    try {
      setIsSubmittingOffer(true)
      const { error } = await supabase.from("carry_offers").insert({
        request_id: offeringRequest.id,
        carrier_id: user.id,
        message: offerMessage.trim() || null,
        proposed_delivery_time: offerEta ? new Date(offerEta).toISOString() : null,
        status: "pending",
      })

      if (error) throw error

      toast.success("Offer submitted! The requester will review your proposal.")
      setOfferingRequest(null)
      setOfferMessage("")
      setOfferEta("")
      await fetchUserCarryData()
      setActiveTab("manage")
    } catch (err: any) {
      console.error("[CarryPage] Submit offer error:", err)
      toast.error(err.message || "Failed to submit offer.")
    } finally {
      setIsSubmittingOffer(false)
    }
  }

  // Accept Offer Handler (Calls atomic accept_carry_offer RPC)
  const handleAcceptOffer = async (offerId: string) => {
    try {
      setActionLoadingId(offerId)
      const { error } = await supabase.rpc("accept_carry_offer", {
        p_offer_id: offerId,
      })
      if (error) throw error
      toast.success("Offer accepted! Carrier has been assigned.")
      await fetchUserCarryData()
      await fetchCarryRequests()
    } catch (err: any) {
      console.error("[CarryPage] Accept offer error:", err)
      toast.error(err.message || "Failed to accept offer.")
    } finally {
      setActionLoadingId(null)
    }
  }

  // Update Status: In Transit
  const handleMarkInTransit = async (requestId: string) => {
    try {
      setActionLoadingId(requestId)
      const { error } = await supabase
        .from("carry_requests")
        .update({ status: "in_transit" })
        .eq("id", requestId)
      if (error) throw error
      toast.success("Package marked in-transit.")
      await fetchUserCarryData()
    } catch (err: any) {
      console.error("[CarryPage] In-transit error:", err)
      toast.error(err.message || "Failed to update status.")
    } finally {
      setActionLoadingId(null)
    }
  }

  // Update Status: Delivered
  const handleMarkDelivered = async (requestId: string) => {
    try {
      setActionLoadingId(requestId)
      const { error } = await supabase
        .from("carry_requests")
        .update({ status: "delivered" })
        .eq("id", requestId)
      if (error) throw error
      toast.success("Package marked as delivered!")
      await fetchUserCarryData()
    } catch (err: any) {
      console.error("[CarryPage] Delivered error:", err)
      toast.error(err.message || "Failed to mark delivered.")
    } finally {
      setActionLoadingId(null)
    }
  }



  // Submit Review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !reviewDelivery) return

    try {
      setIsSubmittingReview(true)
      const targetId = reviewDelivery.assigned_carrier_id || reviewDelivery.requester_id
      const { error } = await supabase.from("reviews").insert({
        reviewer_id: user.id,
        reviewee_id: targetId,
        exchange_type: "carry",
        carry_request_id: reviewDelivery.id,
        rating: reviewRating,
        comment: reviewComment.trim() || null,
      })
      if (error) throw error

      toast.success("Delivery feedback submitted!")
      setReviewDelivery(null)
      setReviewComment("")
      setReviewRating(5)
    } catch (err: any) {
      console.error("[CarryPage] Review submit error:", err)
      toast.error(err.message || "Failed to submit review.")
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const filteredRequests = requests.filter((r) => {
    const matchesSize = selectedSize === "all" || r.item_size === selectedSize
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch =
      !q ||
      r.item_title.toLowerCase().includes(q) ||
      r.pickup_location.toLowerCase().includes(q) ||
      r.delivery_location.toLowerCase().includes(q)
    return matchesSize && matchesSearch
  })

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-6xl mx-auto space-y-6 pt-2 pb-28 sm:pb-32 px-4 sm:px-6"
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-[11px] font-semibold">
            <Package className="size-3.5" />
            <span>Peer Deliveries & Campus Transport</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            CARRY — Peer Item Transport
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get textbooks, dorm packages, lab equipment, and food delivered across campus by students already headed that way.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
            >
              <Plus className="size-4" />
              <span>Request Delivery</span>
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
            Available Requests ({filteredRequests.length})
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
              My Requests & Offers ({myRequests.length + mySentOffers.length})
            </button>
          )}
        </div>

        {activeTab === "browse" && (
          <div className="relative w-full sm:w-64">
            <Input
              type="search"
              placeholder="Search pickup or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8.5 h-9 text-xs"
            />
            <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-2.5 pointer-events-none" />
          </div>
        )}
      </div>

      {/* BROWSE TAB */}
      {activeTab === "browse" && (
        <div className="space-y-4">
          {/* Size Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: "all", label: "All Sizes" },
              { id: "envelope", label: "Envelope / Document" },
              { id: "small_box", label: "Small Box" },
              { id: "backpack", label: "Backpack / Gear" },
              { id: "medium_box", label: "Medium Box" },
            ].map((size) => {
              const isSelected = selectedSize === size.id
              return (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => setSelectedSize(size.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground font-semibold"
                      : "border-border/80 bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {size.label}
                </button>
              )
            })}
          </div>

          {isLoading ? (
            <div className="min-h-[30vh] flex flex-col items-center justify-center space-y-3">
              <Loader2 className="size-7 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground font-mono">Loading delivery requests...</span>
            </div>
          ) : fetchError ? (
            <EmptyState
              variant="error"
              title="Failed to load delivery requests"
              description={fetchError}
              actionLabel="Try Again"
              onAction={fetchCarryRequests}
            />
          ) : requests.length === 0 ? (
            <EmptyState
              variant="no-data"
              title="No open delivery requests"
              description="No classmates have posted package delivery requests yet. Need a book, charger, or package moved across campus? Post your request!"
              actionLabel={user ? "Post Delivery Request" : undefined}
              onAction={user ? () => setIsCreateModalOpen(true) : undefined}
            />
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              variant="filtered-empty"
              title="No package requests match your filters"
              description={`No delivery requests match "${searchQuery || selectedSize}". Try clearing your search query or selecting "All Sizes".`}
              actionLabel="Clear Filters"
              onAction={() => {
                setSearchQuery("")
                setSelectedSize("all")
              }}
            />
          ) : (
            <div className={`grid gap-5 ${filteredRequests.length === 1 ? 'grid-cols-1 max-w-md' : filteredRequests.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-3xl' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
              {filteredRequests.map((req) => {
                const isRequester = user?.id === req.requester_id
                return (
                  <Card key={req.id} className="border-border/80 flex flex-col justify-between overflow-hidden shadow-xs hover:border-primary/40 transition-all">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-semibold truncate text-foreground">
                          {req.item_title}
                        </CardTitle>
                        <Badge className="text-[10px] capitalize font-bold">
                          {req.item_size.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs line-clamp-1">
                        {req.item_description || "Peer delivery request"}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 space-y-2 text-xs">
                      {/* Reward fee */}
                      <div className="flex items-baseline justify-between pt-1">
                        <div>
                          <span className="text-lg font-bold font-mono text-foreground">₹{req.reward_amount}</span>
                          <span className="text-[11px] text-muted-foreground font-medium"> peer reward</span>
                        </div>
                        {req.needed_by ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            <Clock className="size-2.5" />
                            <span>Needed by {new Date(req.needed_by).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-mono">Flexible timing</span>
                        )}
                      </div>

                      {/* Route */}
                      <div className="space-y-1.5 bg-muted/40 p-2.5 rounded-xl border border-border/60 text-[11px]">
                        <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                          <MapPin className="size-3 text-primary shrink-0" />
                          <span className="font-semibold text-foreground shrink-0">Pickup:</span>
                          <span className="truncate">{req.pickup_location}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                          <Navigation className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="font-semibold text-foreground shrink-0">Drop-off:</span>
                          <span className="truncate">{req.delivery_location}</span>
                        </div>
                      </div>

                      {req.needed_by && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                          <Clock className="size-3 text-primary shrink-0" />
                          <span>Needed by: {formatReadableDateTime(req.needed_by)}</span>
                        </div>
                      )}

                      {/* Requester Info & Profile */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                        <button
                          type="button"
                          onClick={() => setViewProfileStudentId(req.requester_id)}
                          className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer text-left"
                          title="View student profile & reputation"
                        >
                          <User className="size-3" />
                          <span className="font-medium underline-offset-2 hover:underline">{req.requester?.full_name || "Campus Student"}</span>
                        </button>
                        <div className="flex items-center gap-1.5">
                          {req.requester?.verification_status === "verified" && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <ShieldCheck className="size-3" />
                              <span>Verified</span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setReportTarget({ id: req.id, title: req.item_title, type: "carry" })}
                            className="text-muted-foreground/70 hover:text-destructive transition-colors cursor-pointer p-0.5"
                            title="Report this delivery request"
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
                        onClick={() => setRoutePreviewCarry(req)}
                        className="text-xs h-8 cursor-pointer gap-1 text-muted-foreground hover:text-foreground"
                        title="View Delivery Route Map"
                      >
                        <Navigation className="size-3" />
                        <span>Map</span>
                      </Button>

                      {isRequester ? (
                        <span className="text-xs text-muted-foreground italic flex-1 text-center py-1">
                          Your transport request
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setOfferingRequest(req)}
                          className="flex-1 text-xs font-semibold cursor-pointer shadow-xs gap-1.5"
                        >
                          <Truck className="size-3.5" />
                          <span>Offer to Carry</span>
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
          {/* Requester: My Requests & Incoming Offers */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Package className="size-4 text-primary" />
              <span>Deliveries You Requested</span>
            </h2>

            {myRequests.length === 0 ? (
              <EmptyState
                variant="no-data"
                title="No delivery requests posted"
                description="Need textbooks, lab gear, or dorm items transported across campus? Post a delivery request for nearby peers."
                actionLabel="Request Peer Delivery"
                onAction={() => setIsCreateModalOpen(true)}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myRequests.map((req) => (
                  <Card key={req.id} className="border-border/80">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm font-semibold">{req.item_title}</CardTitle>
                          <CardDescription className="text-xs">
                            {req.pickup_location} → {req.delivery_location}
                          </CardDescription>
                        </div>
                        <StatusBadge status={req.status} showIcon />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-1 text-xs text-muted-foreground">
                      <p>Reward fee: <span className="font-semibold text-foreground">₹{req.reward_amount}</span></p>
                      <p>Package size: <span className="capitalize">{req.item_size.replace(/_/g, " ")}</span></p>
                      {(req.status === "accepted" || req.status === "in_transit" || req.status === "delivered") && (
                        <ContactHandoffCard
                          service="carry"
                          requestId={req.id}
                        />
                      )}
                    </CardContent>
                    <CardFooter className="p-4 pt-2 border-t border-border/60 flex items-center justify-end gap-2 flex-wrap">
                      {req.status === "open" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCancelModalState({
                            isOpen: true,
                            requestId: req.id,
                            title: `Transport: ${req.item_title}`,
                          })}
                          className="text-xs h-8 text-destructive cursor-pointer hover:bg-destructive/10"
                        >
                          Cancel Request
                        </Button>
                      )}
                      {req.status === "accepted" && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            disabled={actionLoadingId === req.id}
                            onClick={() => handleMarkInTransit(req.id)}
                            className="text-xs h-8 cursor-pointer gap-1.5"
                          >
                            {actionLoadingId === req.id && <Loader2 className="size-3 animate-spin" />}
                            <span>Mark In-Transit</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDisputeModalState({
                              isOpen: true,
                              transactionId: req.id,
                              respondentId: req.assigned_carrier_id || "",
                              title: `Package: ${req.item_title}`,
                            })}
                            className="text-xs h-8 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 gap-1.5 cursor-pointer"
                          >
                            <ShieldAlert className="size-3.5" />
                            <span>File Dispute</span>
                          </Button>
                        </div>
                      )}
                      {req.status === "in_transit" && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            disabled={actionLoadingId === req.id}
                            onClick={() => handleMarkDelivered(req.id)}
                            className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1.5"
                          >
                            {actionLoadingId === req.id && <Loader2 className="size-3 animate-spin" />}
                            <span>Confirm Delivery Handoff</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDisputeModalState({
                              isOpen: true,
                              transactionId: req.id,
                              respondentId: req.assigned_carrier_id || "",
                              title: `Package: ${req.item_title}`,
                            })}
                            className="text-xs h-8 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 gap-1.5 cursor-pointer"
                          >
                            <ShieldAlert className="size-3.5" />
                            <span>File Dispute</span>
                          </Button>
                        </div>
                      )}
                      {req.status === "delivered" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReviewDelivery(req)}
                          className="text-xs h-8 gap-1.5 cursor-pointer"
                        >
                          <Star className="size-3.5 text-amber-500 fill-amber-500" />
                          <span>Rate Carrier</span>
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}

            {/* Incoming Carrier Offers */}
            {incomingOffers.length > 0 && (
              <div className="pt-2 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Carrier Offers on Your Requests</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {incomingOffers.map((offer) => (
                    <Card key={offer.id} className="border-border/80 p-3 flex flex-col justify-between">
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            Carrier: {offer.carrier?.full_name}
                          </span>
                          <StatusBadge status={offer.status} showIcon />
                        </div>
                        <p className="text-muted-foreground text-[11px]">
                          Item: {offer.request?.item_title}
                        </p>
                        {offer.message && <p className="italic text-muted-foreground text-[11px]">"{offer.message}"</p>}
                      </div>

                      {offer.status === "pending" && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60 mt-2">
                          <Button
                            size="sm"
                            disabled={actionLoadingId === offer.id}
                            onClick={() => handleAcceptOffer(offer.id)}
                            className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1.5"
                          >
                            {actionLoadingId === offer.id && <Loader2 className="size-3 animate-spin" />}
                            <span>Accept Carrier</span>
                          </Button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Carrier: My Sent Offers */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Truck className="size-4 text-primary" />
              <span>Deliveries You Offered to Carry</span>
            </h2>

            {mySentOffers.length === 0 ? (
              <EmptyState
                variant="no-data"
                title="No delivery offers submitted"
                description="Heading across campus? Check open delivery requests and earn rewards by carrying items along your route."
                actionLabel="Browse Campus Requests"
                onAction={() => setActiveTab("browse")}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mySentOffers.map((offer) => (
                  <Card key={offer.id} className="border-border/80">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm font-semibold">{offer.request?.item_title}</CardTitle>
                          <CardDescription className="text-xs">
                            {offer.request?.pickup_location} → {offer.request?.delivery_location}
                          </CardDescription>
                        </div>
                        <StatusBadge status={offer.status} showIcon />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-1 text-xs text-muted-foreground">
                      <p>Fee reward: <span className="font-semibold text-foreground">₹{offer.request?.reward_amount}</span></p>
                      {offer.message && <p className="italic text-[11px]">"{offer.message}"</p>}
                      {offer.status === "accepted" && (
                        <ContactHandoffCard
                          service="carry"
                          requestId={offer.request_id}
                        />
                      )}
                    </CardContent>
                    {offer.status === "accepted" && (
                      <CardFooter className="p-4 pt-2 border-t border-border/60 flex items-center justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewProfileStudentId(offer.request?.requester_id || null)}
                          className="text-xs h-7 gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
                        >
                          <MessageSquare className="size-3" />
                          <span>Contact Requester (WhatsApp)</span>
                        </Button>
                      </CardFooter>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Delivery Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
          <DialogHeader className="p-4 sm:p-5 border-b border-border/60 shrink-0">
            <DialogTitle className="text-base font-semibold">Request Peer Delivery</DialogTitle>
            <DialogDescription className="text-xs">
              Post an item that needs to be transported between campus locations.
            </DialogDescription>
          </DialogHeader>

          {!isVerified ? (
            <div className="p-6">
              <EmptyState
                variant="unverified"
                title="Student Verification Required"
                description="To prevent package loss and ensure campus trust, only verified students can request or carry peer packages. Upload your student ID to verify."
                actionLabel="Verify Student ID"
                onAction={() => {
                  setIsCreateModalOpen(false)
                  navigate("/verify-student")
                }}
              />
            </div>
          ) : (
            <form onSubmit={handleCreateRequest} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3.5 text-xs">
                <div className="space-y-1">
                  <Label htmlFor="c-title" className="text-xs font-semibold">Item Title *</Label>
                  <Input
                    id="c-title"
                    placeholder="e.g. Organic Chemistry Textbook & Notes"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    disabled={isSubmittingRequest}
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="c-size" className="text-xs font-semibold">Package Size *</Label>
                    <select
                      id="c-size"
                      value={newSize}
                      onChange={(e) => setNewSize(e.target.value as any)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                    >
                      <option value="envelope">Envelope / Doc</option>
                      <option value="small_box">Small Box</option>
                      <option value="backpack">Backpack / Bag</option>
                      <option value="medium_box">Medium Box</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="c-fee" className="text-xs font-semibold">Reward Fee (₹) *</Label>
                      <span className="text-[10px] text-muted-foreground font-mono">Peer UPI</span>
                    </div>
                    <Input
                      id="c-fee"
                      type="number"
                      placeholder="₹50"
                      value={newFee}
                      onChange={(e) => setNewFee(e.target.value)}
                      disabled={isSubmittingRequest}
                      className="h-9 text-xs font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="c-pickup" className="text-xs font-semibold">Pickup Location *</Label>
                    <button
                      type="button"
                      onClick={() => setLocationPickerTarget("pickup")}
                      className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <MapPin className="size-3" />
                      <span>Choose on Map</span>
                    </button>
                  </div>
                  <Input
                    id="c-pickup"
                    placeholder="e.g. MSRUAS Central Library / Science Block"
                    value={newPickup}
                    onChange={(e) => setNewPickup(e.target.value)}
                    disabled={isSubmittingRequest}
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="c-delivery" className="text-xs font-semibold">Delivery Destination *</Label>
                    <button
                      type="button"
                      onClick={() => setLocationPickerTarget("delivery")}
                      className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <MapPin className="size-3" />
                      <span>Choose on Map</span>
                    </button>
                  </div>
                  <Input
                    id="c-delivery"
                    placeholder="e.g. West Campus Dorm Block B Lobby"
                    value={newDelivery}
                    onChange={(e) => setNewDelivery(e.target.value)}
                    disabled={isSubmittingRequest}
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="c-deadline" className="text-xs font-semibold">Delivery Deadline (Optional)</Label>
                  <Input
                    id="c-deadline"
                    type="datetime-local"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    disabled={isSubmittingRequest}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="c-photo" className="text-xs font-semibold">Item Photo (Optional)</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">JPG, PNG, WEBP • Max 5MB</span>
                  </div>
                  {photoFile ? (
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/50 border border-border/80">
                      <div className="size-10 rounded-md bg-muted overflow-hidden shrink-0 border border-border">
                        <img
                          src={URL.createObjectURL(photoFile)}
                          alt="Package preview"
                          className="size-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{photoFile.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {(photoFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPhotoFile(null)}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        <X className="size-3.5" />
                        <span className="sr-only">Remove photo</span>
                      </Button>
                    </div>
                  ) : (
                    <Input
                      id="c-photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                      disabled={isSubmittingRequest}
                      className="h-9 text-xs cursor-pointer"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="c-desc" className="text-xs font-semibold">Notes for Carrier (Optional)</Label>
                  <Textarea
                    id="c-desc"
                    placeholder="Handle with care. Call when reaching lobby."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    disabled={isSubmittingRequest}
                    className="text-xs min-h-[60px]"
                  />
                </div>
              </div>

              <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 shrink-0 flex flex-row items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmittingRequest}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingRequest}
                  className="gap-1.5 cursor-pointer font-semibold"
                >
                  {isSubmittingRequest ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  <span>Post Request</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Offer to Carry Modal */}
      <Dialog open={!!offeringRequest} onOpenChange={(open) => !open && setOfferingRequest(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Offer to Carry</DialogTitle>
            <DialogDescription className="text-xs">
              Offer to transport {offeringRequest?.item_title}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmOffer} className="space-y-3 py-2 text-xs">
            <div className="p-2.5 rounded-lg bg-muted text-xs space-y-1">
              <p className="font-semibold text-foreground">{offeringRequest?.item_title}</p>
              <p className="text-muted-foreground">
                Route: {offeringRequest?.pickup_location} → {offeringRequest?.delivery_location}
              </p>
              <p className="font-mono text-primary font-bold">
                Reward: ₹{offeringRequest?.reward_amount}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="o-eta" className="text-xs">Estimated Delivery Time</Label>
              <Input
                id="o-eta"
                type="datetime-local"
                value={offerEta}
                onChange={(e) => setOfferEta(e.target.value)}
                disabled={isSubmittingOffer}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="o-msg" className="text-xs">Message / Route Plan</Label>
              <Textarea
                id="o-msg"
                placeholder="I am walking from Science block to West dorms right now and can drop this off on my way!"
                value={offerMessage}
                onChange={(e) => setOfferMessage(e.target.value)}
                disabled={isSubmittingOffer}
                className="text-xs min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOfferingRequest(null)}
                disabled={isSubmittingOffer}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingOffer}
                className="gap-1.5 cursor-pointer"
              >
                {isSubmittingOffer ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                <span>Send Offer</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review Modal */}
      <Dialog open={!!reviewDelivery} onOpenChange={(open) => !open && setReviewDelivery(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Rate Delivery Experience</DialogTitle>
            <DialogDescription className="text-xs">
              Provide feedback for the completed transport of {reviewDelivery?.item_title}.
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
                placeholder="Prompt delivery and careful handling!"
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
                onClick={() => setReviewDelivery(null)}
                disabled={isSubmittingReview}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmittingReview}>
                {isSubmittingReview ? <Loader2 className="size-3.5 animate-spin" /> : <span>Submit Feedback</span>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Map Location Picker */}
      <LocationPickerModal
        isOpen={!!locationPickerTarget}
        onClose={() => setLocationPickerTarget(null)}
        initialLocationName={locationPickerTarget === "pickup" ? newPickup : newDelivery}
        onSelect={(loc) => {
          if (locationPickerTarget === "pickup") {
            setNewPickup(loc.name)
          } else if (locationPickerTarget === "delivery") {
            setNewDelivery(loc.name)
          }
        }}
        title={locationPickerTarget === "pickup" ? "Select Campus Pickup Point" : "Select Campus Drop-off Point"}
      />

      {/* Delivery Route Preview Modal */}
      <Dialog open={!!routePreviewCarry} onOpenChange={(open) => !open && setRoutePreviewCarry(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden sm:rounded-2xl">
          <DialogHeader className="p-4 pb-2 border-b border-border/80">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Navigation className="size-4 text-accent" />
              <span>Package Transit Route Map</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {routePreviewCarry?.pickup_location} → {routePreviewCarry?.delivery_location}
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 space-y-3">
            <CampusMap
              height="280px"
              selectedLocation={{
                name: routePreviewCarry?.pickup_location || "Pickup",
                lat: 13.0308,
                lng: 77.5645,
              }}
              destinationLocation={{
                name: routePreviewCarry?.delivery_location || "Delivery",
                lat: 13.0322,
                lng: 77.5630,
              }}
              showRoute={true}
            />

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                <span className="text-[10px] text-muted-foreground uppercase font-mono block">Pickup:</span>
                <span className="font-semibold text-foreground truncate block">{routePreviewCarry?.pickup_location}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-[10px] text-muted-foreground uppercase font-mono block">Delivery Destination:</span>
                <span className="font-semibold text-foreground truncate block">{routePreviewCarry?.delivery_location}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 pt-2 border-t border-border/80">
            <Button size="sm" variant="outline" onClick={() => setRoutePreviewCarry(null)} className="text-xs">
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
          service="carry"
          requestId={cancelModalState.requestId}
          title={cancelModalState.title}
          onSuccess={async () => {
            setCancelModalState({ isOpen: false, requestId: "", title: "" })
            await fetchUserCarryData()
            await fetchCarryRequests()
          }}
        />
      )}

      {/* Transaction Dispute Modal */}
      {disputeModalState.isOpen && (
        <DisputeModal
          isOpen={disputeModalState.isOpen}
          onClose={() => setDisputeModalState({ isOpen: false, transactionId: "", respondentId: "", title: "" })}
          service="carry"
          transactionId={disputeModalState.transactionId}
          respondentId={disputeModalState.respondentId}
          transactionTitle={disputeModalState.title}
          onSuccess={() => {
            setDisputeModalState({ isOpen: false, transactionId: "", respondentId: "", title: "" })
          }}
        />
      )}
    </motion.div>
  )
}
