import * as React from "react"
import { toast } from "sonner"
import {
  Award,
  Clock,
  AlertCircle,
  UploadCloud,
  Loader2,
  RefreshCw,
  Plus
} from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  getCurrentDrivingLicence,
  getActiveDraftDrivingLicence,
  submitDrivingLicenceWorkflow
} from "@/services/drivingLicenceService"

interface RenterDrivingLicenceCardProps {
  userId: string
}

export function RenterDrivingLicenceCard({ userId }: RenterDrivingLicenceCardProps) {
  const [currentDL, setCurrentDL] = React.useState<any | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isModalOpen, setIsModalOpen] = React.useState(false)

  // Form State
  const [licenceNumber, setLicenceNumber] = React.useState("")
  const [categories, setCategories] = React.useState<string[]>(["MCWG"])
  const [expiryDate, setExpiryDate] = React.useState("")
  const [frontFile, setFrontFile] = React.useState<File | null>(null)
  const [existingFrontPath, setExistingFrontPath] = React.useState<string | null>(null)
  const [backFile, setBackFile] = React.useState<File | null>(null)
  const [existingBackPath, setExistingBackPath] = React.useState<string | null>(null)
  const [activeDraftId, setActiveDraftId] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const loadDL = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await getCurrentDrivingLicence(userId)
      setCurrentDL(data)
    } catch (err: any) {
      console.error("[RenterDLCard] Failed to load DL:", err)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  React.useEffect(() => {
    if (userId) {
      loadDL()
    }
  }, [userId, loadDL])

  const handleOpenModal = async () => {
    setFormError(null)
    setIsModalOpen(true)

    // Check if there is an active draft to resume
    try {
      const draft = await getActiveDraftDrivingLicence(userId)
      if (draft) {
        setActiveDraftId(draft.id)
        if (draft.licence_number) setLicenceNumber(draft.licence_number)
        if (draft.licence_categories) setCategories(draft.licence_categories)
        if (draft.expiry_date) setExpiryDate(draft.expiry_date)
        if (draft.front_document_path) setExistingFrontPath(draft.front_document_path)
        if (draft.back_document_path) setExistingBackPath(draft.back_document_path)
      }
    } catch (err) {
      console.warn("Could not check draft DL:", err)
    }
  }

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const cleanNumber = licenceNumber.trim().toUpperCase()
    if (cleanNumber.length < 5) {
      setFormError("Driving licence number must be at least 5 alphanumeric characters.")
      return
    }
    if (categories.length === 0) {
      setFormError("Please select at least one driving licence category.")
      return
    }
    if (!expiryDate || new Date(expiryDate) <= new Date()) {
      setFormError("Please provide a valid future expiry date.")
      return
    }
    if (!frontFile && !existingFrontPath) {
      setFormError("Front document image is required.")
      return
    }

    try {
      setIsSubmitting(true)
      await submitDrivingLicenceWorkflow({
        licenceNumber: cleanNumber,
        licenceCategories: categories,
        expiryDate,
        frontFile,
        existingFrontPath,
        backFile,
        existingBackPath,
        existingSubmissionId: activeDraftId
      })

      toast.success("Driving licence submitted successfully for campus verification.")
      setIsModalOpen(false)
      setFrontFile(null)
      setExistingFrontPath(null)
      setBackFile(null)
      setExistingBackPath(null)
      setActiveDraftId(null)
      await loadDL()
    } catch (err: any) {
      console.error("DL submission failed:", err)
      setFormError(err.message || "Failed to submit driving licence.")
      toast.error(err.message || "Submission failed. Please check inputs and retry.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Card className="border-border/80 shadow-sm bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Award className="size-5" />
              </div>
              <div>
                <CardTitle className="font-heading text-base font-semibold text-foreground">
                  Motorized Vehicle Eligibility
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Driving licence credentials required for renting motorized two-wheelers and cars
                </CardDescription>
              </div>
            </div>

            {isLoading ? (
              <RefreshCw className="size-4 text-muted-foreground animate-spin" />
            ) : currentDL ? (
              <Badge
                variant="outline"
                className={`text-xs font-mono uppercase px-2 py-0.5 border ${
                  currentDL.status === "approved"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : currentDL.status === "pending"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    : currentDL.status === "rejected"
                    ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {currentDL.status === "approved" ? "Verified Active" : currentDL.status}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground border-border/60">
                Not Submitted
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3 text-xs">
          {isLoading ? (
            <div className="py-4 text-center text-muted-foreground font-mono">Loading credentials...</div>
          ) : currentDL ? (
            <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Licence Number</span>
                <span className="font-mono font-bold text-foreground">{currentDL.licence_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Categories</span>
                <span className="font-mono font-semibold text-primary">
                  {(currentDL.licence_categories || []).join(", ")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Expiry Date</span>
                <span className="font-mono text-foreground">
                  {currentDL.expiry_date
                    ? new Date(currentDL.expiry_date).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })
                    : "N/A"}
                </span>
              </div>

              {currentDL.status === "rejected" && currentDL.rejection_reason && (
                <div className="pt-2 border-t border-border/60 text-destructive text-xs">
                  <span className="font-semibold">Rejection Reason: </span>
                  {currentDL.rejection_reason}
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground leading-relaxed">
              To reserve motorcycles, geared bikes, e-scooters, or cars on ZENWAY, campus regulations require a verified Indian driving licence (MCWOG, MCWG, or LMV).
            </p>
          )}
        </CardContent>

        <CardFooter className="pt-1 pb-4 flex justify-end">
          <Button
            size="sm"
            onClick={handleOpenModal}
            className="gap-1.5 text-xs h-8 cursor-pointer font-semibold shadow-xs"
          >
            {currentDL?.status === "approved" ? (
              <>
                <RefreshCw className="size-3.5" />
                <span>Renew Driving Licence</span>
              </>
            ) : currentDL?.status === "rejected" ? (
              <>
                <Plus className="size-3.5" />
                <span>Resubmit Driving Licence</span>
              </>
            ) : currentDL?.status === "pending" ? (
              <>
                <Clock className="size-3.5" />
                <span>Update Submission</span>
              </>
            ) : (
              <>
                <Plus className="size-3.5" />
                <span>Submit Driving Licence</span>
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Submission & Renewal Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md bg-card border-border/80 text-foreground">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="font-heading text-lg font-bold">
                {currentDL?.status === "approved" ? "Renew Driving Licence" : "Submit Driving Licence"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Credentials are encrypted and reviewed by authorized campus administrators.
              </DialogDescription>
            </DialogHeader>

            {formError && (
              <div className="p-3 my-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-4 py-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="dl-number" className="text-xs font-medium">
                  Licence Number (e.g., KA0120230001234)
                </Label>
                <Input
                  id="dl-number"
                  placeholder="KA0120230001234"
                  value={licenceNumber}
                  onChange={(e) => setLicenceNumber(e.target.value.toUpperCase())}
                  className="font-mono text-xs uppercase"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Licence Categories</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "MCWOG", label: "MCWOG (Auto/Scooter)" },
                    { id: "MCWG", label: "MCWG (Geared Moto)" },
                    { id: "LMV", label: "LMV (Cars/Vans)" }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`p-2 rounded-lg border text-center transition-colors cursor-pointer text-[11px] ${
                        categories.includes(cat.id)
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      {cat.id}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dl-expiry" className="text-xs font-medium">
                  Expiry Date
                </Label>
                <Input
                  id="dl-expiry"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Front Document Image (Required)</Label>
                  {existingFrontPath && !frontFile && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                      Retained from draft
                    </span>
                  )}
                </div>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setFrontFile(e.target.files?.[0] || null)}
                  className="text-xs cursor-pointer"
                  required={!frontFile && !existingFrontPath}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Back Document Image (Optional)</Label>
                  {existingBackPath && !backFile && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                      Retained from draft
                    </span>
                  )}
                </div>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setBackFile(e.target.files?.[0] || null)}
                  className="text-xs cursor-pointer"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="text-xs h-8 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs h-8 font-semibold cursor-pointer gap-1.5 shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="size-3.5" />
                    <span>Submit for Review</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
