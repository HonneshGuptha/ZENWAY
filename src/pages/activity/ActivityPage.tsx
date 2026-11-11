import * as React from "react"
import { motion } from "motion/react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Activity,
  KeyRound,
  Car,
  Package,
  Clock,
  RefreshCw,
  Loader2,
  ArrowRight,
} from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"

interface UnifiedActivityItem {
  id: string
  service: "rent" | "ride" | "carry"
  role: "customer" | "provider"
  title: string
  subtitle: string
  status: string
  amount: number | null
  timestamp: string
  rawItem: any
}

export function ActivityPage() {
  const { user } = useAuth()
  const { navigate } = useRouter()

  const [activeService, setActiveService] = React.useState<"all" | "rent" | "ride" | "carry">("all")
  const [activeRole, setActiveRole] = React.useState<"all" | "customer" | "provider">("all")
  const [activities, setActivities] = React.useState<UnifiedActivityItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  const fetchAllActivities = React.useCallback(async () => {
    if (!user) return
    try {
      setIsLoading(true)
      const list: UnifiedActivityItem[] = []

      // 1. RENT: as renter
      const { data: rentAsCustomer } = await supabase
        .from("rental_requests")
        .select(`
          id, start_time, end_time, total_price, status, created_at,
          vehicle:vehicles(title, pickup_location)
        `)
        .eq("renter_id", user.id)

      if (rentAsCustomer) {
        rentAsCustomer.forEach((r: any) => {
          list.push({
            id: r.id,
            service: "rent",
            role: "customer",
            title: r.vehicle?.title || "Vehicle Rental",
            subtitle: `Pickup: ${r.vehicle?.pickup_location || "Campus"}`,
            status: r.status,
            amount: r.total_price,
            timestamp: r.created_at,
            rawItem: r,
          })
        })
      }

      // 2. RENT: as owner
      const { data: myVehicles } = await supabase
        .from("vehicles")
        .select("id")
        .eq("owner_id", user.id)

      const myVehIds = (myVehicles || []).map((v) => v.id)
      if (myVehIds.length > 0) {
        const { data: rentAsOwner } = await supabase
          .from("rental_requests")
          .select(`
            id, start_time, end_time, total_price, status, created_at,
            vehicle:vehicles(title, pickup_location),
            renter:public_profiles!rental_requests_renter_id_fkey(full_name)
          `)
          .in("vehicle_id", myVehIds)

        if (rentAsOwner) {
          rentAsOwner.forEach((r: any) => {
            list.push({
              id: r.id,
              service: "rent",
              role: "provider",
              title: `${r.vehicle?.title || "Vehicle"} (Rented by ${r.renter?.full_name || "Student"})`,
              subtitle: `Pickup: ${r.vehicle?.pickup_location || "Campus"}`,
              status: r.status,
              amount: r.total_price,
              timestamp: r.created_at,
              rawItem: r,
            })
          })
        }
      }

      // 3. RIDE: as passenger
      const { data: rideAsPassenger } = await supabase
        .from("ride_requests")
        .select(`
          id, seats_requested, status, created_at,
          ride:rides(origin_name, destination_name, price_per_seat)
        `)
        .eq("passenger_id", user.id)

      if (rideAsPassenger) {
        rideAsPassenger.forEach((r: any) => {
          list.push({
            id: r.id,
            service: "ride",
            role: "customer",
            title: `${r.ride?.origin_name} → ${r.ride?.destination_name}`,
            subtitle: `${r.seats_requested} seat(s) requested`,
            status: r.status,
            amount: (r.ride?.price_per_seat || 0) * r.seats_requested,
            timestamp: r.created_at,
            rawItem: r,
          })
        })
      }

      // 4. RIDE: as driver
      const { data: ridesAsDriver } = await supabase
        .from("rides")
        .select("id, origin_name, destination_name, departure_time, price_per_seat, status, created_at")
        .eq("driver_id", user.id)

      if (ridesAsDriver) {
        ridesAsDriver.forEach((r: any) => {
          list.push({
            id: r.id,
            service: "ride",
            role: "provider",
            title: `${r.origin_name} → ${r.destination_name} (Driver)`,
            subtitle: `Departure: ${new Date(r.departure_time).toLocaleString()}`,
            status: r.status,
            amount: r.price_per_seat,
            timestamp: r.created_at,
            rawItem: r,
          })
        })
      }

      // 5. CARRY: as requester
      const { data: carryAsCustomer } = await supabase
        .from("carry_requests")
        .select("id, item_title, pickup_location, delivery_location, reward_amount, status, created_at")
        .eq("requester_id", user.id)

      if (carryAsCustomer) {
        carryAsCustomer.forEach((c: any) => {
          list.push({
            id: c.id,
            service: "carry",
            role: "customer",
            title: c.item_title,
            subtitle: `${c.pickup_location} → ${c.delivery_location}`,
            status: c.status,
            amount: c.reward_amount,
            timestamp: c.created_at,
            rawItem: c,
          })
        })
      }

      // 6. CARRY: as carrier
      const { data: carryAsCarrier } = await supabase
        .from("carry_offers")
        .select(`
          id, status, created_at,
          request:carry_requests(item_title, pickup_location, delivery_location, reward_amount)
        `)
        .eq("carrier_id", user.id)

      if (carryAsCarrier) {
        carryAsCarrier.forEach((c: any) => {
          list.push({
            id: c.id,
            service: "carry",
            role: "provider",
            title: `${c.request?.item_title || "Item Delivery"} (Carrier Offer)`,
            subtitle: `${c.request?.pickup_location} → ${c.request?.delivery_location}`,
            status: c.status,
            amount: c.request?.reward_amount || 0,
            timestamp: c.created_at,
            rawItem: c,
          })
        })
      }

      // Sort by newest first
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setActivities(list)
    } catch (err: any) {
      console.error("[ActivityPage] Fetch error:", err)
      toast.error(err.message || "Failed to load activity.")
    } finally {
      setIsLoading(false)
    }
  }, [user])

  React.useEffect(() => {
    fetchAllActivities()
  }, [fetchAllActivities])

  const filteredList = activities.filter((item) => {
    const matchesService = activeService === "all" || item.service === activeService
    const matchesRole = activeRole === "all" || item.role === activeRole
    return matchesService && matchesRole
  })

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-5xl mx-auto space-y-6 pt-2 pb-16 px-4 sm:px-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-[11px] font-semibold">
            <Activity className="size-3.5" />
            <span>Campus Mobility Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            My Exchange Activity
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track your vehicle bookings, ride shares, and peer delivery milestones in real time.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchAllActivities}
          disabled={isLoading}
          className="gap-2 cursor-pointer"
        >
          <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Service Filter */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
          {[
            { id: "all", label: "All Services" },
            { id: "rent", label: "RENT", icon: KeyRound },
            { id: "ride", label: "RIDE", icon: Car },
            { id: "carry", label: "CARRY", icon: Package },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeService === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveService(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {Icon && <Icon className="size-3" />}
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
          {[
            { id: "all", label: "All Roles" },
            { id: "customer", label: "My Bookings" },
            { id: "provider", label: "My Listings" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveRole(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeRole === tab.id
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activities Feed */}
      {isLoading ? (
        <div className="min-h-[30vh] flex flex-col items-center justify-center space-y-3">
          <Loader2 className="size-7 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground font-mono">Loading activity history...</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-xl space-y-3 bg-muted/10">
          <Activity className="size-10 text-muted-foreground/50 mx-auto" />
          <h3 className="font-semibold text-sm text-foreground">No recent activity</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            You don't have any exchange transactions in this category yet.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => navigate("/rent")} className="text-xs cursor-pointer">
              Explore RENT
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/ride")} className="text-xs cursor-pointer">
              Explore RIDE
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/carry")} className="text-xs cursor-pointer">
              Explore CARRY
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map((item) => {
            const Icon =
              item.service === "rent"
                ? KeyRound
                : item.service === "ride"
                ? Car
                : Package

            const isAccepted = item.status === "accepted" || item.status === "active" || item.status === "in_transit"
            const isCompleted = item.status === "completed" || item.status === "delivered"
            const isPending = item.status === "pending" || item.status === "open" || item.status === "scheduled"

            return (
              <Card key={`${item.service}-${item.id}`} className="border-border/80 shadow-xs hover:border-primary/40 transition-colors">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                        item.service === "rent"
                          ? "bg-primary/10 text-primary"
                          : item.service === "ride"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-accent/10 text-accent"
                      }`}
                    >
                      <Icon className="size-4" />
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {item.title}
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                          {item.service}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono pt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          <span>{new Date(item.timestamp).toLocaleString()}</span>
                        </span>
                        {item.amount != null && item.amount > 0 && (
                          <span className="font-semibold text-foreground">₹{item.amount}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-border/40">
                    <Badge
                      variant={isAccepted ? "default" : isCompleted ? "default" : isPending ? "secondary" : "destructive"}
                      className="text-[10px] capitalize font-semibold"
                    >
                      {item.status.replace(/_/g, " ")}
                    </Badge>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/${item.service}`)}
                      className="text-xs h-8 gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <span>View</span>
                      <ArrowRight className="size-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
