import * as React from "react"
import { motion } from "motion/react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "@/context/RouterContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Loader2,
  UploadCloud,
  FileCheck2,
  ShieldCheck,
  AlertCircle,
  FileText,
  X,
  Info,
  LogOut,
  QrCode,
} from "lucide-react"
import type { Database } from "@/types/database.types"
import { pageTransitionVariants } from "@/lib/motion"

type DocumentType = Database["public"]["Enums"]["document_type"]

export function VerifyStudentPage() {
  const { user, profile, latestVerification, refreshProfile, isVerified, isPending, signOut } = useAuth()
  const { navigate } = useRouter()

  const [studentIdNumber, setStudentIdNumber] = React.useState("")
  const [documentType, setDocumentType] = React.useState<DocumentType>("student_id_card")
  const [upiId, setUpiId] = React.useState(profile?.upi_id || "")
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [fileError, setFileError] = React.useState<string | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [dragActive, setDragActive] = React.useState(false)

  React.useEffect(() => {
    if (profile?.upi_id && !upiId) {
      setUpiId(profile.upi_id)
    }
  }, [profile?.upi_id, upiId])

  // If already verified or currently pending, forward to status page
  React.useEffect(() => {
    if (isVerified || isPending) {
      navigate("/verification-status", { replace: true })
    }
  }, [isVerified, isPending, navigate])

  const handleFileValidation = (file: File) => {
    setFileError(null)
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]

    if (!allowedTypes.includes(file.type)) {
      setFileError("Invalid format. Please upload JPG, PNG, WEBP, or PDF.")
      return false
    }

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      setFileError("File exceeds maximum 5MB size limit.")
      return false
    }

    setSelectedFile(file)
    return true
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileValidation(e.target.files[0])
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileValidation(e.dataTransfer.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!user) {
      navigate("/login")
      return
    }

    if (!studentIdNumber.trim() || studentIdNumber.trim().length < 3) {
      setErrorMessage("Please enter a valid student identification number (at least 3 characters).")
      return
    }

    if (!selectedFile) {
      setErrorMessage("Please attach an image or PDF of your student identification document.")
      return
    }

    const trimmedUpi = upiId.trim()
    if (!trimmedUpi) {
      setErrorMessage("Please enter your UPI ID. It is required for campus peer-to-peer payments.")
      return
    }

    if (!/^[a-zA-Z0-9._-]{2,32}@[a-zA-Z]{2,15}$/.test(trimmedUpi)) {
      setErrorMessage("Please enter a valid UPI ID (e.g. yourname@okhdfcbank or 9876543210@paytm).")
      return
    }

    try {
      setIsUploading(true)

      // 1. Upload to private 'student-ids' bucket with mandatory path: <user.id>/<timestamp>_<clean_filename>
      const cleanFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const filePath = `${user.id}/${Date.now()}_${cleanFileName}`

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("student-ids")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadErr) {
        console.error("[VerifyStudent] Storage upload error:", uploadErr)
        throw new Error(`Document upload failed: ${uploadErr.message}`)
      }

      // 2. Insert record into public.student_verifications
      const { error: insertErr } = await supabase
        .from("student_verifications")
        .insert({
          user_id: user.id,
          student_id_number: studentIdNumber.trim(),
          document_type: documentType,
          id_document_path: uploadData.path,
        })

      if (insertErr) {
        console.error("[VerifyStudent] Verification insert error:", insertErr)
        throw new Error(`Failed to record verification submission: ${insertErr.message}`)
      }

      // 3. Save provided UPI ID to profiles table
      const { error: upiErr } = await supabase
        .from("profiles")
        .update({
          upi_id: trimmedUpi,
        })
        .eq("id", user.id)

      if (upiErr) {
        console.error("[VerifyStudent] Profile UPI update error:", upiErr)
        throw new Error(`Failed to save UPI ID: ${upiErr.message}`)
      }

      // 4. Refresh user session state
      await refreshProfile()

      // 5. Navigate to status page
      navigate("/verification-status")
    } catch (err: any) {
      console.error("[VerifyStudent] Submission error:", err)
      setErrorMessage(err.message || "An unexpected error occurred during submission. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-[75vh] flex items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary text-xs font-semibold">
            <ShieldCheck className="size-3.5" />
            <span>Campus Trust & Identity Verification</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Student Identity Onboarding
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            Submit your university credentials for administrator review to unlock campus mobility exchanges.
          </p>
        </div>

        {/* Previous rejection banner if resubmitting */}
        {latestVerification?.status === "rejected" && (
          <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200">
            <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-xs font-semibold">Previous Submission Resubmission</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              {latestVerification.rejection_reason
                ? `Feedback: "${latestVerification.rejection_reason}"`
                : "Your previous submission required clearer documentation. Please upload a legible photo or PDF."}
            </AlertDescription>
          </Alert>
        )}

        {errorMessage && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/10 text-destructive text-xs">
            <AlertCircle className="size-4" />
            <AlertDescription className="font-medium">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <Card className="border-border/80 shadow-md bg-card/95">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5 pt-6">
              {/* Student ID Number */}
              <div className="space-y-1.5">
                <Label htmlFor="verif-id-num">Student ID / Roll Number *</Label>
                <Input
                  id="verif-id-num"
                  type="text"
                  required
                  placeholder="e.g. STU-2026-8941"
                  value={studentIdNumber}
                  onChange={(e) => setStudentIdNumber(e.target.value)}
                  disabled={isUploading}
                  className="h-10 text-sm font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  The unique student number displayed on your physical ID or campus portal.
                </p>
              </div>

              {/* Document Type */}
              <div className="space-y-1.5">
                <Label htmlFor="verif-doc-type">Document Proof Type *</Label>
                <Select
                  value={documentType}
                  onValueChange={(val) => setDocumentType(val as DocumentType)}
                  disabled={isUploading}
                >
                  <SelectTrigger id="verif-doc-type" className="h-10 text-sm">
                    <SelectValue placeholder="Select credential type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student_id_card">Physical Student ID Card</SelectItem>
                    <SelectItem value="enrollment_certificate">Official Enrollment Certificate</SelectItem>
                    <SelectItem value="tuition_receipt">Current Semester Tuition Receipt</SelectItem>
                    <SelectItem value="campus_portal_screenshot">University Student Portal Screenshot</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Document Upload Zone */}
              <div className="space-y-1.5">
                <Label>Official Credential Document (PDF, JPG, PNG) *</Label>

                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                    dragActive
                      ? "border-primary bg-primary/5"
                      : "border-border/80 hover:border-primary/50 bg-muted/20"
                  } ${selectedFile ? "border-emerald-500/50 bg-emerald-500/5" : ""}`}
                >
                  <input
                    type="file"
                    id="id-file-input"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={handleFileChange}
                    disabled={isUploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />

                  {selectedFile ? (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-3 text-left overflow-hidden">
                        <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <FileText className="size-5" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-medium text-foreground truncate max-w-[240px] sm:max-w-[320px]">
                            {selectedFile.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault()
                          setSelectedFile(null)
                        }}
                        className="size-8 text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 pointer-events-none">
                      <div className="size-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                        <UploadCloud className="size-5" />
                      </div>
                      <div className="text-xs">
                        <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        PDF, JPG, PNG, or WEBP up to 5MB
                      </p>
                    </div>
                  )}
                </div>

                {fileError && (
                  <p className="text-[11px] text-destructive font-medium">{fileError}</p>
                )}
              </div>

              {/* UPI ID Field (Required for P2P Settlements) */}
              <div className="space-y-1.5 p-3.5 rounded-xl border border-border/80 bg-muted/20">
                <div className="flex items-center gap-2">
                  <QrCode className="size-4 text-primary" />
                  <Label htmlFor="verif-upi-id" className="font-semibold text-foreground">
                    UPI ID (Required for Peer Settlement) *
                  </Label>
                </div>
                <Input
                  id="verif-upi-id"
                  type="text"
                  required
                  placeholder="e.g. handle@okhdfcbank or 9876543210@paytm"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  disabled={isUploading}
                  className="h-10 text-sm font-mono bg-background"
                />
                <p className="text-[11px] text-muted-foreground">
                  Your personal UPI handle will be used for direct peer-to-peer payments and QR code settlement in RIDE and RENT exchanges once approved.
                </p>
              </div>

              {/* Privacy Notice */}
              <div className="p-3 rounded-lg border border-border/60 bg-muted/30 text-[11px] text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Info className="size-3.5 text-primary" />
                  <span>Data Protection & Privacy Notice</span>
                </div>
                <p>
                  Documents are stored encrypted in a private, non-public bucket (`student-ids`). They are solely accessible to you and authorized campus administrators for verification review.
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2 pb-6">
              <Button
                type="submit"
                disabled={isUploading || !selectedFile}
                className="w-full h-10 font-semibold gap-2 cursor-pointer shadow-xs"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Uploading & Submitting Credentials...</span>
                  </>
                ) : (
                  <>
                    <FileCheck2 className="size-4" />
                    <span>Submit for Campus Verification</span>
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between w-full pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate("/")}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer h-8"
                >
                  Browse Exchange First
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={async () => {
                    await signOut()
                    navigate("/")
                  }}
                  className="text-xs text-destructive hover:bg-destructive/10 cursor-pointer h-8 gap-1.5"
                >
                  <LogOut className="size-3.5" />
                  <span>Sign Out</span>
                </Button>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </motion.div>
  )
}
