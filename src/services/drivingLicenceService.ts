import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"

export type RenterDLStatus = Database["public"]["Tables"]["renter_driving_licences"]["Row"]["status"]

export interface SubmitDrivingLicenceParams {
  licenceNumber: string
  licenceCategories: string[]
  expiryDate: string
  frontFile?: File | Blob | null
  frontFileName?: string
  existingFrontPath?: string | null
  backFile?: File | Blob | null
  backFileName?: string
  existingBackPath?: string | null
  existingSubmissionId?: string | null
}

export interface SubmitDrivingLicenceResult {
  success: boolean
  submissionId: string
  frontPath: string
  backPath: string | null
}

function getFileExtension(file: File | Blob, customName?: string): string {
  const name = customName || (file instanceof File ? file.name : "")
  const parts = name.split(".")
  if (parts.length > 1) {
    const ext = parts.pop()?.toLowerCase() || ""
    if (["jpg", "jpeg", "png", "webp", "pdf"].includes(ext)) {
      return ext
    }
  }
  if (file.type === "image/png") return "png"
  if (file.type === "image/webp") return "webp"
  if (file.type === "application/pdf") return "pdf"
  return "jpg"
}

function generateUploadId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12)
  }
  return Math.random().toString(36).substring(2, 14)
}

/**
 * Executes the Phase A Submission-First Driving Licence Workflow:
 * 1. Authenticates current user.
 * 2. Invokes create_renter_dl_submission RPC (or uses existingDraftId) to acquire a server-bound submission ID.
 *    Resumes existing draft if one is already in progress.
 * 3. Uploads front and optional back documents into private 'driving-licences' storage
 *    under <user_id>/<submission_id>/<side>_<upload_id>.<ext> (allows safe replacement/retry via upsert: true).
 * 4. Calls submit_renter_dl RPC to validate storage objects, atomically supersede previous
 *    active licence (if any), and transition the draft record to pending review.
 */
export async function submitDrivingLicenceWorkflow(
  params: SubmitDrivingLicenceParams
): Promise<SubmitDrivingLicenceResult> {
  const {
    licenceNumber,
    licenceCategories,
    expiryDate,
    frontFile,
    frontFileName,
    existingFrontPath,
    backFile,
    backFileName,
    existingBackPath,
    existingSubmissionId
  } = params

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error("Authentication required: Please sign in before submitting your driving licence.")
  }
  const userId = user.id

  // Pre-validate inputs
  const cleanLicenceNumber = (licenceNumber || "").trim().toUpperCase()
  if (cleanLicenceNumber.length < 5) {
    throw new Error("Invalid licence number: Must be at least 5 alphanumeric characters.")
  }
  if (!licenceCategories || licenceCategories.length === 0) {
    throw new Error("Invalid categories: Please select at least one driving licence category.")
  }
  if (!expiryDate || new Date(expiryDate) <= new Date()) {
    throw new Error("Invalid expiry date: Driving licence must not be expired.")
  }
  if (!frontFile && !existingFrontPath) {
    throw new Error("Missing document: Front driving licence image is required.")
  }

  // 2. Step 1: Create or resume unfinalized draft submission record
  let submissionId = existingSubmissionId || null
  if (!submissionId) {
    const { data: subId, error: createError } = await supabase.rpc("create_renter_dl_submission")
    if (createError || !subId) {
      throw new Error(`Failed to initiate driving licence submission: ${createError?.message || "Unknown error"}`)
    }
    submissionId = subId
  }

  // 3. Step 2: Upload documents into private storage bound to draft submission folder
  let frontPath = existingFrontPath || null
  if (frontFile) {
    const frontExt = getFileExtension(frontFile, frontFileName)
    const frontUploadId = generateUploadId()
    frontPath = `${userId}/${submissionId}/front_${frontUploadId}.${frontExt}`

    const { error: frontUploadError } = await supabase.storage
      .from("driving-licences")
      .upload(frontPath, frontFile, {
        cacheControl: "3600",
        upsert: true
      })

    if (frontUploadError) {
      throw new Error(`Failed to upload front licence document: ${frontUploadError.message}`)
    }
  }

  if (!frontPath) {
    throw new Error("Front driving licence path is missing.")
  }

  let backPath: string | null = existingBackPath || null
  if (backFile) {
    const backExt = getFileExtension(backFile, backFileName)
    const backUploadId = generateUploadId()
    backPath = `${userId}/${submissionId}/back_${backUploadId}.${backExt}`

    const { error: backUploadError } = await supabase.storage
      .from("driving-licences")
      .upload(backPath, backFile, {
        cacheControl: "3600",
        upsert: true
      })

    if (backUploadError) {
      throw new Error(`Failed to upload back licence document: ${backUploadError.message}`)
    }
  }

  // 4. Step 3: Finalize submission via submit_renter_dl RPC
  const { error: finalizeError } = await supabase.rpc("submit_renter_dl", {
    p_submission_id: submissionId,
    p_licence_number: cleanLicenceNumber,
    p_licence_categories: licenceCategories,
    p_expiry_date: expiryDate,
    p_front_document_path: frontPath,
    p_back_document_path: backPath
  })

  if (finalizeError) {
    throw new Error(`Failed to finalize driving licence submission: ${finalizeError.message}`)
  }

  return {
    success: true,
    submissionId,
    frontPath,
    backPath
  }
}

/**
 * Fetches the user's current driving licence record (if any).
 * Ignores draft / unfinalized submissions.
 */
export async function getCurrentDrivingLicence(userId: string) {
  const { data, error } = await supabase
    .from("renter_driving_licences")
    .select("*")
    .eq("user_id", userId)
    .eq("is_current", true)
    .neq("status", "draft")
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load driving licence: ${error.message}`)
  }

  return data
}

/**
 * Fetches an active draft submission for the renter to enable resume/retry.
 */
export async function getActiveDraftDrivingLicence(userId: string) {
  const { data, error } = await supabase
    .from("renter_driving_licences")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "draft")
    .eq("is_current", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return null
  }

  return data
}
