import * as React from "react"
import { motion } from "motion/react"
import { useRouter } from "@/context/RouterContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  HelpCircle,
  ArrowLeft,
  KeyRound,
  Car,
  Package,
  ChevronDown,
} from "lucide-react"
import { pageTransitionVariants } from "@/lib/motion"

const FAQS = [
  {
    q: "How does the registration approval process work?",
    a: "After you sign up with your campus email, a campus administrator reviews your application in the administrative queue. Once approved, you can log in immediately. To participate in RENT, RIDE, or CARRY, you will then submit your student ID card for identity verification.",
  },
  {
    q: "Why do I need to verify my student ID?",
    a: "ZENWAY is an accredited campus community. Verifying student IDs ensures that all vehicle lenders, drivers, and carriers are verified students, eliminating unknown external actors and maintaining campus safety.",
  },
  {
    q: "How do RENT bookings work?",
    a: "Vehicle owners list their cycle, e-scooter, or car with daily/hourly rates. Renters choose dates and submit a request. The owner reviews the request and accepts it. Once accepted, both parties unlock direct WhatsApp and phone contact for key handoff.",
  },
  {
    q: "How does RIDE carpooling calculate costs?",
    a: "Drivers publish upcoming trips with available seats and an expense-sharing contribution per seat. Riders reserve seats. The system prevents overbooking and restores available seats automatically if a rider cancels.",
  },
  {
    q: "What is CARRY peer package delivery?",
    a: "If you need a lab manual, food item, or heavy parcel carried across campus or from the metro station, post a CARRY request with a reward amount. Peers heading in that direction submit carrier offers.",
  },
  {
    q: "When can other students see my phone number?",
    a: "Never before an exchange is confirmed. Your phone number is strictly locked until a request is accepted by both parties, ensuring complete privacy during browsing.",
  },
]

export function HelpPage() {
  const { navigate } = useRouter()
  const [openIndex, setOpenIndex] = React.useState<number | null>(0)

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
          <HelpCircle className="size-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Help Center & Community Guidelines
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-xs cursor-pointer">
          <ArrowLeft className="size-3.5" />
          <span>Back to Campus</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/80 p-4 space-y-2">
          <div className="p-2 w-fit rounded-lg bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <h3 className="font-bold text-sm text-foreground">RENT Mobility</h3>
          <p className="text-xs text-muted-foreground">
            Learn about helmet safety, vehicle inspections, deposit practices, and return procedures.
          </p>
        </Card>

        <Card className="border-border/80 p-4 space-y-2">
          <div className="p-2 w-fit rounded-lg bg-emerald-500/10 text-emerald-600">
            <Car className="size-5" />
          </div>
          <h3 className="font-bold text-sm text-foreground">RIDE Carpooling</h3>
          <p className="text-xs text-muted-foreground">
            Campus pickup etiquette, punctual departures, luggage limits, and fuel cost splitting.
          </p>
        </Card>

        <Card className="border-border/80 p-4 space-y-2">
          <div className="p-2 w-fit rounded-lg bg-amber-500/10 text-amber-600">
            <Package className="size-5" />
          </div>
          <h3 className="font-bold text-sm text-foreground">CARRY Deliveries</h3>
          <p className="text-xs text-muted-foreground">
            Item size guidelines, handoff inspection, safe handling, and delivery confirmation.
          </p>
        </Card>
      </div>

      <Card className="border-border/80 shadow-xs">
        <CardHeader>
          <CardTitle className="text-base font-bold">Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border/60">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx
            return (
              <div key={idx} className="py-3">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between text-left font-semibold text-xs text-foreground cursor-pointer group"
                >
                  <span className="group-hover:text-primary transition-colors">{faq.q}</span>
                  <ChevronDown
                    className={`size-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-2 ${
                      isOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="text-xs text-muted-foreground pt-2 pl-1 leading-relaxed">
                    {faq.a}
                  </p>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </motion.div>
  )
}
