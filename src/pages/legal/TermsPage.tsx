import { motion } from "motion/react"
import { useRouter } from "@/context/RouterContext"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BookOpen } from "lucide-react"
import { pageTransitionVariants } from "@/lib/motion"

export function TermsPage() {
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
          <BookOpen className="size-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Terms of Service
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
            <h2 className="text-sm font-bold text-foreground">1. Campus Community Eligibility</h2>
            <p>
              ZENWAY is an exclusive university peer-to-peer mobility and transit exchange designed specifically for students, faculty, and accredited campus members. All accounts require valid university institutional email confirmation and campus administrator verification.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-foreground">2. Vehicle Rental & Micro-Mobility (RENT)</h2>
            <p>
              Owners listing bicycles, electric scooters, motorcycles, or cars must ensure the equipment is roadworthy and complies with local traffic laws. Renters assume full responsibility for equipment care during the confirmed booking interval.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-foreground">3. Ride-Sharing & Carpooling (RIDE)</h2>
            <p>
              RIDE facilitates non-commercial carpooling and cost-sharing strictly among campus peers. Drivers must hold a valid driver's license. Price contributions are restricted to proportional fuel and toll expense reimbursement.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-foreground">4. Peer Package Transport (CARRY)</h2>
            <p>
              CARRY connects students needing academic materials, lab items, or dorm deliveries across campus. Transport of hazardous, illegal, or prohibited materials is strictly prohibited and results in immediate permanent suspension and campus disciplinary referral.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-foreground">5. Zero Tolerance for Misconduct</h2>
            <p>
              Campus safety is ZENWAY's paramount directive. Any harassment, dangerous driving, discrimination, or fraud reported via the safety queue will trigger immediate account suspension and review by university authorities.
            </p>
          </section>
        </CardContent>
      </Card>
    </motion.div>
  )
}
