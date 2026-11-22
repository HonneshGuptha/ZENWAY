import * as React from "react"
import { useAuth } from "@/context/AuthContext"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  GraduationCap,
  Phone,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
} from "lucide-react"
import {
  SUPPORTED_UNIVERSITIES,
  DEFAULT_UNIVERSITY,
  MORE_UNIVERSITIES_NOTE,
  isValidUniversity,
} from "@/constants/universities"
import { isValidIndianPhone } from "@/utils/phone"
import { toast } from "sonner"

interface ProfileCompletionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void | Promise<void>
  serviceName?: string
}

export function ProfileCompletionModal({
  isOpen,
  onClose,
  onSuccess,
  serviceName = "this service",
}: ProfileCompletionModalProps) {
  const { profile, updateProfileDetails, missingProfileFields } = useAuth()

  const [university, setUniversity] = React.useState(profile?.university_name || DEFAULT_UNIVERSITY)
  const [phone, setPhone] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Sync state whenever modal opens or profile changes
  React.useEffect(() => {
    if (isOpen && profile) {
      setUniversity(profile.university_name || DEFAULT_UNIVERSITY)
      const rawDigits = (profile.phone_number || (profile as any).phone || "").replace(/\D/g, "")
      const tenDigits =
        rawDigits.length === 12 && rawDigits.startsWith("91")
          ? rawDigits.slice(2)
          : rawDigits.length === 11 && rawDigits.startsWith("0")
            ? rawDigits.slice(1)
            : rawDigits
      setPhone(tenDigits)
      setErrorMessage(null)
    }
  }, [isOpen, profile])

  const handleSaveAndContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!isValidUniversity(university)) {
      setErrorMessage("Please select a supported university.")
      return
    }

    if (!isValidIndianPhone(phone)) {
      setErrorMessage("Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).")
      return
    }

    try {
      setIsSubmitting(true)
      await updateProfileDetails({
        universityName: university,
        phoneNumber: phone,
      })

      toast.success("Profile completed successfully!")
      onClose()
      await onSuccess()
    } catch (err: any) {
      console.error("[ProfileCompletionModal] Save error:", err)
      setErrorMessage(err.message || "Failed to save profile. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isUnivMissing = missingProfileFields?.university ?? !profile?.university_name
  const isPhoneMissing = missingProfileFields?.phone ?? !(profile?.phone_number || (profile as any)?.phone)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-border/80 bg-card/95 backdrop-blur-md shadow-xl text-foreground">
        <DialogHeader className="space-y-2">
          <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1">
            <ShieldAlert className="size-6 text-primary" />
          </div>
          <DialogTitle className="font-heading text-xl font-bold text-foreground">
            Complete Your Student Profile
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            To proceed with {serviceName}, your university affiliation and verified phone number
            must be completed. Your typed form data is saved and will not be lost.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/10 text-destructive text-xs py-2">
            <AlertCircle className="size-4 shrink-0" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSaveAndContinue} className="space-y-4 py-2">
          {/* Missing fields summary badge */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Required updates:</span>
            {isUnivMissing && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/20">
                University Campus
              </span>
            )}
            {isPhoneMissing && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/20">
                10-Digit Mobile Phone
              </span>
            )}
          </div>

          {/* University selector */}
          <div className="space-y-1.5">
            <Label htmlFor="modal-university" className="text-xs font-semibold">
              University *
            </Label>
            <div className="relative">
              <select
                id="modal-university"
                required
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                disabled={isSubmitting}
                className="w-full h-10 pl-9 pr-8 text-xs rounded-md border border-input bg-background text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none cursor-pointer font-medium"
              >
                {SUPPORTED_UNIVERSITIES.map((univ) => (
                  <option key={univ.id} value={univ.name}>
                    {univ.name}
                  </option>
                ))}
              </select>
              <GraduationCap className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
            </div>
            <p className="text-[11px] text-primary/80 dark:text-primary/90 font-medium flex items-center gap-1 pt-0.5">
              <span>✦</span>
              <span>{MORE_UNIVERSITIES_NOTE}</span>
            </p>
          </div>

          {/* Phone number input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="modal-phone" className="text-xs font-semibold">
                Mobile Phone Number *
              </Label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {phone.length === 10 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3" />
                    Valid
                  </span>
                ) : (
                  "10-digit mobile"
                )}
              </span>
            </div>
            <div className="relative flex items-center">
              <div className="absolute left-3 flex items-center gap-1 pointer-events-none select-none text-muted-foreground">
                <Phone className="size-3.5" />
                <span className="text-xs font-semibold text-foreground font-mono">+91</span>
              </div>
              <Input
                id="modal-phone"
                type="tel"
                maxLength={10}
                required
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "")
                  setPhone(digits.slice(0, 10))
                }}
                disabled={isSubmitting}
                className="pl-16 pr-8 h-10 text-xs font-mono tracking-wide"
              />
              {phone.length === 10 && (
                <CheckCircle2 className="size-4 text-emerald-500 absolute right-3 pointer-events-none" />
              )}
            </div>
            <p className="text-[10px] text-muted-foreground leading-normal">
              Shared securely only with confirmed exchange peers during handoff.
            </p>
          </div>

          <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || phone.length !== 10}
              className="w-full sm:w-auto h-9 text-xs font-semibold gap-1.5 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <span>Save & Continue</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
