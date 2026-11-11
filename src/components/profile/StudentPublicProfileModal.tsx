import * as React from "react"
import { supabase } from "@/lib/supabase"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ShieldCheck,
  Star,
  CheckCircle2,
  Phone,
  MessageSquare,
  Lock,
  ShieldAlert,
  GraduationCap,
  Loader2,
} from "lucide-react"
import { ReportModal } from "@/components/safety/ReportModal"

interface PublicProfileData {
  id: string
  full_name: string
  university_name: string | null
  bio: string | null
  avatar_url: string | null
  verification_status: string
  created_at: string
  phone_number?: string | null
}

interface StudentReview {
  id: string
  rating: number
  comment: string | null
  exchange_type: string
  created_at: string
  reviewer?: {
    full_name: string
  }
}

interface StudentPublicProfileModalProps {
  isOpen: boolean
  onClose: () => void
  studentId: string
  // If true, caller has an active accepted booking/request with this student
  hasAcceptedBooking?: boolean
  directPhoneNumber?: string | null
}

export function StudentPublicProfileModal({
  isOpen,
  onClose,
  studentId,
  hasAcceptedBooking = false,
  directPhoneNumber,
}: StudentPublicProfileModalProps) {
  const [profile, setProfile] = React.useState<PublicProfileData | null>(null)
  const [reviews, setReviews] = React.useState<StudentReview[]>([])
  const [stats, setStats] = React.useState<{ completed: number; avgRating: number }>({
    completed: 0,
    avgRating: 5.0,
  })
  const [isLoading, setIsLoading] = React.useState(true)
  const [isReportOpen, setIsReportOpen] = React.useState(false)

  React.useEffect(() => {
    if (!isOpen || !studentId) return

    const loadData = async () => {
      try {
        setIsLoading(true)

        // 1. Fetch Student Profile
        const { data: profData, error: profErr } = await supabase
          .from("profiles")
          .select("id, full_name, university_name, bio, avatar_url, verification_status, created_at, phone_number")
          .eq("id", studentId)
          .maybeSingle()

        if (profErr) throw profErr
        setProfile(profData as unknown as PublicProfileData)

        // 2. Fetch Written Reviews where student is reviewee
        const { data: revData } = await supabase
          .from("reviews")
          .select(`
            id,
            rating,
            comment,
            exchange_type,
            created_at,
            reviewer:reviewer_id (
              full_name
            )
          `)
          .eq("reviewee_id", studentId)
          .order("created_at", { ascending: false })
          .limit(10)

        const loadedReviews = (revData || []).map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          exchange_type: r.exchange_type,
          created_at: r.created_at,
          reviewer: Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer,
        }))
        setReviews(loadedReviews)

        // 3. Compute ratings & completed count
        if (loadedReviews.length > 0) {
          const sum = loadedReviews.reduce((acc, curr) => acc + curr.rating, 0)
          setStats({
            completed: loadedReviews.length,
            avgRating: Number((sum / loadedReviews.length).toFixed(1)),
          })
        } else {
          setStats({ completed: 0, avgRating: 5.0 })
        }
      } catch (err) {
        console.error("[StudentPublicProfile] Error loading profile:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [isOpen, studentId])

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "ST"

  const displayPhone = directPhoneNumber || profile?.phone_number

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md p-0 overflow-hidden sm:rounded-2xl">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="size-6 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground font-mono">Loading student profile...</span>
            </div>
          ) : profile ? (
            <div>
              {/* Header Banner */}
              <div className="p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b border-border/80">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <Avatar className="size-14 border-2 border-background shadow-sm">
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold text-base">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-heading text-lg font-bold text-foreground">
                        {profile.full_name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <GraduationCap className="size-3.5" />
                        <span>{profile.university_name || "MSRUAS Campus"}</span>
                      </div>
                    </div>
                  </div>

                  {profile.verification_status === "verified" ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[10px] py-1">
                      <ShieldCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Verified</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Student Member
                    </Badge>
                  )}
                </div>

                {profile.bio && (
                  <p className="text-xs text-muted-foreground mt-3 italic bg-background/50 p-2.5 rounded-lg border border-border/50">
                    "{profile.bio}"
                  </p>
                )}

                {/* Reputation Badges */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="p-2.5 rounded-lg bg-card border border-border/80 flex items-center gap-2">
                    <Star className="size-4 text-amber-500 fill-amber-500 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-foreground">{stats.avgRating} / 5.0</span>
                      <p className="text-[10px] text-muted-foreground">Community Rating</p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-card border border-border/80 flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-primary shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-foreground">{stats.completed} Trips / Exchanges</span>
                      <p className="text-[10px] text-muted-foreground">Completed Safely</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Communication / Contact Reveal Section */}
              <div className="p-6 border-b border-border/80 bg-muted/20">
                <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider block mb-2">
                  Peer Contact & Communication
                </span>

                {hasAcceptedBooking && displayPhone ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs">
                      <span className="font-semibold block mb-1">Booking Confirmed — Direct Contact Unlocked:</span>
                      <p className="font-mono text-sm font-bold text-foreground">{displayPhone}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => window.open(`https://wa.me/${displayPhone.replace(/[^0-9]/g, "")}`, "_blank")}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-semibold cursor-pointer"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>WhatsApp Handoff</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { window.location.href = `tel:${displayPhone}` }}
                        className="flex-1 gap-1.5 text-xs font-semibold cursor-pointer"
                      >
                        <Phone className="size-3.5 text-primary" />
                        <span>Call Student</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border border-border/80 bg-card flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="p-2 rounded-md bg-muted text-muted-foreground shrink-0">
                      <Lock className="size-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-foreground block">Phone & WhatsApp Locked</span>
                      <span>Contact details are securely revealed after booking request acceptance.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Reviews Section */}
              <div className="p-6 space-y-3 max-h-60 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Peer Reviews & Feedback</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{reviews.length} reviews</span>
                </div>

                {reviews.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    No written reviews recorded yet for this student.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {reviews.map((rev) => (
                      <div key={rev.id} className="p-2.5 rounded-lg border border-border/70 bg-card space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground">
                            {rev.reviewer?.full_name || "Anonymous Student"}
                          </span>
                          <div className="flex items-center gap-0.5">
                            {[...Array(rev.rating)].map((_, i) => (
                              <Star key={i} className="size-3 text-amber-500 fill-amber-500" />
                            ))}
                          </div>
                        </div>
                        {rev.comment && <p className="text-xs text-muted-foreground">"{rev.comment}"</p>}
                        <div className="flex items-center justify-between text-[9px] text-muted-foreground/80 pt-0.5">
                          <span className="uppercase font-mono">{rev.exchange_type}</span>
                          <span>{new Date(rev.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-muted/40 border-t border-border/80 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsReportOpen(true)}
                  className="text-xs text-muted-foreground hover:text-destructive gap-1.5 cursor-pointer h-8"
                >
                  <ShieldAlert className="size-3.5" />
                  <span>Report User</span>
                </Button>

                <Button size="sm" variant="outline" onClick={onClose} className="text-xs cursor-pointer h-8">
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Safety Report Modal */}
      {profile && (
        <ReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          targetType="user"
          targetId={profile.id}
          targetTitle={profile.full_name}
        />
      )}
    </>
  )
}
