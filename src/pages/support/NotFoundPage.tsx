import { motion } from "motion/react"
import { useRouter } from "@/context/RouterContext"
import { ZenwayMascot } from "@/components/ui/ZenwayMascot"
import { Button } from "@/components/ui/button"
import { Home, Compass, KeyRound, Car } from "lucide-react"
import { pageTransitionVariants } from "@/lib/motion"

export function NotFoundPage() {
  const { navigate } = useRouter()

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-12 max-w-lg mx-auto"
    >
      <div className="relative mb-6">
        <ZenwayMascot pose="standing" size="lg" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary text-xs font-semibold tracking-wide uppercase font-mono mb-3">
        <Compass className="size-3.5" />
        <span>404 — Campus Route Not Found</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        Off the Campus Map
      </h1>
      <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
        The campus destination or page you're trying to reach doesn't exist or has moved. Check your link or head back to the main exchange hub.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
        <Button
          onClick={() => navigate("/")}
          className="gap-2 text-xs font-semibold shadow-xs cursor-pointer h-9 px-4"
        >
          <Home className="size-3.5" />
          <span>Back to Campus Home</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/rent")}
          className="gap-1.5 text-xs font-semibold cursor-pointer h-9 px-3"
        >
          <KeyRound className="size-3.5" />
          <span>Rent Vehicles</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/ride")}
          className="gap-1.5 text-xs font-semibold cursor-pointer h-9 px-3"
        >
          <Car className="size-3.5" />
          <span>Browse Rides</span>
        </Button>
      </div>
    </motion.div>
  )
}
