import { motion } from "motion/react"
import { useRouter } from "@/context/RouterContext"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Shield, ArrowLeft } from "lucide-react"
import { pageTransitionVariants } from "@/lib/motion"

export function PrivacyPage() {
  const { navigate } = useRouter()

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-4xl mx-auto space-y-6 pt-4 pb-12"
    >
      <div className="flex items-center justify-between pb-3 border-b border-border/80">
        <div className="flex items-center gap-2">
          <Shield className="size-6 text-emerald-600 dark:text-emerald-400" />
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Privacy Policy & Data Security
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-xs cursor-pointer">
          <ArrowLeft className="size-3.5" />
          <span>Back to Campus</span>
        </Button>
      </div>

      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-6 sm:p-8 space-y-6 text-xs text-muted-foreground leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-foreground">1. Student ID & Credential Privacy</h2>
            <p>
              Uploaded student ID cards and enrollment documents are kept strictly confidential inside a non-public Supabase storage bucket (`student-ids`). They are never exposed publicly, indexed, or shared with third-party advertisers. Only authorized campus administrators can review them to confirm enrollment.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-foreground">2. Communication & Contact Revelation</h2>
            <p>
              To protect student privacy and prevent unsolicited contact, phone numbers and direct WhatsApp links are cryptographically locked and revealed only after an exchange request is formally accepted by both parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-foreground">3. Location Information & Maps</h2>
            <p>
              Pickup and drop-off coordinates are processed via OpenStreetMap to visualize campus meeting spots. ZENWAY does not run continuous background GPS tracking when the application is not actively engaged in an exchange.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-foreground">4. Row Level Security (RLS)</h2>
            <p>
              All application tables are protected by PostgreSQL Row Level Security (RLS). Users can only access and modify their own data or public listings authorized by campus policies.
            </p>
          </section>
        </CardContent>
      </Card>
    </motion.div>
  )
}
