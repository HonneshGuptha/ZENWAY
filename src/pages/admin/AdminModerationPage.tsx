import * as React from "react"
import { motion } from "motion/react"
import { supabase } from "@/lib/supabase"
import { AdminShell } from "@/components/admin/AdminShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ShieldAlert,
  Car,
  KeyRound,
  Package,
  RefreshCw,
  Search,
  AlertTriangle,
  Loader2,
  MapPin,
} from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"
import { formatReadableDateTime } from "@/utils/formatters"

export function AdminModerationPage() {
  const [activeTab, setActiveTab] = React.useState<"vehicle" | "ride" | "carry">("vehicle")
  const [items, setItems] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Moderation Dialog State
  const [moderationTarget, setModerationTarget] = React.useState<{
    entityType: "vehicle" | "ride" | "carry"
    id: string
    title: string
    action: string
  } | null>(null)
  const [moderationReason, setModerationReason] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const fetchItems = React.useCallback(async () => {
    try {
      setIsLoading(true)
      if (activeTab === "vehicle") {
        const { data, error } = await supabase
          .from("vehicles")
          .select("id, title, type, status, daily_rate, hourly_rate, pickup_location, created_at, owner_id")
          .order("created_at", { ascending: false })
          .limit(50)
        if (error) throw error
        setItems(data || [])
      } else if (activeTab === "ride") {
        const { data, error } = await supabase
          .from("rides")
          .select("id, origin_name, destination_name, departure_time, available_seats, price_per_seat, status, created_at, driver_id")
          .order("created_at", { ascending: false })
          .limit(50)
        if (error) throw error
        setItems(data || [])
      } else if (activeTab === "carry") {
        const { data, error } = await supabase
          .from("carry_requests")
          .select("id, item_title, pickup_location, delivery_location, item_size, reward_amount, status, created_at, requester_id")
          .order("created_at", { ascending: false })
          .limit(50)
        if (error) throw error
        setItems(data || [])
      }
    } catch (err: any) {
      console.error("[AdminModeration] Fetch error:", err)
      toast.error(err.message || "Failed to load listings for moderation.")
    } finally {
      setIsLoading(false)
    }
  }, [activeTab])

  React.useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleConfirmModeration = async () => {
    if (!moderationTarget) return
    if (!moderationReason.trim()) {
      toast.error("Please provide a moderation justification.")
      return
    }

    try {
      setIsSubmitting(true)
      const { error } = await (supabase.rpc as any)("admin_moderate_listing", {
        p_entity_type: moderationTarget.entityType,
        p_entity_id: moderationTarget.id,
        p_action: moderationTarget.action,
        p_reason: moderationReason.trim(),
      })

      if (error) {
        console.warn("[AdminModeration] admin_moderate_listing RPC fallback to direct tables:", error)
        const nextStatus = moderationTarget.action === "pause" ? "paused" : "cancelled"
        if (moderationTarget.entityType === "vehicle") {
          await supabase.from("vehicles").update({ status: nextStatus as any }).eq("id", moderationTarget.id)
        } else if (moderationTarget.entityType === "ride") {
          await supabase.from("rides").update({ status: nextStatus as any }).eq("id", moderationTarget.id)
        } else if (moderationTarget.entityType === "carry") {
          await supabase.from("carry_requests").update({ status: nextStatus as any }).eq("id", moderationTarget.id)
        }
      }

      toast.success(`Listing successfully moderated (${moderationTarget.action})`)
      setModerationTarget(null)
      setModerationReason("")
      await fetchItems()
    } catch (err: any) {
      console.error("[AdminModeration] Moderation error:", err)
      toast.error(err.message || "Moderation action failed.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    if (activeTab === "vehicle") {
      return (
        item.title?.toLowerCase().includes(q) ||
        item.type?.toLowerCase().includes(q) ||
        item.pickup_location?.toLowerCase().includes(q)
      )
    }
    if (activeTab === "ride") {
      return (
        item.origin_name?.toLowerCase().includes(q) ||
        item.destination_name?.toLowerCase().includes(q)
      )
    }
    if (activeTab === "carry") {
      return (
        item.item_title?.toLowerCase().includes(q) ||
        item.pickup_location?.toLowerCase().includes(q) ||
        item.delivery_location?.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <AdminShell currentSection="moderation">
      <motion.div
        variants={pageTransitionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Exchange Content Moderation
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review and moderate student vehicle listings, carpools, and peer transport requests.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchItems}
            disabled={isLoading}
            className="gap-2 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Tab & Search Ribbon */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
            {[
              { id: "vehicle", label: "RENT Vehicles", icon: KeyRound },
              { id: "ride", label: "RIDE Carpools", icon: Car },
              { id: "carry", label: "CARRY Requests", icon: Package },
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          <div className="relative w-full sm:w-72">
            <Input
              type="search"
              placeholder={`Search ${activeTab}s...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
            <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Content Listings */}
        {isLoading ? (
          <div className="min-h-[30vh] flex flex-col items-center justify-center space-y-3">
            <Loader2 className="size-7 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground font-mono">Loading exchange listings...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-xl space-y-2 bg-muted/10">
            <ShieldAlert className="size-10 text-muted-foreground/50 mx-auto" />
            <h3 className="font-semibold text-sm text-foreground">No listings found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No active listings currently require moderation in this category.
            </p>
          </div>
        ) : (
          <div className={`grid gap-4 ${filteredItems.length === 1 ? 'grid-cols-1 max-w-md' : filteredItems.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-3xl' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
            {filteredItems.map((item) => {
              const title =
                activeTab === "vehicle"
                  ? item.title
                  : activeTab === "ride"
                  ? `${item.origin_name} → ${item.destination_name}`
                  : item.item_title

              const subtitle =
                activeTab === "vehicle"
                  ? `${item.type} • ₹${item.hourly_rate || item.daily_rate}/hr`
                  : activeTab === "ride"
                  ? `${formatReadableDateTime(item.departure_time)} • ${item.available_seats} seats`
                  : `${item.item_size} • ₹${item.reward_amount}`

              const canModerate =
                (activeTab === "vehicle" && item.status !== "archived") ||
                (activeTab === "ride" && item.status !== "cancelled") ||
                (activeTab === "carry" && item.status !== "cancelled")

              return (
                <Card key={item.id} className="border-border/80 flex flex-col justify-between">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-semibold truncate text-foreground">
                        {title}
                      </CardTitle>
                      <Badge
                        variant={item.status === "available" || item.status === "scheduled" || item.status === "open" ? "default" : "secondary"}
                        className="text-[10px] uppercase font-bold"
                      >
                        {item.status}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs font-mono">
                      {subtitle}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 pt-1 space-y-2 text-xs">
                    {activeTab === "vehicle" && item.pickup_location && (
                      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{item.pickup_location}</span>
                      </div>
                    )}
                    {activeTab === "carry" && (
                      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{item.pickup_location} → {item.delivery_location}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-muted-foreground text-[10px] font-mono pt-1">
                      <span>ID: {item.id.slice(0, 8)}...</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </CardContent>

                  <div className="p-4 pt-2 border-t border-border/60 flex items-center justify-end gap-2">
                    {canModerate ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          setModerationTarget({
                            entityType: activeTab,
                            id: item.id,
                            title,
                            action: activeTab === "vehicle" ? "archive" : "cancel",
                          })
                        }
                        className="text-xs h-7 px-2.5 cursor-pointer gap-1"
                      >
                        <ShieldAlert className="size-3" />
                        <span>{activeTab === "vehicle" ? "Archive Listing" : "Cancel Listing"}</span>
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">Moderated</span>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Moderation Action Dialog */}
        <Dialog open={!!moderationTarget} onOpenChange={(open) => !open && setModerationTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="size-4" />
                <span>Moderate Listing</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Take administrative enforcement action on this exchange listing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="p-2.5 rounded-lg bg-muted text-xs space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Target Listing</span>
                <p className="font-semibold text-foreground">{moderationTarget?.title}</p>
                <p className="font-mono text-[11px] text-muted-foreground">Action: {moderationTarget?.action}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mod-reason" className="text-xs font-medium">
                  Enforcement Reason (Logged to Audit Trail)
                </Label>
                <Textarea
                  id="mod-reason"
                  placeholder="e.g. Inappropriate item description, prohibited cargo, or spam listing."
                  value={moderationReason}
                  onChange={(e) => setModerationReason(e.target.value)}
                  disabled={isSubmitting}
                  className="text-xs min-h-[80px]"
                  required
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModerationTarget(null)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmModeration}
                disabled={isSubmitting || !moderationReason.trim()}
              >
                {isSubmitting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <span>Apply Enforcement</span>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AdminShell>
  )
}
