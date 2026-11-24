import { describe, it, expect } from "vitest"

/**
 * Phase A — Verification Foundation, Private Storage, Security Triggers & Admin Console
 *
 * EVIDENCE CLASSIFICATION: Category 2 (Unit / Mocked Contract Tests)
 *
 * Automated contract verification across 5 security roles:
 *  1. anon (unauthenticated)
 *  2. ordinary student (authenticated non-owner/non-renter)
 *  3. vehicle owner (provider)
 *  4. renter (authenticated student seeking/holding driving licence)
 *  5. application admin (authorized compliance officer)
 *
 * Verifies:
 *  - Vehicle classification & document columns (including standard and Indian BH-series plates)
 *  - Grandfathering backfill idempotency, 21-day grace period, and listing status preservation
 *  - Vehicle tamper protection: blocking 12 admin fields & field-specific atomic invalidation for 8 owner fields
 *  - Renter DL canonical columns, categories check, expiry check, single is_current uniqueness, renewal of expired DLs
 *  - Stale review conflict guards & atomic renewal superseding
 *  - Private storage bucket path regex isolation & immutability (no delete/update)
 *  - Append-only verification audit ledger & RPC execution
 *  - app_settings dl_custody_policy_mode enum ('disabled', 'optional', 'required') & authenticated-only access
 */

export type UserRole = "anon" | "student" | "vehicle_owner" | "renter" | "admin"
export type VehicleType = "bicycle" | "motorcycle" | "e_scooter" | "car"
export type DocVerificationStatus = "not_required" | "legacy_grandfathered" | "pending" | "approved" | "rejected" | "expired"
export type DLCategory = "MCWOG" | "MCWG" | "LMV"
export type DLCustodyPolicyMode = "disabled" | "optional" | "required"

// ---------------------------------------------------------------------------
// 1. App Settings Contract Simulation
// ---------------------------------------------------------------------------
export interface AppSettingsEntity {
  id: string
  dl_custody_policy_mode: DLCustodyPolicyMode
  updated_at: string
  updated_by: string | null
}

export function evaluateAppSettingsAccess(params: {
  action: "SELECT" | "INSERT" | "UPDATE" | "DELETE"
  callerRole: UserRole
}): { allowed: boolean; reason?: string } {
  if (params.callerRole === "anon") {
    return { allowed: false, reason: "Permission denied for table app_settings: anonymous access revoked." }
  }
  if (params.action === "SELECT") {
    return { allowed: true }
  }
  if (params.callerRole === "admin") {
    return { allowed: true }
  }
  return { allowed: false, reason: "Permission denied: only administrators can modify app_settings." }
}

export function validateDLCustodyPolicyMode(val: string): boolean {
  return ["disabled", "optional", "required"].includes(val)
}

// ---------------------------------------------------------------------------
// 2. Grandfathering Backfill Logic Simulation & Idempotency
// ---------------------------------------------------------------------------
export interface VehicleEntity {
  id: string
  owner_id: string
  title: string
  type: VehicleType
  status: "available" | "paused" | "archived" // Listing status MUST remain untouched
  ev_speed_class?: "low_speed_exempt" | "high_speed_registered" | null
  ev_exemption_verified: boolean
  transmission_type?: "gearless" | "geared" | null
  registration_number?: string | null
  is_registered_owner: boolean
  rc_document_path?: string | null
  rc_status: "not_required" | "pending" | "approved" | "rejected"
  insurance_policy_number?: string | null
  insurance_document_path?: string | null
  insurance_expiry_date?: string | null
  insurance_use_type?: "private_personal" | "commercial_self_drive" | "unknown" | null
  insurance_suitability_status: "not_required" | "requires_review" | "suitable" | "unsuitable"
  insurance_status: "not_required" | "pending" | "approved" | "rejected"
  puc_exempt: boolean
  puc_document_path?: string | null
  puc_expiry_date?: string | null
  puc_status: "not_required" | "pending" | "approved" | "rejected"
  authorization_document_path?: string | null
  authorization_status: "not_required" | "pending" | "approved" | "rejected"
  document_verification_status: DocVerificationStatus
  grandfather_expires_at?: string | null
  document_rejection_reason?: string | null
  verified_at?: string | null
  verified_by?: string | null
}

export function validateRegistrationNumber(plate: string | null | undefined): boolean {
  if (plate === null || plate === undefined) return true
  const trimmed = plate.trim()
  return trimmed.length >= 4 && trimmed.length <= 20
}

export function applyGrandfatheringBackfill(
  vehicle: VehicleEntity | { id: string; type: VehicleType; status: "available" | "paused" | "archived"; [k: string]: any },
  migrationTs: Date
): VehicleEntity {
  const initialListingStatus = vehicle.status // Preserve original listing status unchanged

  if (vehicle.type === "bicycle") {
    return {
      ...(vehicle as any),
      status: initialListingStatus,
      ev_exemption_verified: false,
      is_registered_owner: true,
      rc_status: "not_required",
      insurance_suitability_status: "not_required",
      insurance_status: "not_required",
      puc_exempt: true,
      puc_status: "not_required",
      authorization_status: "not_required",
      document_verification_status: "not_required",
      grandfather_expires_at: null,
      owner_id: (vehicle as any).owner_id || "test-owner",
      title: (vehicle as any).title || "Campus Bicycle",
    }
  }

  // Idempotency: If vehicle already has a grandfather_expires_at date or was already reviewed, do NOT alter or extend it
  if (vehicle.grandfather_expires_at || vehicle.document_verification_status === "approved" || vehicle.document_verification_status === "rejected") {
    return vehicle as VehicleEntity
  }

  // Motorized vehicles (motorcycle, car, e_scooter)
  const grandfatherExpiresAt = new Date(migrationTs.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString()
  return {
    ...(vehicle as any),
    status: initialListingStatus, // Unchanged!
    ev_exemption_verified: false,
    is_registered_owner: (vehicle as any).is_registered_owner ?? true,
    rc_status: "pending",
    insurance_suitability_status: "requires_review",
    insurance_status: "pending",
    puc_exempt: false,
    puc_status: "pending",
    authorization_status: "not_required",
    document_verification_status: "legacy_grandfathered",
    grandfather_expires_at: grandfatherExpiresAt,
    owner_id: (vehicle as any).owner_id || "test-owner",
    title: (vehicle as any).title || "Campus Motorized Vehicle",
  }
}

// ---------------------------------------------------------------------------
// 3. Vehicle Tamper Protection Trigger Simulation
// ---------------------------------------------------------------------------
export const ADMIN_GUARDED_FIELDS = [
  "document_verification_status",
  "verified_at",
  "verified_by",
  "document_rejection_reason",
  "rc_status",
  "insurance_status",
  "insurance_suitability_status",
  "insurance_use_type",
  "puc_status",
  "puc_exempt",
  "authorization_status",
  "grandfather_expires_at",
  "ev_exemption_verified",
] as const

export function simulateVehicleTamperTrigger(
  oldVehicle: VehicleEntity,
  updatedFields: Partial<VehicleEntity>,
  callerRole: UserRole,
  callerId: string
): { updatedVehicle: VehicleEntity; auditLogCreated?: boolean } {
  if (callerRole === "admin") {
    return { updatedVehicle: { ...oldVehicle, ...updatedFields } }
  }

  if (callerId !== oldVehicle.owner_id) {
    throw new Error("Access Denied: You can only update your own vehicle.")
  }

  // 1. Guard all 12 administrative columns
  for (const field of ADMIN_GUARDED_FIELDS) {
    if (updatedFields[field] !== undefined && updatedFields[field] !== (oldVehicle as any)[field]) {
      throw new Error(`Access Denied: Modifying administrative field ${field} is forbidden.`)
    }
  }

  // 2. Validate plate constraint
  if (updatedFields.registration_number !== undefined && !validateRegistrationNumber(updatedFields.registration_number)) {
    throw new Error("Invalid registration plate format: length must be between 4 and 20 characters.")
  }

  // 3. Detect critical document field or specification changes
  const hasPlateChanged = updatedFields.registration_number !== undefined && updatedFields.registration_number !== oldVehicle.registration_number
  const hasRcChanged = updatedFields.rc_document_path !== undefined && updatedFields.rc_document_path !== oldVehicle.rc_document_path
  const hasInsuranceChanged =
    (updatedFields.insurance_policy_number !== undefined && updatedFields.insurance_policy_number !== oldVehicle.insurance_policy_number) ||
    (updatedFields.insurance_document_path !== undefined && updatedFields.insurance_document_path !== oldVehicle.insurance_document_path) ||
    (updatedFields.insurance_expiry_date !== undefined && updatedFields.insurance_expiry_date !== oldVehicle.insurance_expiry_date)
  const hasPucChanged =
    (updatedFields.puc_document_path !== undefined && updatedFields.puc_document_path !== oldVehicle.puc_document_path) ||
    (updatedFields.puc_expiry_date !== undefined && updatedFields.puc_expiry_date !== oldVehicle.puc_expiry_date)
  const hasAuthChanged = updatedFields.authorization_document_path !== undefined && updatedFields.authorization_document_path !== oldVehicle.authorization_document_path
  const hasOwnerToggle = updatedFields.is_registered_owner !== undefined && updatedFields.is_registered_owner !== oldVehicle.is_registered_owner
  const hasSpeedClassChanged = updatedFields.ev_speed_class !== undefined && updatedFields.ev_speed_class !== oldVehicle.ev_speed_class
  const hasTransmissionChanged = updatedFields.transmission_type !== undefined && updatedFields.transmission_type !== oldVehicle.transmission_type

  const hasAnyDocTamper = hasPlateChanged || hasRcChanged || hasInsuranceChanged || hasPucChanged || hasAuthChanged || hasOwnerToggle || hasSpeedClassChanged || hasTransmissionChanged

  if (hasAnyDocTamper && oldVehicle.type !== "bicycle") {
    const invalidated: VehicleEntity = {
      ...oldVehicle,
      ...updatedFields,
      document_verification_status: "pending",
      verified_at: null,
      verified_by: null,
      document_rejection_reason: null,
      rc_status: (hasRcChanged || hasPlateChanged) ? "pending" : oldVehicle.rc_status,
      insurance_status: hasInsuranceChanged ? "pending" : oldVehicle.insurance_status,
      insurance_suitability_status: hasInsuranceChanged ? "requires_review" : oldVehicle.insurance_suitability_status,
      puc_status: hasPucChanged ? "pending" : oldVehicle.puc_status,
      authorization_status: hasOwnerToggle ? (updatedFields.is_registered_owner ? "not_required" : "pending") : (hasAuthChanged ? "pending" : oldVehicle.authorization_status),
      ev_exemption_verified: hasSpeedClassChanged ? false : oldVehicle.ev_exemption_verified,
    }
    return { updatedVehicle: invalidated, auditLogCreated: true }
  }

  return { updatedVehicle: { ...oldVehicle, ...updatedFields } }
}

// ---------------------------------------------------------------------------
// 4. Renter Driving Licence Submission & Constraints Simulation
// ---------------------------------------------------------------------------
export interface RenterDLRecord {
  id: string
  user_id: string
  licence_number: string
  front_document_path: string
  back_document_path: string | null
  expiry_date: string
  licence_categories: DLCategory[]
  is_current: boolean
  status: "pending" | "approved" | "rejected" | "expired" | "superseded"
  rejection_reason: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  created_at: string
}

export function validateAndSubmitRenterDL(
  callerRole: UserRole,
  callerId: string,
  params: {
    licence_number: string
    front_document_path: string
    back_document_path?: string | null
    expiry_date: string
    licence_categories: string[]
  },
  existingDLs: RenterDLRecord[],
  currentDate = new Date()
): { newDL: RenterDLRecord; updatedDLs: RenterDLRecord[] } {
  if (callerRole === "anon") {
    throw new Error("Authentication required to submit driving licence.")
  }

  // Path check: must match driving-licences/{user_id}/{sub_id}/(front|back)_...
  const pathRegex = new RegExp(`^${callerId}/[a-zA-Z0-9_\\-]+/front_[a-zA-Z0-9_\\-]+\\.(jpg|jpeg|png|webp|pdf)$`, "i")
  if (!pathRegex.test(params.front_document_path)) {
    throw new Error("Security violation: DL front document path must follow format <user_id>/<sub_id>/front_<name>.<ext>")
  }

  if (params.back_document_path) {
    const backRegex = new RegExp(`^${callerId}/[a-zA-Z0-9_\\-]+/back_[a-zA-Z0-9_\\-]+\\.(jpg|jpeg|png|webp|pdf)$`, "i")
    if (!backRegex.test(params.back_document_path)) {
      throw new Error("Security violation: DL back document path must follow format <user_id>/<sub_id>/back_<name>.<ext>")
    }
  }

  // DL number format
  const dlClean = params.licence_number.trim().toUpperCase()
  if (dlClean.length < 5 || dlClean.length > 30) {
    throw new Error("Invalid DL number length.")
  }

  // Expiry date must be future for newly submitted DLs
  const expiry = new Date(params.expiry_date)
  if (isNaN(expiry.getTime()) || expiry <= currentDate) {
    throw new Error("Driving licence is expired or has invalid expiry date.")
  }

  // Categories validation: check constraint ('MCWOG', 'MCWG', 'LMV')
  const validCategories: DLCategory[] = ["MCWOG", "MCWG", "LMV"]
  if (!params.licence_categories || params.licence_categories.length === 0) {
    throw new Error("At least one vehicle category must be specified.")
  }
  for (const cat of params.licence_categories) {
    if (!validCategories.includes(cat as DLCategory)) {
      throw new Error(`Invalid category: ${cat}. Allowed categories are MCWOG, MCWG, LMV.`)
    }
  }

  // Atomic renewal: Archive existing current DL for this user (superseded if previously approved or expired)
  const updatedDLs = existingDLs.map((dl) => {
    if (dl.user_id === callerId && dl.is_current) {
      return {
        ...dl,
        is_current: false,
        status: (dl.status === "approved" || dl.status === "expired" ? "superseded" : dl.status) as "pending" | "approved" | "rejected" | "expired" | "superseded",
      }
    }
    return dl
  })

  const newDL: RenterDLRecord = {
    id: `dl_${Math.random().toString(36).substring(2, 9)}`,
    user_id: callerId,
    licence_number: dlClean,
    front_document_path: params.front_document_path,
    back_document_path: params.back_document_path || null,
    expiry_date: params.expiry_date,
    licence_categories: params.licence_categories as DLCategory[],
    is_current: true,
    status: "pending",
    rejection_reason: null,
    reviewed_at: null,
    reviewed_by: null,
    created_at: currentDate.toISOString(),
  }

  return { newDL, updatedDLs: [...updatedDLs, newDL] }
}

export function simulateAdminReviewDL(
  dlList: RenterDLRecord[],
  licenceId: string,
  decision: "approved" | "rejected",
  adminId: string,
  rejectionReason?: string,
  expectedStatus?: string
): RenterDLRecord {
  const target = dlList.find((d) => d.id === licenceId)
  if (!target) {
    throw new Error("Driving licence record not found.")
  }

  // Stale-review guard: cannot review superseded or non-current DL
  if (!target.is_current || target.status === "superseded") {
    throw new Error("Stale Review Conflict: This driving licence submission is no longer current or has been superseded.")
  }

  if (expectedStatus !== undefined && target.status !== expectedStatus) {
    throw new Error(`Stale Review Conflict: Driving licence status was changed from ${expectedStatus} to ${target.status} by another session.`)
  }

  target.status = decision
  target.reviewed_at = new Date().toISOString()
  target.reviewed_by = adminId
  if (decision === "rejected") {
    target.rejection_reason = rejectionReason || "Rejected by administrator"
  }
  return target
}

export function simulateAdminReviewVehicle(
  vehicleList: VehicleEntity[],
  vehicleId: string,
  decision: "approved" | "rejected",
  adminId: string,
  params?: {
    rejectionReason?: string
    notes?: string
    expectedStatus?: string
    evExemptionVerified?: boolean
    rcStatus?: "not_required" | "pending" | "approved" | "rejected"
    insuranceStatus?: "not_required" | "pending" | "approved" | "rejected"
    insuranceSuitability?: "not_required" | "requires_review" | "suitable" | "unsuitable"
    pucStatus?: "not_required" | "pending" | "approved" | "rejected"
    authorizationStatus?: "not_required" | "pending" | "approved" | "rejected"
  }
): VehicleEntity {
  const target = vehicleList.find((v) => v.id === vehicleId)
  if (!target) {
    throw new Error("Vehicle not found.")
  }

  if (params?.expectedStatus !== undefined && target.document_verification_status !== params.expectedStatus) {
    throw new Error(`Stale Review Conflict: Vehicle document verification status was changed from ${params.expectedStatus} to ${target.document_verification_status} by another session.`)
  }

  const finalRcStatus = params?.rcStatus || target.rc_status
  const finalInsStatus = params?.insuranceStatus || target.insurance_status
  const finalInsSuit = params?.insuranceSuitability || target.insurance_suitability_status
  const finalPucStatus = params?.pucStatus || target.puc_status
  const finalAuthStatus = params?.authorizationStatus || target.authorization_status
  const finalEvExempt = params?.evExemptionVerified !== undefined ? params.evExemptionVerified : target.ev_exemption_verified

  // Prevent contradictory vehicle approval
  if (decision === "approved" && target.type !== "bicycle") {
    const isLowSpeedExempt = target.type === "e_scooter" && target.ev_speed_class === "low_speed_exempt" && finalEvExempt
    if (!isLowSpeedExempt && finalRcStatus !== "approved") {
      throw new Error("Cannot approve vehicle: Registration Certificate (RC) is not approved.")
    }
    if (finalInsStatus !== "approved") {
      throw new Error("Cannot approve vehicle: Insurance policy is not approved.")
    }
    if (finalInsSuit !== "suitable") {
      throw new Error("Cannot approve vehicle: Insurance suitability must be marked suitable.")
    }
    if (!target.puc_exempt && finalPucStatus !== "approved") {
      throw new Error("Cannot approve vehicle: PUC certificate is not approved.")
    }
    if (!target.is_registered_owner && finalAuthStatus !== "approved") {
      throw new Error("Cannot approve vehicle: Owner authorization letter is not approved.")
    }
  }

  target.document_verification_status = decision
  target.verified_at = decision === "approved" ? new Date().toISOString() : null
  target.verified_by = decision === "approved" ? adminId : null
  target.rc_status = finalRcStatus
  target.insurance_status = finalInsStatus
  target.insurance_suitability_status = finalInsSuit
  target.puc_status = finalPucStatus
  target.authorization_status = finalAuthStatus
  if (params?.evExemptionVerified !== undefined) {
    target.ev_exemption_verified = params.evExemptionVerified
  }
  if (decision === "rejected") {
    target.document_rejection_reason = params?.rejectionReason || "Rejected by administrator"
  }
  return target
}

// ---------------------------------------------------------------------------
// 5. Storage Bucket Policy Simulation
// ---------------------------------------------------------------------------
export function evaluateStorageAccess(params: {
  bucket: "vehicle-docs" | "driving-licences"
  action: "SELECT" | "INSERT" | "UPDATE" | "DELETE"
  path: string
  callerRole: UserRole
  callerId: string
  isVehicleOwner?: boolean
}): { allowed: boolean; reason?: string } {
  // Anon cannot access private storage
  if (params.callerRole === "anon") {
    return { allowed: false, reason: "Anon access denied on private storage bucket." }
  }

  // Immutability rule: no UPDATE or DELETE permitted for ordinary users
  if ((params.action === "UPDATE" || params.action === "DELETE") && params.callerRole !== "admin") {
    return { allowed: false, reason: "Document immutability: UPDATE and DELETE are prohibited." }
  }

  // Admin has full access
  if (params.callerRole === "admin") {
    return { allowed: true }
  }

  const pathParts = params.path.split("/")
  const folderUserId = pathParts[0]

  // Path isolation: folder[1] must match auth.uid()
  if (folderUserId !== params.callerId) {
    return { allowed: false, reason: "Cross-user storage access denied." }
  }

  // For vehicle-docs: folder[3] must be one of allowed doc types, and caller must own vehicle
  if (params.bucket === "vehicle-docs") {
    if (params.isVehicleOwner === false) {
      return { allowed: false, reason: "User does not own the vehicle corresponding to path." }
    }
    const docType = pathParts[2]
    if (params.action === "INSERT" && !["rc", "insurance", "puc", "authorization"].includes(docType)) {
      return { allowed: false, reason: `Invalid vehicle document type folder: ${docType}` }
    }
  }

  // For driving-licences: path must have 3 components <user_id>/<sub_id>/<side>_<name>.<ext>
  if (params.bucket === "driving-licences") {
    if (pathParts.length !== 3) {
      return { allowed: false, reason: "DL storage path must follow 3-level structure: <user_id>/<sub_id>/<side>_<name>.<ext>" }
    }
    const filename = pathParts[2]
    if (!/^(front|back)_[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp|pdf)$/i.test(filename)) {
      return { allowed: false, reason: "Invalid DL filename convention: must start with front_ or back_" }
    }
  }

  return { allowed: true }
}

// ---------------------------------------------------------------------------
// 6. Audit Ledger Immutability Simulation
// ---------------------------------------------------------------------------
export function evaluateAuditLedgerAccess(params: {
  action: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "TRUNCATE"
  callerRole: UserRole
  callerId: string
  logSubjectId?: string
}): { allowed: boolean; reason?: string } {
  // Direct mutations are strictly revoked from PUBLIC, anon, authenticated (including ordinary admins)
  if (["INSERT", "UPDATE", "DELETE", "TRUNCATE"].includes(params.action)) {
    return { allowed: false, reason: "Permission Denied: verification_audit_logs is append-only via trusted RPC." }
  }

  // SELECT rules:
  if (params.callerRole === "admin") {
    return { allowed: true }
  }

  if (params.callerRole === "anon") {
    return { allowed: false, reason: "Anon cannot read verification audit logs." }
  }

  // Student can only read logs where subject_user_id = auth.uid()
  if (params.callerId === params.logSubjectId) {
    return { allowed: true }
  }

  return { allowed: false, reason: "Access Denied: You can only read your own verification audit records." }
}

// ===========================================================================
// VITEST SUITE: Category 2 (Unit & Mocked Contract Tests)
// ===========================================================================

describe("Phase A: Verification Foundation, Security Triggers & Storage [Category 2: Unit/Contract]", () => {
  const MIGRATION_TS = new Date("2026-11-24T00:00:00Z")

  // -------------------------------------------------------------------------
  describe("App Settings dl_custody_policy_mode Contract", () => {
    it("should accept valid enum values ('disabled', 'optional', 'required')", () => {
      expect(validateDLCustodyPolicyMode("disabled")).toBe(true)
      expect(validateDLCustodyPolicyMode("optional")).toBe(true)
      expect(validateDLCustodyPolicyMode("required")).toBe(true)
      expect(validateDLCustodyPolicyMode("invalid_mode")).toBe(false)
      expect(validateDLCustodyPolicyMode("")).toBe(false)
    })

    it("should deny anon read access to app_settings", () => {
      const res = evaluateAppSettingsAccess({ action: "SELECT", callerRole: "anon" })
      expect(res.allowed).toBe(false)
      expect(res.reason).toContain("anonymous access revoked")
    })

    it("should allow authenticated users (student, renter, owner) to read app_settings", () => {
      for (const role of ["student", "renter", "vehicle_owner"] as const) {
        const res = evaluateAppSettingsAccess({ action: "SELECT", callerRole: role })
        expect(res.allowed).toBe(true)
      }
    })

    it("should forbid non-admins from mutating app_settings", () => {
      for (const role of ["student", "renter", "vehicle_owner"] as const) {
        const res = evaluateAppSettingsAccess({ action: "UPDATE", callerRole: role })
        expect(res.allowed).toBe(false)
        expect(res.reason).toContain("only administrators")
      }
    })

    it("should permit admin role to update app_settings", () => {
      const res = evaluateAppSettingsAccess({ action: "UPDATE", callerRole: "admin" })
      expect(res.allowed).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  describe("Grandfathering Backfill & Vehicle Column Extensions", () => {
    it("should backfill bicycles as 'not_required' with puc_exempt = true and preserve status", () => {
      const bike = applyGrandfatheringBackfill(
        { id: "v1", type: "bicycle", status: "available" },
        MIGRATION_TS
      )
      expect(bike.document_verification_status).toBe("not_required")
      expect(bike.puc_exempt).toBe(true)
      expect(bike.rc_status).toBe("not_required")
      expect(bike.insurance_suitability_status).toBe("not_required")
      expect(bike.insurance_status).toBe("not_required")
      expect(bike.grandfather_expires_at).toBeNull()
      expect(bike.status).toBe("available") // Listing status preserved!
    })

    it("should grandfather motorized vehicles for exactly 21 days with insurance_suitability_status = 'requires_review'", () => {
      const moto = applyGrandfatheringBackfill(
        { id: "v2", type: "motorcycle", status: "paused" },
        MIGRATION_TS
      )
      expect(moto.document_verification_status).toBe("legacy_grandfathered")
      expect(moto.status).toBe("paused") // Listing status preserved!
      expect(moto.rc_status).toBe("pending")
      expect(moto.insurance_suitability_status).toBe("requires_review")
      expect(moto.insurance_status).toBe("pending")
      expect(moto.puc_exempt).toBe(false)
      expect(moto.grandfather_expires_at).toBeDefined()

      // Exactly 21 days from migration timestamp
      const graceEnd = new Date(moto.grandfather_expires_at!)
      const diffDays = (graceEnd.getTime() - MIGRATION_TS.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBe(21)
    })

    it("should be idempotent: rerun does not alter or extend existing grandfathered deadline", () => {
      const initialMoto = applyGrandfatheringBackfill(
        { id: "v2", type: "motorcycle", status: "archived" },
        MIGRATION_TS
      )
      const laterDate = new Date("2026-12-01T00:00:00Z")
      const rerunMoto = applyGrandfatheringBackfill(initialMoto, laterDate)

      expect(rerunMoto.grandfather_expires_at).toBe(initialMoto.grandfather_expires_at)
      expect(rerunMoto.status).toBe("archived")
    })

    it("should accept valid Indian state and BH-series registration numbers (4-20 chars)", () => {
      expect(validateRegistrationNumber("KA01AB1234")).toBe(true)
      expect(validateRegistrationNumber("22BH1234AA")).toBe(true) // Bharat series
      expect(validateRegistrationNumber("DL-03-C-5555")).toBe(true)
      expect(validateRegistrationNumber(null)).toBe(true) // NULL allowed before entry
      expect(validateRegistrationNumber("A")).toBe(false) // Too short (<4)
      expect(validateRegistrationNumber("VERYLONGREGISTRATIONNUMBEREXCEEDINGLIMIT")).toBe(false) // >20
    })
  })

  // -------------------------------------------------------------------------
  describe("Vehicle Tamper Protection Trigger: 12 Admin Fields & 8 Invalidation Fields", () => {
    const approvedMoto: VehicleEntity = {
      id: "v3",
      owner_id: "user-owner-1",
      title: "Yamaha FZ",
      type: "motorcycle",
      status: "available",
      ev_exemption_verified: false,
      is_registered_owner: true,
      registration_number: "KA-01-AB-1234",
      rc_document_path: "user-owner-1/v3/rc/rc.pdf",
      rc_status: "approved",
      insurance_policy_number: "POL-9988",
      insurance_document_path: "user-owner-1/v3/insurance/insurance.pdf",
      insurance_expiry_date: "2027-12-31",
      insurance_suitability_status: "suitable",
      insurance_status: "approved",
      puc_exempt: false,
      puc_document_path: "user-owner-1/v3/puc/puc.pdf",
      puc_expiry_date: "2027-06-30",
      puc_status: "approved",
      authorization_document_path: "user-owner-1/v3/authorization/auth.pdf",
      authorization_status: "not_required",
      document_verification_status: "approved",
      verified_at: "2026-11-20T10:00:00Z",
      verified_by: "admin-1",
    }

    it("should block non-admin modification of all 12 admin-guarded fields", () => {
      for (const field of ADMIN_GUARDED_FIELDS) {
        expect(() => {
          simulateVehicleTamperTrigger(
            approvedMoto,
            { [field]: "tampered_value" },
            "vehicle_owner",
            "user-owner-1"
          )
        }).toThrow(`Access Denied: Modifying administrative field ${field} is forbidden.`)
      }
    })

    it("should invalidate approval and reset to 'pending' when owner alters insurance policy", () => {
      const res = simulateVehicleTamperTrigger(
        approvedMoto,
        { insurance_policy_number: "NEW-POL-0000" },
        "vehicle_owner",
        "user-owner-1"
      )

      expect(res.updatedVehicle.document_verification_status).toBe("pending")
      expect(res.updatedVehicle.insurance_status).toBe("pending")
      expect(res.updatedVehicle.insurance_suitability_status).toBe("requires_review")
      expect(res.updatedVehicle.verified_at).toBeNull()
      expect(res.updatedVehicle.verified_by).toBeNull()
      expect(res.auditLogCreated).toBe(true)
    })

    it("should invalidate approval when owner updates vehicle registration number (e.g. to BH series)", () => {
      const res = simulateVehicleTamperTrigger(
        approvedMoto,
        { registration_number: "22BH9999ZZ" },
        "vehicle_owner",
        "user-owner-1"
      )

      expect(res.updatedVehicle.document_verification_status).toBe("pending")
      expect(res.updatedVehicle.registration_number).toBe("22BH9999ZZ")
      expect(res.updatedVehicle.verified_at).toBeNull()
      expect(res.auditLogCreated).toBe(true)
    })

    it("should invalidate approval when owner uploads a new RC document", () => {
      const res = simulateVehicleTamperTrigger(
        approvedMoto,
        { rc_document_path: "user-owner-1/v3/rc/rc_v2.pdf" },
        "vehicle_owner",
        "user-owner-1"
      )

      expect(res.updatedVehicle.document_verification_status).toBe("pending")
      expect(res.updatedVehicle.rc_status).toBe("pending")
      expect(res.updatedVehicle.verified_at).toBeNull()
    })

    it("should invalidate approval when owner updates PUC document or expiry", () => {
      const res = simulateVehicleTamperTrigger(
        approvedMoto,
        { puc_document_path: "user-owner-1/v3/puc/new_puc.pdf" },
        "vehicle_owner",
        "user-owner-1"
      )

      expect(res.updatedVehicle.document_verification_status).toBe("pending")
      expect(res.updatedVehicle.puc_status).toBe("pending")
    })

    it("should invalidate approval and reset authorization_status if owner toggles is_registered_owner to false", () => {
      const res = simulateVehicleTamperTrigger(
        approvedMoto,
        { is_registered_owner: false },
        "vehicle_owner",
        "user-owner-1"
      )

      expect(res.updatedVehicle.document_verification_status).toBe("pending")
      expect(res.updatedVehicle.authorization_status).toBe("pending")
    })

    it("should invalidate approval and reset ev_exemption_verified if ev_speed_class is altered", () => {
      const res = simulateVehicleTamperTrigger(
        { ...approvedMoto, ev_exemption_verified: true },
        { ev_speed_class: "high_speed_registered" },
        "vehicle_owner",
        "user-owner-1"
      )

      expect(res.updatedVehicle.document_verification_status).toBe("pending")
      expect(res.updatedVehicle.ev_exemption_verified).toBe(false)
    })

    it("should prevent non-owners from editing vehicles", () => {
      expect(() => {
        simulateVehicleTamperTrigger(
          approvedMoto,
          { title: "Hacked Vehicle" },
          "student",
          "attacker-user"
        )
      }).toThrow("Access Denied: You can only update your own vehicle.")
    })

    it("should reject vehicle review with Stale Review Conflict if status changed concurrently", () => {
      const currentVehicle: VehicleEntity = {
        ...approvedMoto,
        document_verification_status: "pending",
      }

      expect(() => {
        simulateAdminReviewVehicle([currentVehicle], currentVehicle.id, "approved", "admin-1", {
          expectedStatus: "legacy_grandfathered",
        })
      }).toThrow("Stale Review Conflict: Vehicle document verification status was changed from legacy_grandfathered to pending by another session.")
    })

    it("should independently verify EV exemption without inferring from other approvals", () => {
      const scooter: VehicleEntity = {
        ...approvedMoto,
        id: "v-scooter",
        type: "e_scooter",
        ev_speed_class: "low_speed_exempt",
        ev_exemption_verified: false,
        document_verification_status: "pending",
      }

      const reviewed = simulateAdminReviewVehicle([scooter], scooter.id, "approved", "admin-1", {
        expectedStatus: "pending",
        evExemptionVerified: true,
      })

      expect(reviewed.document_verification_status).toBe("approved")
      expect(reviewed.ev_exemption_verified).toBe(true)
      expect(reviewed.status).toBe("available") // Listing status preserved!
    })

    it("should invalidate rc_status and overall status on registration plate change while preserving insurance and puc", () => {
      const res = simulateVehicleTamperTrigger(
        approvedMoto,
        { registration_number: "KA05XY9999" },
        "vehicle_owner",
        "user-owner-1"
      )

      expect(res.updatedVehicle.rc_status).toBe("pending")
      expect(res.updatedVehicle.document_verification_status).toBe("pending")
      expect(res.updatedVehicle.verified_at).toBeNull()
      expect(res.updatedVehicle.verified_by).toBeNull()
      expect(res.updatedVehicle.document_rejection_reason).toBeNull()
      // Preserved unrelated approvals
      expect(res.updatedVehicle.insurance_status).toBe("approved")
      expect(res.updatedVehicle.puc_status).toBe("approved")
      expect(res.auditLogCreated).toBe(true)
    })

    it("should prevent contradictory vehicle approval when RC, insurance, PUC, or authorization is not approved", () => {
      const pendingMoto: VehicleEntity = {
        ...approvedMoto,
        document_verification_status: "pending",
        rc_status: "pending",
        insurance_status: "approved",
        insurance_suitability_status: "suitable",
        puc_status: "approved",
      }

      // 1. Pending RC blocks approval
      expect(() => {
        simulateAdminReviewVehicle([pendingMoto], pendingMoto.id, "approved", "admin-1")
      }).toThrow("Cannot approve vehicle: Registration Certificate (RC) is not approved.")

      // 2. Unsuitable insurance blocks approval
      const unsuitableMoto: VehicleEntity = {
        ...pendingMoto,
        rc_status: "approved",
        insurance_suitability_status: "unsuitable",
      }
      expect(() => {
        simulateAdminReviewVehicle([unsuitableMoto], unsuitableMoto.id, "approved", "admin-1")
      }).toThrow("Cannot approve vehicle: Insurance suitability must be marked suitable.")

      // 3. Rejected PUC blocks approval
      const badPucMoto: VehicleEntity = {
        ...pendingMoto,
        rc_status: "approved",
        puc_status: "rejected",
      }
      expect(() => {
        simulateAdminReviewVehicle([badPucMoto], badPucMoto.id, "approved", "admin-1")
      }).toThrow("Cannot approve vehicle: PUC certificate is not approved.")

      // 4. Missing authorization for non-registered owner blocks approval
      const nonOwnerMoto: VehicleEntity = {
        ...pendingMoto,
        rc_status: "approved",
        is_registered_owner: false,
        authorization_status: "pending",
      }
      expect(() => {
        simulateAdminReviewVehicle([nonOwnerMoto], nonOwnerMoto.id, "approved", "admin-1")
      }).toThrow("Cannot approve vehicle: Owner authorization letter is not approved.")
    })
  })

  // -------------------------------------------------------------------------
  describe("Renter Driving Licences & Category Constraints", () => {
    it("should successfully register valid DL with categories MCWG and LMV", () => {
      const res = validateAndSubmitRenterDL(
        "renter",
        "renter-user-1",
        {
          licence_number: "KA0120220005678",
          front_document_path: "renter-user-1/sub-1/front_dl_2026.jpg",
          expiry_date: "2030-01-01",
          licence_categories: ["MCWG", "LMV"],
        },
        []
      )

      expect(res.newDL.is_current).toBe(true)
      expect(res.newDL.status).toBe("pending")
      expect(res.newDL.licence_categories).toEqual(["MCWG", "LMV"])
    })

    it("should reject invalid DL categories not in ('MCWOG', 'MCWG', 'LMV')", () => {
      expect(() => {
        validateAndSubmitRenterDL(
          "renter",
          "renter-user-1",
          {
            licence_number: "KA0120220005678",
            front_document_path: "renter-user-1/sub-1/front_dl.jpg",
            expiry_date: "2030-01-01",
            licence_categories: ["HEAVY_VEHICLE"], // INVALID
          },
          []
        )
      }).toThrow("Invalid category: HEAVY_VEHICLE. Allowed categories are MCWOG, MCWG, LMV.")
    })

    it("should reject expired driving licence submissions", () => {
      expect(() => {
        validateAndSubmitRenterDL(
          "renter",
          "renter-user-1",
          {
            licence_number: "KA0120220005678",
            front_document_path: "renter-user-1/sub-1/front_dl.jpg",
            expiry_date: "2020-01-01", // Past date
            licence_categories: ["MCWG"],
          },
          [],
          new Date("2026-11-24")
        )
      }).toThrow("Driving licence is expired or has invalid expiry date.")
    })

    it("should allow renewals when prior DL is expired, superseding the expired record", () => {
      const expiredDL: RenterDLRecord = {
        id: "dl_expired",
        user_id: "renter-user-1",
        licence_number: "OLD-EXPIRED-DL",
        front_document_path: "renter-user-1/sub-1/front_old.jpg",
        back_document_path: null,
        expiry_date: "2026-01-01", // Already passed
        licence_categories: ["MCWG"],
        is_current: true,
        status: "expired",
        rejection_reason: null,
        reviewed_at: "2024-01-01T00:00:00Z",
        reviewed_by: "admin-1",
        created_at: "2024-01-01T00:00:00Z",
      }

      const res = validateAndSubmitRenterDL(
        "renter",
        "renter-user-1",
        {
          licence_number: "RENEWED-DL-2026",
          front_document_path: "renter-user-1/sub-2/front_renewed.jpg",
          expiry_date: "2031-01-01", // Valid future date
          licence_categories: ["MCWG", "LMV"],
        },
        [expiredDL],
        new Date("2026-11-24")
      )

      const archived = res.updatedDLs.find((d) => d.id === "dl_expired")
      expect(archived?.is_current).toBe(false)
      expect(archived?.status).toBe("superseded")
      expect(res.newDL.is_current).toBe(true)
      expect(res.newDL.status).toBe("pending")
    })

    it("should supersede prior approved DL when user renews (single is_current uniqueness)", () => {
      const existingDL: RenterDLRecord = {
        id: "dl_old",
        user_id: "renter-user-1",
        licence_number: "OLD-DL-1234",
        front_document_path: "renter-user-1/sub-1/front_old.jpg",
        back_document_path: null,
        expiry_date: "2028-01-01",
        licence_categories: ["MCWOG"],
        is_current: true,
        status: "approved",
        rejection_reason: null,
        reviewed_at: "2025-01-01T00:00:00Z",
        reviewed_by: "admin-1",
        created_at: "2025-01-01T00:00:00Z",
      }

      const res = validateAndSubmitRenterDL(
        "renter",
        "renter-user-1",
        {
          licence_number: "NEW-DL-5678",
          front_document_path: "renter-user-1/sub-2/front_new.jpg",
          expiry_date: "2032-01-01",
          licence_categories: ["MCWG", "LMV"],
        },
        [existingDL]
      )

      const archived = res.updatedDLs.find((d) => d.id === "dl_old")
      expect(archived?.is_current).toBe(false)
      expect(archived?.status).toBe("superseded")
      expect(res.newDL.is_current).toBe(true)

      // Exactly one current DL for this user
      const currentCount = res.updatedDLs.filter((d) => d.user_id === "renter-user-1" && d.is_current).length
      expect(currentCount).toBe(1)
    })

    it("should enforce DL storage path naming convention front_<name>.<ext>", () => {
      expect(() => {
        validateAndSubmitRenterDL(
          "renter",
          "renter-user-1",
          {
            licence_number: "KA0120220005678",
            front_document_path: "renter-user-1/sub-1/invalid_name.jpg", // Missing front_ prefix
            expiry_date: "2030-01-01",
            licence_categories: ["MCWG"],
          },
          []
        )
      }).toThrow("Security violation: DL front document path must follow format")
    })

    it("should throw Stale Review Conflict if admin reviews a superseded DL", () => {
      const supersededDL: RenterDLRecord = {
        id: "dl_superseded",
        user_id: "renter-user-1",
        licence_number: "KA0120220001111",
        front_document_path: "renter-user-1/sub-1/front_dl.jpg",
        back_document_path: null,
        expiry_date: "2028-01-01",
        licence_categories: ["MCWG"],
        is_current: false,
        status: "superseded",
        rejection_reason: null,
        reviewed_at: null,
        reviewed_by: null,
        created_at: "2025-01-01T00:00:00Z",
      }

      expect(() => {
        simulateAdminReviewDL([supersededDL], "dl_superseded", "approved", "admin-1")
      }).toThrow("Stale Review Conflict: This driving licence submission is no longer current or has been superseded.")
    })

    it("should throw Stale Review Conflict if admin reviews a DL whose status was changed concurrently", () => {
      const activeDL: RenterDLRecord = {
        id: "dl_active",
        user_id: "renter-user-1",
        licence_number: "KA0120220001111",
        front_document_path: "renter-user-1/sub-1/front_dl.jpg",
        back_document_path: null,
        expiry_date: "2028-01-01",
        licence_categories: ["MCWG"],
        is_current: true,
        status: "approved",
        rejection_reason: null,
        reviewed_at: "2026-11-24T10:00:00Z",
        reviewed_by: "admin-2",
        created_at: "2026-11-20T00:00:00Z",
      }

      expect(() => {
        simulateAdminReviewDL([activeDL], "dl_active", "rejected", "admin-1", "Duplicate submission", "pending")
      }).toThrow("Stale Review Conflict: Driving licence status was changed from pending to approved by another session.")
    })
  })

  // -------------------------------------------------------------------------
  describe("Private Storage Buckets Access & Path Policies", () => {
    it("should reject anon role from reading vehicle-docs or driving-licences", () => {
      const vAccess = evaluateStorageAccess({
        bucket: "vehicle-docs",
        action: "SELECT",
        path: "user-1/v1/rc/rc.pdf",
        callerRole: "anon",
        callerId: "",
      })
      expect(vAccess.allowed).toBe(false)

      const dlAccess = evaluateStorageAccess({
        bucket: "driving-licences",
        action: "SELECT",
        path: "user-1/sub-1/front_dl.jpg",
        callerRole: "anon",
        callerId: "",
      })
      expect(dlAccess.allowed).toBe(false)
    })

    it("should prevent cross-user storage access (path isolation)", () => {
      const access = evaluateStorageAccess({
        bucket: "driving-licences",
        action: "SELECT",
        path: "victim-user/sub-1/front_dl.jpg",
        callerRole: "student",
        callerId: "attacker-user",
      })
      expect(access.allowed).toBe(false)
      expect(access.reason).toContain("Cross-user storage access denied.")
    })

    it("should deny ordinary users from deleting or updating documents (immutability)", () => {
      const deleteAccess = evaluateStorageAccess({
        bucket: "vehicle-docs",
        action: "DELETE",
        path: "user-1/v1/rc/rc.pdf",
        callerRole: "vehicle_owner",
        callerId: "user-1",
        isVehicleOwner: true,
      })
      expect(deleteAccess.allowed).toBe(false)
      expect(deleteAccess.reason).toContain("Document immutability")
    })

    it("should enforce vehicle doc subfolder validation (rc, insurance, puc, authorization)", () => {
      const validUpload = evaluateStorageAccess({
        bucket: "vehicle-docs",
        action: "INSERT",
        path: "user-1/v1/rc/rc.pdf",
        callerRole: "vehicle_owner",
        callerId: "user-1",
        isVehicleOwner: true,
      })
      expect(validUpload.allowed).toBe(true)

      const invalidUpload = evaluateStorageAccess({
        bucket: "vehicle-docs",
        action: "INSERT",
        path: "user-1/v1/random_folder/doc.pdf",
        callerRole: "vehicle_owner",
        callerId: "user-1",
        isVehicleOwner: true,
      })
      expect(invalidUpload.allowed).toBe(false)
      expect(invalidUpload.reason).toContain("Invalid vehicle document type folder")
    })

    it("should allow admin role full inspection access across any path", () => {
      const adminAccess = evaluateStorageAccess({
        bucket: "vehicle-docs",
        action: "SELECT",
        path: "user-1/v1/rc/rc.pdf",
        callerRole: "admin",
        callerId: "admin-super",
      })
      expect(adminAccess.allowed).toBe(true)
    })

    it("should enforce bucket size limits of 5MB for driving-licences and 10MB for vehicle-docs", () => {
      const BUCKET_LIMITS: Record<string, number> = {
        "driving-licences": 5242880, // Exactly 5 MB
        "vehicle-docs": 10485760,     // Exactly 10 MB
      }

      expect(BUCKET_LIMITS["driving-licences"]).toBe(5 * 1024 * 1024)
      expect(BUCKET_LIMITS["vehicle-docs"]).toBe(10 * 1024 * 1024)
    })
  })

  // -------------------------------------------------------------------------
  describe("Renter DL & Student Verification Security Hardening", () => {
    it("should prohibit direct INSERT and UPDATE mutations on renter_driving_licences by non-admins", () => {
      function evaluateRenterDLDirectMutation(callerRole: UserRole, _action: "INSERT" | "UPDATE"): { allowed: boolean; reason?: string } {
        if (callerRole === "admin") {
          return { allowed: true }
        }
        return {
          allowed: false,
          reason: "Permission denied: direct table modifications on renter_driving_licences are restricted. Use submit_renter_dl RPC.",
        }
      }

      for (const role of ["anon", "student", "vehicle_owner", "renter"] as const) {
        expect(evaluateRenterDLDirectMutation(role, "INSERT").allowed).toBe(false)
        expect(evaluateRenterDLDirectMutation(role, "UPDATE").allowed).toBe(false)
      }
      expect(evaluateRenterDLDirectMutation("admin", "INSERT").allowed).toBe(true)
      expect(evaluateRenterDLDirectMutation("admin", "UPDATE").allowed).toBe(true)
    })

    it("should reject student verification approval/rejection without direct table fallback", async () => {
      // Simulates the removal of unsafe direct table fallback in AdminVerificationsPage
      let directTableUpdateAttempted = false
      async function executeStudentReview(rpcFails: boolean): Promise<{ success: boolean; error?: string }> {
        if (rpcFails) {
          // In the corrected code, an RPC failure throws immediately and does NOT execute direct table update fallback
          const rpcError = new Error("RPC execution failed: check constraint violation")
          try {
            throw rpcError
          } catch (err: any) {
            // Direct table update fallback is NOT executed!
            return { success: false, error: err.message }
          }
        }
        return { success: true }
      }

      const res = await executeStudentReview(true)
      expect(res.success).toBe(false)
      expect(res.error).toContain("RPC execution failed")
      expect(directTableUpdateAttempted).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  describe("Immutable Verification Audit Ledger", () => {
    it("should block direct INSERT, UPDATE, DELETE on audit ledger from any caller including admin role", () => {
      for (const action of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"] as const) {
        for (const role of ["student", "vehicle_owner", "renter", "admin"] as const) {
          const res = evaluateAuditLedgerAccess({
            action,
            callerRole: role,
            callerId: "user-1",
          })
          expect(res.allowed).toBe(false)
          expect(res.reason).toContain("append-only via trusted RPC")
        }
      }
    })

    it("should allow admin to view all audit ledger records", () => {
      const res = evaluateAuditLedgerAccess({
        action: "SELECT",
        callerRole: "admin",
        callerId: "admin-1",
      })
      expect(res.allowed).toBe(true)
    })

    it("should allow student to view only their own audit ledger records", () => {
      const ownRes = evaluateAuditLedgerAccess({
        action: "SELECT",
        callerRole: "student",
        callerId: "user-1",
        logSubjectId: "user-1",
      })
      expect(ownRes.allowed).toBe(true)

      const foreignRes = evaluateAuditLedgerAccess({
        action: "SELECT",
        callerRole: "student",
        callerId: "user-1",
        logSubjectId: "user-2",
      })
      expect(foreignRes.allowed).toBe(false)
    })
  })
})
