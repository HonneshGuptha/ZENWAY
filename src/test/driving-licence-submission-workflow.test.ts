import { describe, it, expect, vi, beforeEach } from "vitest"
import { supabase } from "@/lib/supabase"
import {
  submitDrivingLicenceWorkflow,
  getCurrentDrivingLicence,
  type SubmitDrivingLicenceParams
} from "@/services/drivingLicenceService"

/**
 * Phase A — DL Submission-First Storage Binding & Workflow Test Suite
 *
 * EVIDENCE CLASSIFICATION: Category 2 (Unit / Mocked Contract Tests)
 *
 * Verifies:
 * 1. Submission-first lifecycle (draft initiation -> path-bound upload -> atomic finalization).
 * 2. Path & Storage RLS contract: <auth.uid()>/<submission_id>/<side>_<upload_id>.<ext>.
 * 3. Cross-renter isolation and arbitrary folder spoofing prevention.
 * 4. Invalidation of upload rights once submission is finalized (draft -> pending).
 * 5. Atomic renewal superseding (prior current DL marked is_current = false / superseded).
 * 6. Rollback / fault tolerance: upload or RPC failure leaves prior current DL untouched.
 * 7. Verification audit log recording.
 */

// Simulated in-memory database & storage state
interface MockDLRecord {
  id: string
  user_id: string
  licence_number: string | null
  licence_categories: string[] | null
  expiry_date: string | null
  front_document_path: string | null
  back_document_path: string | null
  status: "draft" | "pending" | "approved" | "rejected" | "expired" | "superseded"
  is_current: boolean
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

interface MockStorageObject {
  bucket_id: string
  name: string
  owner_id: string
  created_at: string
}

interface MockAuditLog {
  id: string
  entity_type: string
  entity_id: string
  subject_user_id: string
  document_type: string
  action: string
  previous_status: string | null
  new_status: string
  actor_id: string
}

class MockSupabaseEnvironment {
  public dls: Map<string, MockDLRecord> = new Map()
  public storageObjects: Map<string, MockStorageObject> = new Map()
  public auditLogs: MockAuditLog[] = []
  public currentUser: { id: string; role: string } | null = null

  reset() {
    this.dls.clear()
    this.storageObjects.clear()
    this.auditLogs = []
    this.currentUser = null
  }

  // Contract Simulation: create_renter_dl_submission()
  rpcCreateRenterDLSubmission(): { data: string | null; error: Error | null } {
    if (!this.currentUser) {
      return { data: null, error: new Error("Authentication Required: Please sign in to initiate driving licence submission.") }
    }

    // Safe Resume/Retry: Check for existing unfinalized draft
    for (const record of this.dls.values()) {
      if (record.user_id === this.currentUser.id && record.status === "draft" && !record.is_current) {
        return { data: record.id, error: null }
      }
    }

    const newId = `sub_${Math.random().toString(36).substring(2, 10)}`
    const record: MockDLRecord = {
      id: newId,
      user_id: this.currentUser.id,
      licence_number: null,
      licence_categories: null,
      expiry_date: null,
      front_document_path: null,
      back_document_path: null,
      status: "draft",
      is_current: false,
      rejection_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    this.dls.set(newId, record)
    return { data: newId, error: null }
  }

  // Contract Simulation: Storage RLS driving_licences_upload_owner
  storageUpload(
    bucket: string,
    path: string,
    _file: any
  ): { error: Error | null } {
    if (!this.currentUser) {
      return { error: new Error("RLS violation: Unauthenticated storage upload") }
    }
    if (bucket !== "driving-licences") {
      return { error: new Error("Invalid bucket") }
    }

    const segments = path.split("/")
    if (segments.length !== 3) {
      return { error: new Error("RLS violation: folder depth must be exactly 2 (<user_id>/<submission_id>/<file>)") }
    }

    const [pathUserId, pathSubId, fileName] = segments
    if (pathUserId !== this.currentUser.id) {
      return { error: new Error("RLS violation: Path user_id does not match authenticated user.") }
    }

    // Verify submission exists, is owned by user, and is in draft status
    const dl = this.dls.get(pathSubId)
    if (!dl) {
      return { error: new Error("RLS violation: DL submission record not found for folder ID.") }
    }
    if (dl.user_id !== this.currentUser.id) {
      return { error: new Error("RLS violation: Cross-user DL folder impersonation.") }
    }
    if (dl.status !== "draft") {
      return { error: new Error(`RLS violation: Cannot upload to submission with status '${dl.status}'. Uploads permitted only for 'draft'.`) }
    }

    // Filename pattern check: ^(front|back)_[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp|pdf)$
    const filePattern = /^(front|back)_[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp|pdf)$/i
    if (!filePattern.test(fileName)) {
      return { error: new Error("RLS violation: Filename must match (front|back)_<id>.<ext>") }
    }

    // Record storage object
    this.storageObjects.set(`${bucket}:${path}`, {
      bucket_id: bucket,
      name: path,
      owner_id: this.currentUser.id,
      created_at: new Date().toISOString()
    })

    return { error: null }
  }

  // Contract Simulation: submit_renter_dl RPC
  rpcSubmitRenterDL(params: {
    p_submission_id: string
    p_licence_number: string
    p_licence_categories: string[]
    p_expiry_date: string
    p_front_document_path: string
    p_back_document_path?: string | null
  }): { data: string | null; error: Error | null } {
    if (!this.currentUser) {
      return { data: null, error: new Error("Authentication Required: Please sign in to submit driving licence.") }
    }

    const { p_submission_id, p_licence_number, p_licence_categories, p_expiry_date, p_front_document_path, p_back_document_path } = params
    const dl = this.dls.get(p_submission_id)
    if (!dl) {
      return { data: null, error: new Error("Invalid Submission: Submission record not found.") }
    }
    if (dl.user_id !== this.currentUser.id) {
      return { data: null, error: new Error("Access Denied: You do not own this driving licence submission.") }
    }
    if (dl.status !== "draft") {
      return { data: null, error: new Error("Invalid Submission State: Submission has already been finalized or is not in draft state.") }
    }

    const cleanNumber = (p_licence_number || "").trim().toUpperCase()
    if (cleanNumber.length < 5) {
      return { data: null, error: new Error("Invalid Driving Licence Number: Must be at least 5 alphanumeric characters.") }
    }

    const validCategories = ["MCWOG", "MCWG", "LMV"]
    if (!p_licence_categories || p_licence_categories.length === 0 || !p_licence_categories.every(c => validCategories.includes(c))) {
      return { data: null, error: new Error("Invalid Categories: Selected categories must be a subset of MCWOG, MCWG, LMV.") }
    }

    if (new Date(p_expiry_date) <= new Date()) {
      return { data: null, error: new Error("Invalid Expiry Date: Driving licence has expired.") }
    }

    const expectedPrefix = `${this.currentUser.id}/${p_submission_id}/`
    if (!p_front_document_path.startsWith(expectedPrefix)) {
      return { data: null, error: new Error("Security Violation: Front DL document path must be formatted as <user_id>/<sub_id>/front_<upload_id>.<ext>") }
    }
    if (!p_front_document_path.includes("/front_")) {
      return { data: null, error: new Error("Security Violation: Front DL document path must have front_ prefix.") }
    }

    // Verify storage object exists
    if (!this.storageObjects.has(`driving-licences:${p_front_document_path}`)) {
      return { data: null, error: new Error("Storage Verification Failed: Front DL document does not exist in private storage.") }
    }

    if (p_back_document_path) {
      if (!p_back_document_path.startsWith(expectedPrefix) || !p_back_document_path.includes("/back_")) {
        return { data: null, error: new Error("Security Violation: Back DL document path must be formatted as <user_id>/<sub_id>/back_<upload_id>.<ext>") }
      }
      if (!this.storageObjects.has(`driving-licences:${p_back_document_path}`)) {
        return { data: null, error: new Error("Storage Verification Failed: Back DL document does not exist in private storage.") }
      }
    }

    // Supersede any existing current DL
    let hadPrior = false
    for (const [id, existing] of this.dls.entries()) {
      if (existing.user_id === this.currentUser.id && existing.is_current && id !== p_submission_id) {
        existing.is_current = false
        if (existing.status === "approved") {
          existing.status = "superseded"
        }
        existing.updated_at = new Date().toISOString()
        hadPrior = true
      }
    }

    // Finalize target record
    dl.licence_number = cleanNumber
    dl.licence_categories = p_licence_categories
    dl.expiry_date = p_expiry_date
    dl.front_document_path = p_front_document_path
    dl.back_document_path = p_back_document_path || null
    dl.status = "pending"
    dl.is_current = true
    dl.updated_at = new Date().toISOString()

    // Add audit entry
    this.auditLogs.push({
      id: `val_${Math.random().toString(36).substring(2, 10)}`,
      entity_type: "renter_dl",
      entity_id: p_submission_id,
      subject_user_id: this.currentUser.id,
      document_type: "driving_licence",
      action: hadPrior ? "resubmitted" : "submitted",
      previous_status: "draft",
      new_status: "pending",
      actor_id: this.currentUser.id
    })

    return { data: p_submission_id, error: null }
  }

  // Contract Simulation: Tamper Protection Trigger on UPDATE
  simulateUpdateDL(
    id: string,
    updates: Partial<MockDLRecord>,
    callerRole: "student" | "admin"
  ): { data: MockDLRecord | null; error: Error | null } {
    const old = this.dls.get(id)
    if (!old) return { data: null, error: new Error("DL not found") }

    if (callerRole !== "admin") {
      if (
        updates.rejection_reason !== undefined &&
        updates.rejection_reason !== old.rejection_reason
      ) {
        return {
          data: null,
          error: new Error("Access Denied: Only administrators can modify driving licence review status and reasons.")
        }
      }

      if (updates.status !== undefined && updates.status !== old.status) {
        const allowed =
          (old.status === "draft" && updates.status === "pending") ||
          (["approved", "pending"].includes(old.status) && updates.status === "superseded")
        if (!allowed) {
          return {
            data: null,
            error: new Error("Access Denied: Only administrators can modify driving licence review status.")
          }
        }
      }

      if (updates.is_current === true && !old.is_current) {
        if (["rejected", "expired", "superseded"].includes(old.status)) {
          return {
            data: null,
            error: new Error("Access Denied: Historical, rejected, or expired driving licences cannot be reactivated as current.")
          }
        }
        if (old.status === "draft" && updates.status !== "pending") {
          return {
            data: null,
            error: new Error("Access Denied: Draft driving licences can only become current upon pending finalization.")
          }
        }
      }
    }

    const updated = { ...old, ...updates, updated_at: new Date().toISOString() }
    this.dls.set(id, updated)
    return { data: updated, error: null }
  }
}

describe("Phase A: DL Submission-First Storage Binding & Workflow", () => {
  let env: MockSupabaseEnvironment

  beforeEach(() => {
    env = new MockSupabaseEnvironment()
  })

  // 1. Initial State & Unauthenticated Guards
  it("rejects unauthenticated attempts to create a DL submission", () => {
    env.currentUser = null
    const res = env.rpcCreateRenterDLSubmission()
    expect(res.error).not.toBeNull()
    expect(res.error?.message).toMatch(/Authentication Required/i)
    expect(res.data).toBeNull()
  })

  it("creates a draft submission record permanently bound to authenticated caller", () => {
    env.currentUser = { id: "student-123", role: "student" }
    const res = env.rpcCreateRenterDLSubmission()
    expect(res.error).toBeNull()
    expect(res.data).toBeDefined()

    const record = env.dls.get(res.data!)
    expect(record).toBeDefined()
    expect(record?.user_id).toBe("student-123")
    expect(record?.status).toBe("draft")
    expect(record?.is_current).toBe(false)
    expect(record?.licence_number).toBeNull()
  })

  // 2. Storage RLS Policy Contract Enforcement
  it("permits storage uploads to a valid draft submission folder owned by the caller", () => {
    env.currentUser = { id: "student-123", role: "student" }
    const { data: subId } = env.rpcCreateRenterDLSubmission()

    const frontPath = `student-123/${subId}/front_abc123.jpg`
    const uploadRes = env.storageUpload("driving-licences", frontPath, {})
    expect(uploadRes.error).toBeNull()
    expect(env.storageObjects.has(`driving-licences:${frontPath}`)).toBe(true)
  })

  it("rejects storage uploads if the user_id in the path does not match the authenticated user", () => {
    env.currentUser = { id: "student-123", role: "student" }
    const { data: subId } = env.rpcCreateRenterDLSubmission()

    const attackPath = `victim-999/${subId}/front_abc123.jpg`
    const uploadRes = env.storageUpload("driving-licences", attackPath, {})
    expect(uploadRes.error).not.toBeNull()
    expect(uploadRes.error?.message).toMatch(/Path user_id does not match/i)
  })

  it("rejects storage uploads with an arbitrary non-existent submission folder", () => {
    env.currentUser = { id: "student-123", role: "student" }
    const bogusSubId = "sub_does_not_exist_in_db"
    const attackPath = `student-123/${bogusSubId}/front_abc123.jpg`

    const uploadRes = env.storageUpload("driving-licences", attackPath, {})
    expect(uploadRes.error).not.toBeNull()
    expect(uploadRes.error?.message).toMatch(/record not found for folder ID/i)
  })

  it("rejects cross-renter submission folder access (student A attempting to upload to student B's draft)", () => {
    // Student B creates draft
    env.currentUser = { id: "student-B", role: "student" }
    const { data: bSubId } = env.rpcCreateRenterDLSubmission()

    // Student A tries to upload into student B's submission folder
    env.currentUser = { id: "student-A", role: "student" }
    const attackPath = `student-A/${bSubId}/front_attack.jpg`

    const uploadRes = env.storageUpload("driving-licences", attackPath, {})
    expect(uploadRes.error).not.toBeNull()
    expect(uploadRes.error?.message).toMatch(/Cross-user DL folder impersonation/i)
  })

  it("rejects invalid filename format or unsupported file extensions", () => {
    env.currentUser = { id: "student-123", role: "student" }
    const { data: subId } = env.rpcCreateRenterDLSubmission()

    // Invalid prefix (neither front nor back)
    const badPrefix = `student-123/${subId}/document_abc.jpg`
    expect(env.storageUpload("driving-licences", badPrefix, {}).error).not.toBeNull()

    // Invalid extension (.exe)
    const badExt = `student-123/${subId}/front_abc.exe`
    expect(env.storageUpload("driving-licences", badExt, {}).error).not.toBeNull()
  })

  // 3. Finalization RPC & Invalidation of Draft Upload Rights
  it("rejects finalization if storage files are missing from the private bucket", () => {
    env.currentUser = { id: "student-123", role: "student" }
    const { data: subId } = env.rpcCreateRenterDLSubmission()

    const fakeFrontPath = `student-123/${subId}/front_missing.jpg`
    // Note: did NOT upload to storage

    const finRes = env.rpcSubmitRenterDL({
      p_submission_id: subId!,
      p_licence_number: "KA0120230001234",
      p_licence_categories: ["MCWG", "LMV"],
      p_expiry_date: "2030-01-01",
      p_front_document_path: fakeFrontPath
    })

    expect(finRes.error).not.toBeNull()
    expect(finRes.error?.message).toMatch(/Storage Verification Failed/i)

    // Verify record remains draft and is_current = false
    const rec = env.dls.get(subId!)
    expect(rec?.status).toBe("draft")
    expect(rec?.is_current).toBe(false)
  })

  it("successfully finalizes draft to pending review with valid storage objects", () => {
    env.currentUser = { id: "student-123", role: "student" }
    const { data: subId } = env.rpcCreateRenterDLSubmission()

    const frontPath = `student-123/${subId}/front_valid.jpg`
    const backPath = `student-123/${subId}/back_valid.jpg`
    env.storageUpload("driving-licences", frontPath, {})
    env.storageUpload("driving-licences", backPath, {})

    const finRes = env.rpcSubmitRenterDL({
      p_submission_id: subId!,
      p_licence_number: "KA0120230001234",
      p_licence_categories: ["MCWG", "LMV"],
      p_expiry_date: "2030-01-01",
      p_front_document_path: frontPath,
      p_back_document_path: backPath
    })

    expect(finRes.error).toBeNull()
    expect(finRes.data).toBe(subId)

    const finalizedRec = env.dls.get(subId!)
    expect(finalizedRec?.status).toBe("pending")
    expect(finalizedRec?.is_current).toBe(true)
    expect(finalizedRec?.licence_number).toBe("KA0120230001234")
    expect(finalizedRec?.front_document_path).toBe(frontPath)
    expect(finalizedRec?.back_document_path).toBe(backPath)

    // Verify audit log emitted
    expect(env.auditLogs.length).toBe(1)
    expect(env.auditLogs[0].entity_id).toBe(subId)
    expect(env.auditLogs[0].action).toBe("submitted")
    expect(env.auditLogs[0].previous_status).toBe("draft")
    expect(env.auditLogs[0].new_status).toBe("pending")
  })

  it("permanently revokes upload rights once a submission is finalized (status changed from draft to pending)", () => {
    env.currentUser = { id: "student-123", role: "student" }
    const { data: subId } = env.rpcCreateRenterDLSubmission()

    const frontPath = `student-123/${subId}/front_valid.jpg`
    env.storageUpload("driving-licences", frontPath, {})

    env.rpcSubmitRenterDL({
      p_submission_id: subId!,
      p_licence_number: "KA0120230001234",
      p_licence_categories: ["MCWG"],
      p_expiry_date: "2030-01-01",
      p_front_document_path: frontPath
    })

    // Now attempt to upload a new or overwritten file into the finalized folder
    const postFinalizePath = `student-123/${subId}/front_overwrite.jpg`
    const uploadAttempt = env.storageUpload("driving-licences", postFinalizePath, {})

    expect(uploadAttempt.error).not.toBeNull()
    expect(uploadAttempt.error?.message).toMatch(/Cannot upload to submission with status 'pending'/i)
  })

  // 4. Atomic Renewal & Superseding Guarantees
  it("atomically supersedes prior approved DL when new submission is finalized", () => {
    env.currentUser = { id: "renter-456", role: "student" }

    // Seed existing approved DL
    const oldDlId = "dl_old_approved"
    env.dls.set(oldDlId, {
      id: oldDlId,
      user_id: "renter-456",
      licence_number: "KA0120200000001",
      licence_categories: ["MCWOG"],
      expiry_date: "2025-01-01",
      front_document_path: "renter-456/dl_old_approved/front_1.jpg",
      back_document_path: null,
      status: "approved",
      is_current: true,
      rejection_reason: null,
      created_at: "2020-01-01T00:00:00Z",
      updated_at: "2020-01-01T00:00:00Z"
    })

    // Initiate renewal
    const { data: newSubId } = env.rpcCreateRenterDLSubmission()

    // During draft phase, prior approved DL MUST remain active and is_current = true
    expect(env.dls.get(oldDlId)?.is_current).toBe(true)
    expect(env.dls.get(oldDlId)?.status).toBe("approved")

    // Upload & finalize renewal
    const newFront = `renter-456/${newSubId}/front_renewal.jpg`
    env.storageUpload("driving-licences", newFront, {})

    const finRes = env.rpcSubmitRenterDL({
      p_submission_id: newSubId!,
      p_licence_number: "KA0120200000001",
      p_licence_categories: ["MCWG", "LMV"],
      p_expiry_date: "2035-01-01",
      p_front_document_path: newFront
    })

    expect(finRes.error).toBeNull()

    // Prior DL is superseded and is_current = false
    const oldRec = env.dls.get(oldDlId)
    expect(oldRec?.is_current).toBe(false)
    expect(oldRec?.status).toBe("superseded")

    // New DL is current and pending
    const newRec = env.dls.get(newSubId!)
    expect(newRec?.is_current).toBe(true)
    expect(newRec?.status).toBe("pending")

    // Audit log records resubmitted
    const audit = env.auditLogs.find(a => a.entity_id === newSubId)
    expect(audit?.action).toBe("resubmitted")
  })

  it("leaves prior approved DL completely intact if renewal finalization fails or aborts", () => {
    env.currentUser = { id: "renter-456", role: "student" }

    const oldDlId = "dl_old_approved"
    env.dls.set(oldDlId, {
      id: oldDlId,
      user_id: "renter-456",
      licence_number: "KA0120200000001",
      licence_categories: ["MCWOG"],
      expiry_date: "2025-01-01",
      front_document_path: "renter-456/dl_old_approved/front_1.jpg",
      back_document_path: null,
      status: "approved",
      is_current: true,
      rejection_reason: null,
      created_at: "2020-01-01T00:00:00Z",
      updated_at: "2020-01-01T00:00:00Z"
    })

    const { data: newSubId } = env.rpcCreateRenterDLSubmission()
    const newFront = `renter-456/${newSubId}/front_renewal.jpg`
    env.storageUpload("driving-licences", newFront, {})

    // Attempt finalization with expired date -> should throw error
    const finRes = env.rpcSubmitRenterDL({
      p_submission_id: newSubId!,
      p_licence_number: "KA0120200000001",
      p_licence_categories: ["MCWG"],
      p_expiry_date: "2020-01-01", // Past expiry
      p_front_document_path: newFront
    })

    expect(finRes.error).not.toBeNull()
    expect(finRes.error?.message).toMatch(/Driving licence has expired/i)

    // Prior DL MUST NOT be modified
    const oldRec = env.dls.get(oldDlId)
    expect(oldRec?.is_current).toBe(true)
    expect(oldRec?.status).toBe("approved")
  })

  // 5. Frontend Service submitDrivingLicenceWorkflow Unit Tests
  describe("Frontend Service submitDrivingLicenceWorkflow", () => {
    it("validates client inputs before initiating server RPCs", async () => {
      // Mock unauthenticated
      vi.spyOn(supabase.auth, "getUser").mockResolvedValueOnce({
        data: { user: null },
        error: new Error("No session")
      } as any)

      const dummyFile = new Blob(["test"], { type: "image/jpeg" })
      const invalidParams: SubmitDrivingLicenceParams = {
        licenceNumber: "KA",
        licenceCategories: ["MCWG"],
        expiryDate: "2030-01-01",
        frontFile: dummyFile
      }

      await expect(submitDrivingLicenceWorkflow(invalidParams)).rejects.toThrow(/Authentication required/i)
    })

    it("rejects input with invalid licence number length", async () => {
      vi.spyOn(supabase.auth, "getUser").mockResolvedValueOnce({
        data: { user: { id: "user-123" } as any },
        error: null
      })

      const dummyFile = new Blob(["test"], { type: "image/jpeg" })
      await expect(submitDrivingLicenceWorkflow({
        licenceNumber: "ABC",
        licenceCategories: ["MCWG"],
        expiryDate: "2030-01-01",
        frontFile: dummyFile
      })).rejects.toThrow(/Invalid licence number/i)
    })

    it("completes full submission workflow on successful uploads and RPCs", async () => {
      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: { user: { id: "user-abc" } as any },
        error: null
      })

      const rpcSpy = vi.spyOn(supabase, "rpc").mockImplementation(((name: string) => {
        if (name === "create_renter_dl_submission") {
          return Promise.resolve({ data: "sub-generated-123", error: null } as any)
        }
        if (name === "submit_renter_dl") {
          return Promise.resolve({ data: "sub-generated-123", error: null } as any)
        }
        return Promise.resolve({ data: null, error: null } as any)
      }) as any)

      const storageUploadSpy = vi.fn().mockResolvedValue({ data: { path: "ok" }, error: null })
      vi.spyOn(supabase.storage, "from").mockReturnValue({
        upload: storageUploadSpy
      } as any)

      const frontBlob = new Blob(["front"], { type: "image/jpeg" })
      const backBlob = new Blob(["back"], { type: "image/jpeg" })

      const result = await submitDrivingLicenceWorkflow({
        licenceNumber: "KA0120250001234",
        licenceCategories: ["MCWG", "LMV"],
        expiryDate: "2032-01-01",
        frontFile: frontBlob,
        frontFileName: "my_front.jpg",
        backFile: backBlob,
        backFileName: "my_back.jpg"
      })

      expect(result.success).toBe(true)
      expect(result.submissionId).toBe("sub-generated-123")
      expect(result.frontPath).toMatch(/^user-abc\/sub-generated-123\/front_.*\.jpg$/)
      expect(result.backPath).toMatch(/^user-abc\/sub-generated-123\/back_.*\.jpg$/)
      expect(storageUploadSpy).toHaveBeenCalledTimes(2)

      rpcSpy.mockRestore()
    })

    it("verifies getCurrentDrivingLicence filters out draft status", async () => {
      const maybeSingleSpy = vi.fn().mockResolvedValue({ data: { id: "dl-active", status: "approved" }, error: null })
      const neqSpy = vi.fn().mockReturnValue({ maybeSingle: maybeSingleSpy })
      const eqSpy2 = vi.fn().mockReturnValue({ neq: neqSpy })
      const eqSpy1 = vi.fn().mockReturnValue({ eq: eqSpy2 })
      const selectSpy = vi.fn().mockReturnValue({ eq: eqSpy1 })

      vi.spyOn(supabase, "from").mockReturnValue({
        select: selectSpy
      } as any)

      const dl = await getCurrentDrivingLicence("user-test")
      expect(dl).toBeDefined()
      expect(dl?.id).toBe("dl-active")
      expect(selectSpy).toHaveBeenCalledWith("*")
      expect(eqSpy1).toHaveBeenCalledWith("user_id", "user-test")
      expect(eqSpy2).toHaveBeenCalledWith("is_current", true)
      expect(neqSpy).toHaveBeenCalledWith("status", "draft")
    })

    it("supports safe draft resumption and retry with existingSubmissionId and existingFrontPath", async () => {
      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: { user: { id: "user-resume" } as any },
        error: null
      })

      const rpcSpy = vi.spyOn(supabase, "rpc").mockImplementation(((name: string) => {
        if (name === "submit_renter_dl") {
          return Promise.resolve({ data: "existing-sub-456", error: null } as any)
        }
        return Promise.resolve({ data: null, error: null } as any)
      }) as any)

      const storageUploadSpy = vi.fn().mockResolvedValue({ data: { path: "ok" }, error: null })
      vi.spyOn(supabase.storage, "from").mockReturnValue({
        upload: storageUploadSpy
      } as any)

      const backBlob = new Blob(["back"], { type: "image/jpeg" })

      // Renter already uploaded front on previous attempt; retries providing existingFrontPath and newly uploaded backFile
      const result = await submitDrivingLicenceWorkflow({
        licenceNumber: "KA0120250009999",
        licenceCategories: ["MCWG"],
        expiryDate: "2032-01-01",
        existingFrontPath: "user-resume/existing-sub-456/front_first_attempt.jpg",
        backFile: backBlob,
        backFileName: "retry_back.jpg",
        existingSubmissionId: "existing-sub-456"
      })

      expect(result.success).toBe(true)
      expect(result.submissionId).toBe("existing-sub-456")
      expect(result.frontPath).toBe("user-resume/existing-sub-456/front_first_attempt.jpg")
      expect(result.backPath).toMatch(/^user-resume\/existing-sub-456\/back_.*\.jpg$/)
      // Only uploaded the back file; did not re-upload front
      expect(storageUploadSpy).toHaveBeenCalledTimes(1)

      rpcSpy.mockRestore()
    })
  })

  // 6. Reconciliation Lifecycle & Tamper Protection Contract Tests
  describe("Lifecycle Tamper Protection & Admin Review Filtering", () => {
    it("resumes an existing unfinalized draft on retry without creating duplicate rows", () => {
      env.currentUser = { id: "renter-retry", role: "student" }
      const res1 = env.rpcCreateRenterDLSubmission()
      expect(res1.data).toBeDefined()

      // Second invocation while first is still draft must return the same submission ID
      const res2 = env.rpcCreateRenterDLSubmission()
      expect(res2.data).toBe(res1.data)
      expect(env.dls.size).toBe(1)
    })

    it("rejects unauthorized status modifications attempting to bypass review", () => {
      env.currentUser = { id: "renter-hack", role: "student" }
      const { data: subId } = env.rpcCreateRenterDLSubmission()

      // Non-admin student attempts to directly set status = 'approved'
      const res = env.simulateUpdateDL(subId!, { status: "approved" }, "student")
      expect(res.error).not.toBeNull()
      expect(res.error?.message).toMatch(/Only administrators can modify driving licence review status/i)
    })

    it("strictly prevents historical superseded, rejected, or expired DL from reactivating as current", () => {
      const historicalId = "hist_sub_1"
      env.dls.set(historicalId, {
        id: historicalId,
        user_id: "student-1",
        licence_number: "KA0120200000001",
        licence_categories: ["MCWG"],
        expiry_date: "2024-01-01",
        front_document_path: "student-1/hist_sub_1/front.jpg",
        back_document_path: null,
        status: "superseded",
        is_current: false,
        rejection_reason: null,
        created_at: "2020-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z"
      })

      // Attempt to reactivate historical DL as current
      const res = env.simulateUpdateDL(historicalId, { is_current: true }, "student")
      expect(res.error).not.toBeNull()
      expect(res.error?.message).toMatch(/Historical, rejected, or expired driving licences cannot be reactivated as current/i)
    })

    it("strictly excludes draft records from admin verification review queries", () => {
      // Seed mix of draft, pending, approved, rejected records
      const allRecords: MockDLRecord[] = [
        {
          id: "draft-1",
          user_id: "u1",
          licence_number: null,
          licence_categories: null,
          expiry_date: null,
          front_document_path: null,
          back_document_path: null,
          status: "draft",
          is_current: false,
          rejection_reason: null,
          created_at: "2026-11-24T00:00:00Z",
          updated_at: "2026-11-24T00:00:00Z"
        },
        {
          id: "pending-1",
          user_id: "u2",
          licence_number: "KA0120240001234",
          licence_categories: ["MCWG"],
          expiry_date: "2030-01-01",
          front_document_path: "u2/pending-1/front.jpg",
          back_document_path: null,
          status: "pending",
          is_current: true,
          rejection_reason: null,
          created_at: "2026-11-24T01:00:00Z",
          updated_at: "2026-11-24T01:00:00Z"
        },
        {
          id: "approved-1",
          user_id: "u3",
          licence_number: "KA0120220005678",
          licence_categories: ["LMV"],
          expiry_date: "2032-01-01",
          front_document_path: "u3/approved-1/front.jpg",
          back_document_path: null,
          status: "approved",
          is_current: true,
          rejection_reason: null,
          created_at: "2026-11-24T02:00:00Z",
          updated_at: "2026-11-24T02:00:00Z"
        }
      ]

      // Simulation of Admin Console query filter: .neq("status", "draft")
      const adminVisibleRecords = allRecords.filter((r) => r.status !== "draft")

      expect(adminVisibleRecords.length).toBe(2)
      expect(adminVisibleRecords.some((r) => r.status === "draft")).toBe(false)
      expect(adminVisibleRecords.map((r) => r.id)).toEqual(["pending-1", "approved-1"])
    })
  })
})
