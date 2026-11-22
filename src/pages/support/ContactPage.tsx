import * as React from "react"
import { motion } from "motion/react"
import { useRouter } from "@/context/RouterContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Mail, MapPin, Send, ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { pageTransitionVariants } from "@/lib/motion"

export function ContactPage() {
  const { navigate } = useRouter()
  const [subject, setSubject] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [isSending, setIsSending] = React.useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in subject and message.")
      return
    }

    setIsSending(true)
    setTimeout(() => {
      setIsSending(false)
      toast.success("Message received by Campus Operations. We will reply to your registered campus email.")
      setSubject("")
      setMessage("")
    }, 800)
  }

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
          <Mail className="size-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Contact Campus Operations
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-xs cursor-pointer">
          <ArrowLeft className="size-3.5" />
          <span>Back to Campus</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card className="border-border/80 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <MapPin className="size-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-muted-foreground block">Campus Hub</span>
                <span className="text-xs font-bold text-foreground">Peenya Campus Desk</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              470-P, Peenya Industrial Area 4th Phase, Peenya, Bengaluru – 560058, Karnataka
            </p>
          </Card>

          <Card className="border-border/80 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <Mail className="size-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-muted-foreground block">Email Desk</span>
                <a
                  href="mailto:zenway.campusmobility@gmail.com"
                  className="text-xs font-bold text-foreground hover:underline block break-all"
                >
                  zenway.campusmobility@gmail.com
                </a>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Response time within 24 hours during working campus days.
            </p>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold">Send Direct Inquiry</CardTitle>
              <CardDescription className="text-xs">
                Submit questions regarding verification, vehicle listings, safety, or partnership opportunities.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-sub" className="text-xs font-medium">Subject *</Label>
                  <Input
                    id="contact-sub"
                    placeholder="e.g. Question about vehicle verification status"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contact-msg" className="text-xs font-medium">Message *</Label>
                  <Textarea
                    id="contact-msg"
                    placeholder="Please include relevant booking IDs, student IDs, or listing details..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    className="text-xs min-h-[120px]"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSending}
                  className="w-full sm:w-auto text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Sending Inquiry...</span>
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      <span>Send to Operations Desk</span>
                    </>
                  )}
                </Button>
              </CardContent>
            </form>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
