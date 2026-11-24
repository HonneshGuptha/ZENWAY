-- Migration: 20261124000001_phase_a_verification_foundation.sql
-- Description: Phase A - Verification Foundation, Private Storage, Security Triggers & Admin Console
-- Scope: Vehicles verification extension, renter_driving_licences, verification_audit_logs,
--        app_settings, private storage buckets (vehicle-docs, driving-licences), and security review RPCs.

-- ============================================================================
-- 1. EXTEND public.vehicles (Additive, Preserving Listing Enums)
-- ============================================================================

-- Classification Columns
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS ev_speed_class text NULL
    CONSTRAINT chk_vehicles_ev_speed_class CHECK (ev_speed_class IS NULL OR ev_speed_class IN ('low_speed_exempt', 'high_speed_registered')),
ADD COLUMN IF NOT EXISTS ev_exemption_verified boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS transmission_type text NULL
    CONSTRAINT chk_vehicles_transmission_type CHECK (transmission_type IS NULL OR transmission_type IN ('gearless', 'geared'));

-- Ownership & RC Columns
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS registration_number text NULL
    CONSTRAINT chk_vehicles_registration_number CHECK (registration_number IS NULL OR length(trim(registration_number)) BETWEEN 4 AND 20),
ADD COLUMN IF NOT EXISTS is_registered_owner boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS rc_document_path text NULL,
ADD COLUMN IF NOT EXISTS rc_status text NOT NULL DEFAULT 'pending'
    CONSTRAINT chk_vehicles_rc_status CHECK (rc_status IN ('not_required', 'pending', 'approved', 'rejected'));

-- Insurance Columns
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS insurance_policy_number text NULL,
ADD COLUMN IF NOT EXISTS insurance_document_path text NULL,
ADD COLUMN IF NOT EXISTS insurance_expiry_date date NULL,
ADD COLUMN IF NOT EXISTS insurance_use_type text NULL
    CONSTRAINT chk_vehicles_insurance_use_type CHECK (insurance_use_type IS NULL OR insurance_use_type IN ('private_personal', 'commercial_self_drive', 'unknown')),
ADD COLUMN IF NOT EXISTS insurance_suitability_status text NOT NULL DEFAULT 'requires_review'
    CONSTRAINT chk_vehicles_insurance_suitability_status CHECK (insurance_suitability_status IN ('not_required', 'requires_review', 'suitable', 'unsuitable')),
ADD COLUMN IF NOT EXISTS insurance_status text NOT NULL DEFAULT 'pending'
    CONSTRAINT chk_vehicles_insurance_status CHECK (insurance_status IN ('not_required', 'pending', 'approved', 'rejected'));

-- PUC Columns
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS puc_exempt boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS puc_document_path text NULL,
ADD COLUMN IF NOT EXISTS puc_expiry_date date NULL,
ADD COLUMN IF NOT EXISTS puc_status text NOT NULL DEFAULT 'pending'
    CONSTRAINT chk_vehicles_puc_status CHECK (puc_status IN ('not_required', 'pending', 'approved', 'rejected'));

-- Owner Authorization Columns
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS authorization_document_path text NULL,
ADD COLUMN IF NOT EXISTS authorization_status text NOT NULL DEFAULT 'not_required'
    CONSTRAINT chk_vehicles_authorization_status CHECK (authorization_status IN ('not_required', 'pending', 'approved', 'rejected'));

-- Overall Verification & Grandfathering Columns
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS document_verification_status text NOT NULL DEFAULT 'pending'
    CONSTRAINT chk_vehicles_document_verification_status CHECK (document_verification_status IN ('not_required', 'legacy_grandfathered', 'pending', 'approved', 'rejected', 'expired')),
ADD COLUMN IF NOT EXISTS grandfather_expires_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS document_rejection_reason text NULL,
ADD COLUMN IF NOT EXISTS verified_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS verified_by uuid NULL REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_vehicles_doc_verification ON public.vehicles(document_verification_status);
CREATE INDEX IF NOT EXISTS idx_vehicles_grandfather_expiry ON public.vehicles(grandfather_expires_at) WHERE grandfather_expires_at IS NOT NULL;

-- Grant authenticated owners permission to update owner-managed vehicle specification and document fields
GRANT UPDATE (
    registration_number,
    rc_document_path,
    insurance_document_path,
    insurance_policy_number,
    insurance_expiry_date,
    puc_document_path,
    puc_expiry_date,
    authorization_document_path,
    is_registered_owner,
    ev_speed_class,
    transmission_type
) ON public.vehicles TO authenticated;

-- ============================================================================
-- 2. SINGLE-TIMESTAMP GRANDFATHERING BACKFILL (Preserving vehicles.status)
-- ============================================================================
DO $$
DECLARE
    v_migration_ts timestamptz := now();
BEGIN
    -- A. Bicycles: No motorized registration or insurance required
    UPDATE public.vehicles
    SET 
        document_verification_status = 'not_required',
        puc_exempt = true,
        rc_status = 'not_required',
        insurance_status = 'not_required',
        insurance_suitability_status = 'not_required',
        puc_status = 'not_required',
        authorization_status = 'not_required',
        grandfather_expires_at = NULL
    WHERE type = 'bicycle'
      AND document_verification_status = 'pending';

    -- B. Motorized vehicles created BEFORE this migration: Grandfather for 21 days
    -- Idempotent predicate: only rows with grandfather_expires_at IS NULL and document_verification_status = 'pending'
    UPDATE public.vehicles
    SET 
        document_verification_status = 'legacy_grandfathered',
        grandfather_expires_at = v_migration_ts + interval '21 days'
    WHERE type IN ('motorcycle', 'car', 'e_scooter')
      AND created_at <= v_migration_ts
      AND document_verification_status = 'pending'
      AND grandfather_expires_at IS NULL;
END $$;


-- ============================================================================
-- 3. CREATE public.renter_driving_licences (Renewal & History Capable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.renter_driving_licences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    licence_number text NULL,
    licence_categories text[] NULL,
    expiry_date date NULL,
    front_document_path text NULL,
    back_document_path text NULL,
    status text NOT NULL DEFAULT 'draft',
    rejection_reason text NULL,
    reviewed_at timestamptz NULL,
    reviewed_by uuid NULL REFERENCES public.profiles(id),
    is_current boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_renter_dl_status CHECK (
        status IN ('draft', 'pending', 'approved', 'rejected', 'expired', 'superseded')
    ),
    CONSTRAINT chk_renter_dl_categories CHECK (
        status = 'draft' OR (
            licence_categories IS NOT NULL 
            AND array_length(licence_categories, 1) > 0 
            AND licence_categories <@ ARRAY['MCWOG', 'MCWG', 'LMV']
        )
    ),
    CONSTRAINT chk_renter_dl_finalized_fields CHECK (
        status = 'draft' OR (
            licence_number IS NOT NULL AND length(trim(licence_number)) >= 5
            AND expiry_date IS NOT NULL
            AND front_document_path IS NOT NULL AND trim(front_document_path) != ''
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_renter_dl_user_id ON public.renter_driving_licences(user_id);
CREATE INDEX IF NOT EXISTS idx_renter_dl_status ON public.renter_driving_licences(status);
CREATE INDEX IF NOT EXISTS idx_renter_dl_expiry ON public.renter_driving_licences(expiry_date);

-- Partial unique index: Exactly one active/current DL per student
CREATE UNIQUE INDEX IF NOT EXISTS idx_renter_dl_unique_current 
    ON public.renter_driving_licences(user_id) 
    WHERE is_current = true;

ALTER TABLE public.renter_driving_licences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'renter_driving_licences' AND policyname = 'renter_dl_select_owner_admin'
    ) THEN
        CREATE POLICY "renter_dl_select_owner_admin" ON public.renter_driving_licences
            FOR SELECT TO authenticated
            USING (user_id = auth.uid() OR public.is_admin());
    END IF;

    DROP POLICY IF EXISTS "renter_dl_insert_owner" ON public.renter_driving_licences;
    DROP POLICY IF EXISTS "renter_dl_update_owner_admin" ON public.renter_driving_licences;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'renter_driving_licences' AND policyname = 'renter_dl_admin_write'
    ) THEN
        CREATE POLICY "renter_dl_admin_write" ON public.renter_driving_licences
            FOR ALL TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;


-- ============================================================================
-- 4. CREATE public.verification_audit_logs (Immutable Compliance Ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.verification_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    subject_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_type text NOT NULL,
    action text NOT NULL,
    previous_status text NULL,
    new_status text NOT NULL,
    reason text NULL,
    actor_id uuid NULL REFERENCES public.profiles(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_val_entity_type CHECK (entity_type IN ('vehicle_document', 'renter_dl')),
    CONSTRAINT chk_val_action CHECK (action IN ('submitted', 'resubmitted', 'approved', 'rejected', 'expired', 'invalidated_on_edit', 'admin_override', 'pending_review'))
);

CREATE INDEX IF NOT EXISTS idx_val_subject ON public.verification_audit_logs(subject_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_val_entity ON public.verification_audit_logs(entity_type, entity_id);

-- Enforce append-only integrity: revoke all mutations from ordinary roles
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.verification_audit_logs FROM PUBLIC, anon, authenticated;

ALTER TABLE public.verification_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'verification_audit_logs' AND policyname = 'val_select_owner_admin'
    ) THEN
        CREATE POLICY "val_select_owner_admin" ON public.verification_audit_logs
            FOR SELECT TO authenticated
            USING (public.is_admin() OR subject_user_id = auth.uid());
    END IF;
END $$;


-- ============================================================================
-- 5. CREATE public.app_settings (Platform Configuration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    id text PRIMARY KEY DEFAULT 'default',
    dl_custody_policy_mode text NOT NULL DEFAULT 'optional'
        CONSTRAINT chk_app_settings_dl_custody_policy_mode 
        CHECK (dl_custody_policy_mode IN ('disabled', 'optional', 'required')),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid NULL REFERENCES public.profiles(id)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Ensure anon and PUBLIC cannot read rows; authenticated can read; admin can write
REVOKE ALL ON public.app_settings FROM PUBLIC, anon;
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

DROP POLICY IF EXISTS "app_settings_read_all" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_read_authenticated" ON public.app_settings;
CREATE POLICY "app_settings_read_authenticated" ON public.app_settings
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "app_settings_admin_write" ON public.app_settings;
CREATE POLICY "app_settings_admin_write" ON public.app_settings
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

INSERT INTO public.app_settings (id, dl_custody_policy_mode)
VALUES ('default', 'optional')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 6. PROVISION PRIVATE STORAGE BUCKETS (vehicle-docs & driving-licences)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('vehicle-docs', 'vehicle-docs', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    ('driving-licences', 'driving-licences', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies
DO $$ BEGIN
    -- A. vehicle-docs INSERT: <owner_user_id>/<vehicle_id>/<doc_type>/<unique_id>.<ext>
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'vehicle_docs_upload_owner'
    ) THEN
        CREATE POLICY "vehicle_docs_upload_owner" ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (
                bucket_id = 'vehicle-docs'
                AND (storage.foldername(name))[1] = auth.uid()::text
                AND array_length(storage.foldername(name), 1) = 3
                AND (storage.foldername(name))[3] IN ('rc', 'insurance', 'puc', 'authorization')
                AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'pdf')
                AND EXISTS (
                    SELECT 1 FROM public.vehicles v
                    WHERE v.id::text = (storage.foldername(name))[2]
                      AND (v.owner_id = auth.uid() OR public.is_admin())
                )
            );
    END IF;

    -- B. vehicle-docs SELECT: Owner or Admin via signed URL
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'vehicle_docs_select_owner_admin'
    ) THEN
        CREATE POLICY "vehicle_docs_select_owner_admin" ON storage.objects
            FOR SELECT TO authenticated
            USING (
                bucket_id = 'vehicle-docs'
                AND (
                    public.is_admin()
                    OR (
                        (storage.foldername(name))[1] = auth.uid()::text
                        AND EXISTS (
                            SELECT 1 FROM public.vehicles v
                            WHERE v.id::text = (storage.foldername(name))[2]
                              AND v.owner_id = auth.uid()
                        )
                    )
                )
            );
    END IF;

    -- C. driving-licences INSERT: <renter_user_id>/<dl_submission_id>/<side>_<unique_id>.<ext>
    DROP POLICY IF EXISTS "driving_licences_upload_owner" ON storage.objects;
    CREATE POLICY "driving_licences_upload_owner" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'driving-licences'
            AND (storage.foldername(name))[1] = auth.uid()::text
            AND array_length(storage.foldername(name), 1) = 2
            AND (storage.filename(name) ~* '^(front|back)_[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp|pdf)$')
            AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'pdf')
            AND EXISTS (
                SELECT 1 FROM public.renter_driving_licences r
                WHERE r.id::text = (storage.foldername(name))[2]
                  AND r.user_id = auth.uid()
                  AND r.status = 'draft'
            )
        );

    -- C2. driving-licences UPDATE: Allows safe upload replacement/retry on active drafts
    DROP POLICY IF EXISTS "driving_licences_update_owner" ON storage.objects;
    CREATE POLICY "driving_licences_update_owner" ON storage.objects
        FOR UPDATE TO authenticated
        USING (
            bucket_id = 'driving-licences'
            AND (storage.foldername(name))[1] = auth.uid()::text
            AND array_length(storage.foldername(name), 1) = 2
            AND EXISTS (
                SELECT 1 FROM public.renter_driving_licences r
                WHERE r.id::text = (storage.foldername(name))[2]
                  AND r.user_id = auth.uid()
                  AND r.status = 'draft'
            )
        )
        WITH CHECK (
            bucket_id = 'driving-licences'
            AND (storage.foldername(name))[1] = auth.uid()::text
            AND array_length(storage.foldername(name), 1) = 2
            AND (storage.filename(name) ~* '^(front|back)_[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp|pdf)$')
            AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'pdf')
            AND EXISTS (
                SELECT 1 FROM public.renter_driving_licences r
                WHERE r.id::text = (storage.foldername(name))[2]
                  AND r.user_id = auth.uid()
                  AND r.status = 'draft'
            )
        );

    -- D. driving-licences SELECT: Owner or Admin via signed URL
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'driving_licences_select_owner_admin'
    ) THEN
        CREATE POLICY "driving_licences_select_owner_admin" ON storage.objects
            FOR SELECT TO authenticated
            USING (
                bucket_id = 'driving-licences'
                AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
            );
    END IF;
END $$;


-- ============================================================================
-- 7. SECURITY TRIGGERS: TAMPER-PROTECTION & ATOMIC INVALIDATION
-- ============================================================================

-- A. Vehicles Tamper Protection & Edit Invalidation Trigger
CREATE OR REPLACE FUNCTION public.trg_vehicles_verification_tamper_and_invalidation()
RETURNS trigger AS $$
DECLARE
    v_is_admin boolean;
    v_has_doc_path_changed boolean := false;
    v_has_spec_changed boolean := false;
BEGIN
    v_is_admin := public.is_admin();

    -- 1. Non-admin tamper protection on admin-reviewed verification fields
    IF NOT v_is_admin THEN
        IF (NEW.document_verification_status IS DISTINCT FROM OLD.document_verification_status) OR
           (NEW.rc_status IS DISTINCT FROM OLD.rc_status) OR
           (NEW.insurance_status IS DISTINCT FROM OLD.insurance_status) OR
           (NEW.insurance_suitability_status IS DISTINCT FROM OLD.insurance_suitability_status) OR
           (NEW.insurance_use_type IS DISTINCT FROM OLD.insurance_use_type) OR
           (NEW.puc_status IS DISTINCT FROM OLD.puc_status) OR
           (NEW.puc_exempt IS DISTINCT FROM OLD.puc_exempt) OR
           (NEW.authorization_status IS DISTINCT FROM OLD.authorization_status) OR
           (NEW.ev_exemption_verified IS DISTINCT FROM OLD.ev_exemption_verified) OR
           (NEW.grandfather_expires_at IS DISTINCT FROM OLD.grandfather_expires_at) OR
           (NEW.document_rejection_reason IS DISTINCT FROM OLD.document_rejection_reason) OR
           (NEW.verified_at IS DISTINCT FROM OLD.verified_at) OR
           (NEW.verified_by IS DISTINCT FROM OLD.verified_by) THEN
            RAISE EXCEPTION 'Access Denied: Verification statuses and admin metadata cannot be modified by vehicle owners.';
        END IF;
    END IF;

    -- 2. Detect owner document or specification modifications
    IF (NEW.registration_number IS DISTINCT FROM OLD.registration_number) THEN
        NEW.rc_status := 'pending';
        v_has_doc_path_changed := true;
    END IF;

    IF (NEW.rc_document_path IS DISTINCT FROM OLD.rc_document_path) THEN
        NEW.rc_status := 'pending';
        v_has_doc_path_changed := true;
    END IF;

    IF (NEW.insurance_document_path IS DISTINCT FROM OLD.insurance_document_path) OR
       (NEW.insurance_policy_number IS DISTINCT FROM OLD.insurance_policy_number) OR
       (NEW.insurance_expiry_date IS DISTINCT FROM OLD.insurance_expiry_date) THEN
        NEW.insurance_status := 'pending';
        NEW.insurance_suitability_status := 'requires_review';
        v_has_doc_path_changed := true;
    END IF;

    IF (NEW.puc_document_path IS DISTINCT FROM OLD.puc_document_path) OR
       (NEW.puc_expiry_date IS DISTINCT FROM OLD.puc_expiry_date) THEN
        NEW.puc_status := 'pending';
        v_has_doc_path_changed := true;
    END IF;

    IF (NEW.authorization_document_path IS DISTINCT FROM OLD.authorization_document_path) THEN
        NEW.authorization_status := 'pending';
        v_has_doc_path_changed := true;
    END IF;

    IF (NEW.is_registered_owner IS DISTINCT FROM OLD.is_registered_owner) THEN
        IF NOT NEW.is_registered_owner THEN
            NEW.authorization_status := 'pending';
        ELSE
            NEW.authorization_status := 'not_required';
        END IF;
        v_has_spec_changed := true;
    END IF;

    IF (NEW.ev_speed_class IS DISTINCT FROM OLD.ev_speed_class) THEN
        NEW.ev_exemption_verified := false;
        v_has_spec_changed := true;
    END IF;

    IF (NEW.transmission_type IS DISTINCT FROM OLD.transmission_type) THEN
        v_has_spec_changed := true;
    END IF;

    -- 3. Atomic Invalidation: If any document or specification changed, reset verification status
    IF (v_has_doc_path_changed OR v_has_spec_changed) AND NOT v_is_admin THEN
        NEW.document_verification_status := 'pending';
        NEW.verified_at := NULL;
        NEW.verified_by := NULL;
        NEW.document_rejection_reason := NULL;

        IF OLD.document_verification_status IN ('approved', 'legacy_grandfathered') THEN
            -- Log to verification_audit_logs atomically
            INSERT INTO public.verification_audit_logs (
                entity_type,
                entity_id,
                subject_user_id,
                document_type,
                action,
                previous_status,
                new_status,
                reason,
                actor_id
            ) VALUES (
                'vehicle_document',
                NEW.id,
                NEW.owner_id,
                'vehicle_profile',
                'invalidated_on_edit',
                OLD.document_verification_status,
                'pending',
                'Vehicle documents or classification specifications modified by owner.',
                auth.uid()
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_vehicles_verification_tamper_and_invalidation ON public.vehicles;
CREATE TRIGGER trg_vehicles_verification_tamper_and_invalidation
BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.trg_vehicles_verification_tamper_and_invalidation();


-- B. Renter DL Tamper Protection Trigger
CREATE OR REPLACE FUNCTION public.trg_renter_dl_tamper_protection()
RETURNS trigger AS $$
BEGIN
    IF NOT public.is_admin() THEN
        IF (NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by) OR
           (NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at) OR
           (NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason) THEN
            RAISE EXCEPTION 'Access Denied: Only administrators can modify driving licence review status and reasons.';
        END IF;

        IF (NEW.status IS DISTINCT FROM OLD.status) THEN
            IF NOT (
                (OLD.status = 'draft' AND NEW.status = 'pending') OR
                (OLD.status IN ('approved', 'pending') AND NEW.status = 'superseded')
            ) THEN
                RAISE EXCEPTION 'Access Denied: Only administrators can modify driving licence review status.';
            END IF;
        END IF;

        -- Prevent historical/rejected/expired licences from becoming current
        IF NEW.is_current = true AND OLD.is_current = false THEN
            IF OLD.status IN ('rejected', 'expired', 'superseded') THEN
                RAISE EXCEPTION 'Access Denied: Historical, rejected, or expired driving licences cannot be reactivated as current.';
            END IF;
            IF OLD.status = 'draft' AND NEW.status != 'pending' THEN
                RAISE EXCEPTION 'Access Denied: Draft driving licences can only become current upon pending finalization.';
            END IF;
        END IF;
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_renter_dl_tamper_protection ON public.renter_driving_licences;
CREATE TRIGGER trg_renter_dl_tamper_protection
BEFORE UPDATE ON public.renter_driving_licences
FOR EACH ROW EXECUTE FUNCTION public.trg_renter_dl_tamper_protection();


-- ============================================================================
-- 8. SECURITY DEFINER RPCs (Admin Review & Student DL Submission)
-- ============================================================================

-- A0. Create Pre-Upload Renter Driving Licence Submission RPC
CREATE OR REPLACE FUNCTION public.create_renter_dl_submission()
RETURNS uuid AS $$
DECLARE
    v_user_id uuid;
    v_existing_id uuid;
    v_new_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication Required: Please sign in to initiate driving licence submission.';
    END IF;

    -- Resume existing unfinalized draft if one is already active for this student
    SELECT id INTO v_existing_id
    FROM public.renter_driving_licences
    WHERE user_id = v_user_id AND status = 'draft' AND is_current = false
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        RETURN v_existing_id;
    END IF;

    -- Create unfinalized draft submission permanently bound to authenticated student
    INSERT INTO public.renter_driving_licences (
        user_id,
        status,
        is_current
    ) VALUES (
        v_user_id,
        'draft',
        false
    )
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.create_renter_dl_submission() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_renter_dl_submission() TO authenticated, service_role;


-- A1. Finalize / Submit / Renew Renter Driving Licence RPC
DROP FUNCTION IF EXISTS public.submit_renter_dl(text, text[], date, text, text);
DROP FUNCTION IF EXISTS public.submit_renter_dl(uuid, text, text[], date, text, text);

CREATE OR REPLACE FUNCTION public.submit_renter_dl(
    p_submission_id uuid,
    p_licence_number text,
    p_licence_categories text[],
    p_expiry_date date,
    p_front_document_path text,
    p_back_document_path text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_user_id uuid;
    v_clean_number text;
    v_prior_id uuid;
    v_had_prior boolean := false;
    v_submission_user_id uuid;
    v_submission_status text;
    v_expected_prefix text;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication Required: Please sign in to submit driving licence.';
    END IF;

    IF p_submission_id IS NULL THEN
        RAISE EXCEPTION 'Missing Submission ID: Submission ID is required.';
    END IF;

    -- Lock and validate the target draft submission
    SELECT user_id, status
    INTO v_submission_user_id, v_submission_status
    FROM public.renter_driving_licences
    WHERE id = p_submission_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid Submission: Submission record not found.';
    END IF;

    IF v_submission_user_id != v_user_id THEN
        RAISE EXCEPTION 'Access Denied: You do not own this driving licence submission.';
    END IF;

    IF v_submission_status != 'draft' THEN
        RAISE EXCEPTION 'Invalid Submission State: Submission has already been finalized or is not in draft state.';
    END IF;

    v_clean_number := upper(trim(p_licence_number));
    IF length(v_clean_number) < 5 THEN
        RAISE EXCEPTION 'Invalid Driving Licence Number: Must be at least 5 alphanumeric characters.';
    END IF;

    IF p_licence_categories IS NULL OR array_length(p_licence_categories, 1) = 0 THEN
        RAISE EXCEPTION 'Invalid Categories: Please select at least one driving licence category.';
    END IF;

    IF NOT (p_licence_categories <@ ARRAY['MCWOG', 'MCWG', 'LMV']) THEN
        RAISE EXCEPTION 'Invalid Categories: Selected categories must be a subset of MCWOG, MCWG, LMV.';
    END IF;

    IF p_expiry_date <= CURRENT_DATE THEN
        RAISE EXCEPTION 'Invalid Expiry Date: Driving licence has expired.';
    END IF;

    IF trim(COALESCE(p_front_document_path, '')) = '' THEN
        RAISE EXCEPTION 'Missing Document: Front driving licence image is required.';
    END IF;

    -- Path prefix must strictly match <user_id>/<p_submission_id>/
    v_expected_prefix := v_user_id::text || '/' || p_submission_id::text || '/';

    IF p_front_document_path !~* ('^' || v_expected_prefix || 'front_[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp|pdf)$') THEN
        RAISE EXCEPTION 'Security Violation: Front DL document path must be formatted as %front_<upload_id>.<ext>', v_expected_prefix;
    END IF;

    IF p_back_document_path IS NOT NULL AND trim(p_back_document_path) <> '' THEN
        IF p_back_document_path !~* ('^' || v_expected_prefix || 'back_[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp|pdf)$') THEN
            RAISE EXCEPTION 'Security Violation: Back DL document path must be formatted as %back_<upload_id>.<ext>', v_expected_prefix;
        END IF;
    END IF;

    -- Verify storage objects actually exist in driving-licences bucket
    IF NOT EXISTS (
        SELECT 1 FROM storage.objects
        WHERE bucket_id = 'driving-licences'
          AND name = p_front_document_path
    ) THEN
        RAISE EXCEPTION 'Storage Verification Failed: Front DL document does not exist in private storage.';
    END IF;

    IF p_back_document_path IS NOT NULL AND trim(p_back_document_path) <> '' THEN
        IF NOT EXISTS (
            SELECT 1 FROM storage.objects
            WHERE bucket_id = 'driving-licences'
              AND name = p_back_document_path
        ) THEN
            RAISE EXCEPTION 'Storage Verification Failed: Back DL document does not exist in private storage.';
        END IF;
    END IF;

    -- Concurrency-safe atomic renewal: Lock any current active submission for this user
    SELECT id INTO v_prior_id
    FROM public.renter_driving_licences
    WHERE user_id = v_user_id AND is_current = true
    FOR UPDATE;

    IF FOUND THEN
        UPDATE public.renter_driving_licences
        SET 
            is_current = false,
            status = CASE WHEN status = 'approved' THEN 'superseded' ELSE status END,
            updated_at = now()
        WHERE id = v_prior_id;
        v_had_prior := true;
    END IF;

    -- Update and finalize the draft submission to pending and is_current = true
    UPDATE public.renter_driving_licences
    SET 
        licence_number = v_clean_number,
        licence_categories = p_licence_categories,
        expiry_date = p_expiry_date,
        front_document_path = p_front_document_path,
        back_document_path = NULLIF(trim(p_back_document_path), ''),
        status = 'pending',
        is_current = true,
        updated_at = now()
    WHERE id = p_submission_id;

    -- Append to immutable verification_audit_logs
    INSERT INTO public.verification_audit_logs (
        entity_type,
        entity_id,
        subject_user_id,
        document_type,
        action,
        previous_status,
        new_status,
        reason,
        actor_id
    ) VALUES (
        'renter_dl',
        p_submission_id,
        v_user_id,
        'driving_licence',
        CASE WHEN v_had_prior THEN 'resubmitted' ELSE 'submitted' END,
        'draft',
        'pending',
        'Student finalized driving licence credentials for campus verification.',
        v_user_id
    );

    RETURN p_submission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.submit_renter_dl(uuid, text, text[], date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_renter_dl(uuid, text, text[], date, text, text) TO authenticated, service_role;


-- B. Admin Review Vehicle Documents RPC
CREATE OR REPLACE FUNCTION public.review_vehicle_documents(
    p_vehicle_id uuid,
    p_overall_status text,
    p_rejection_reason text DEFAULT NULL,
    p_rc_status text DEFAULT NULL,
    p_insurance_status text DEFAULT NULL,
    p_insurance_suitability_status text DEFAULT NULL,
    p_insurance_use_type text DEFAULT NULL,
    p_puc_status text DEFAULT NULL,
    p_puc_exempt boolean DEFAULT NULL,
    p_authorization_status text DEFAULT NULL,
    p_ev_exemption_verified boolean DEFAULT NULL,
    p_notes text DEFAULT NULL,
    p_expected_status text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_admin_id uuid;
    v_owner_id uuid;
    v_prev_status text;
    v_type text;
    v_curr_rc_status text;
    v_curr_ins_status text;
    v_curr_ins_suit text;
    v_curr_puc_status text;
    v_curr_puc_exempt boolean;
    v_curr_auth_status text;
    v_curr_is_reg_owner boolean;
    v_curr_ev_class text;
    v_curr_ev_exempt boolean;
    v_final_rc_status text;
    v_final_ins_status text;
    v_final_ins_suit text;
    v_final_puc_status text;
    v_final_puc_exempt boolean;
    v_final_auth_status text;
    v_final_ev_exempt boolean;
BEGIN
    v_admin_id := auth.uid();
    IF v_admin_id IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Administrative privileges required.';
    END IF;

    IF p_overall_status NOT IN ('approved', 'rejected', 'pending') THEN
        RAISE EXCEPTION 'Invalid Status: Overall status must be approved, rejected, or pending.';
    END IF;

    SELECT 
        owner_id, 
        document_verification_status,
        type::text,
        rc_status,
        insurance_status,
        insurance_suitability_status,
        puc_status,
        puc_exempt,
        authorization_status,
        is_registered_owner,
        ev_speed_class,
        ev_exemption_verified
    INTO 
        v_owner_id, 
        v_prev_status,
        v_type,
        v_curr_rc_status,
        v_curr_ins_status,
        v_curr_ins_suit,
        v_curr_puc_status,
        v_curr_puc_exempt,
        v_curr_auth_status,
        v_curr_is_reg_owner,
        v_curr_ev_class,
        v_curr_ev_exempt
    FROM public.vehicles
    WHERE id = p_vehicle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vehicle not found.';
    END IF;

    IF p_expected_status IS NOT NULL AND v_prev_status IS DISTINCT FROM p_expected_status THEN
        RAISE EXCEPTION 'Stale Review Conflict: Vehicle document verification status was changed from % to % by another session.', p_expected_status, v_prev_status;
    END IF;

    -- Calculate effective final statuses
    v_final_rc_status := COALESCE(p_rc_status, v_curr_rc_status);
    v_final_ins_status := COALESCE(p_insurance_status, v_curr_ins_status);
    v_final_ins_suit := COALESCE(p_insurance_suitability_status, v_curr_ins_suit);
    v_final_puc_status := COALESCE(p_puc_status, v_curr_puc_status);
    v_final_puc_exempt := COALESCE(p_puc_exempt, v_curr_puc_exempt, false);
    v_final_auth_status := COALESCE(p_authorization_status, v_curr_auth_status);
    v_final_ev_exempt := COALESCE(p_ev_exemption_verified, v_curr_ev_exempt, false);

    -- Enforce consistency: prevent contradictory vehicle approval
    IF p_overall_status = 'approved' THEN
        IF v_type != 'bicycle' THEN
            -- RC check
            IF v_type = 'e_scooter' AND v_curr_ev_class = 'low_speed_exempt' AND v_final_ev_exempt = true THEN
                NULL;
            ELSE
                IF v_final_rc_status != 'approved' THEN
                    RAISE EXCEPTION 'Cannot approve vehicle: Registration Certificate (RC) is not approved.';
                END IF;
            END IF;

            -- Insurance check
            IF v_final_ins_status != 'approved' THEN
                RAISE EXCEPTION 'Cannot approve vehicle: Insurance policy is not approved.';
            END IF;
            IF v_final_ins_suit != 'suitable' THEN
                RAISE EXCEPTION 'Cannot approve vehicle: Insurance suitability must be marked suitable.';
            END IF;

            -- PUC check
            IF NOT v_final_puc_exempt THEN
                IF v_final_puc_status != 'approved' THEN
                    RAISE EXCEPTION 'Cannot approve vehicle: PUC certificate is not approved.';
                END IF;
            END IF;

            -- Authorization letter check
            IF NOT v_curr_is_reg_owner THEN
                IF v_final_auth_status != 'approved' THEN
                    RAISE EXCEPTION 'Cannot approve vehicle: Owner authorization letter is not approved.';
                END IF;
            END IF;
        END IF;
    END IF;

    UPDATE public.vehicles
    SET 
        document_verification_status = p_overall_status,
        document_rejection_reason = CASE WHEN p_overall_status = 'rejected' THEN p_rejection_reason ELSE NULL END,
        rc_status = v_final_rc_status,
        insurance_status = v_final_ins_status,
        insurance_suitability_status = v_final_ins_suit,
        insurance_use_type = COALESCE(p_insurance_use_type, insurance_use_type),
        puc_status = v_final_puc_status,
        puc_exempt = v_final_puc_exempt,
        authorization_status = v_final_auth_status,
        ev_exemption_verified = v_final_ev_exempt,
        verified_at = CASE WHEN p_overall_status = 'pending' THEN NULL ELSE now() END,
        verified_by = CASE WHEN p_overall_status = 'pending' THEN NULL ELSE v_admin_id END,
        updated_at = now()
    WHERE id = p_vehicle_id;

    -- Append audit entry
    INSERT INTO public.verification_audit_logs (
        entity_type,
        entity_id,
        subject_user_id,
        document_type,
        action,
        previous_status,
        new_status,
        reason,
        actor_id
    ) VALUES (
        'vehicle_document',
        p_vehicle_id,
        v_owner_id,
        'vehicle_papers',
        CASE 
            WHEN p_overall_status = 'approved' THEN 'approved'
            WHEN p_overall_status = 'rejected' THEN 'rejected'
            ELSE 'pending_review'
        END,
        v_prev_status,
        p_overall_status,
        COALESCE(p_rejection_reason, p_notes),
        v_admin_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'vehicle_id', p_vehicle_id,
        'document_verification_status', p_overall_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.review_vehicle_documents(uuid, text, text, text, text, text, text, text, boolean, text, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_vehicle_documents(uuid, text, text, text, text, text, text, text, boolean, text, boolean, text, text) TO authenticated, service_role;


-- C. Admin Review Renter Driving Licence RPC
CREATE OR REPLACE FUNCTION public.review_renter_dl(
    p_licence_id uuid,
    p_decision text,
    p_rejection_reason text DEFAULT NULL,
    p_notes text DEFAULT NULL,
    p_expected_status text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_admin_id uuid;
    v_user_id uuid;
    v_prev_status text;
    v_is_current boolean;
BEGIN
    v_admin_id := auth.uid();
    IF v_admin_id IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Administrative privileges required.';
    END IF;

    IF p_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid Decision: Decision must be approved or rejected.';
    END IF;

    SELECT user_id, status, is_current
    INTO v_user_id, v_prev_status, v_is_current
    FROM public.renter_driving_licences
    WHERE id = p_licence_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Driving licence record not found.';
    END IF;

    IF NOT v_is_current OR v_prev_status = 'superseded' THEN
        RAISE EXCEPTION 'Stale Review Conflict: This driving licence submission is no longer current or has been superseded.';
    END IF;

    IF p_expected_status IS NOT NULL AND v_prev_status IS DISTINCT FROM p_expected_status THEN
        RAISE EXCEPTION 'Stale Review Conflict: Driving licence status was changed from % to % by another session.', p_expected_status, v_prev_status;
    END IF;

    UPDATE public.renter_driving_licences
    SET 
        status = p_decision,
        rejection_reason = CASE WHEN p_decision = 'rejected' THEN p_rejection_reason ELSE NULL END,
        reviewed_at = now(),
        reviewed_by = v_admin_id,
        updated_at = now()
    WHERE id = p_licence_id;

    -- Append audit entry
    INSERT INTO public.verification_audit_logs (
        entity_type,
        entity_id,
        subject_user_id,
        document_type,
        action,
        previous_status,
        new_status,
        reason,
        actor_id
    ) VALUES (
        'renter_dl',
        p_licence_id,
        v_user_id,
        'driving_licence',
        p_decision,
        v_prev_status,
        p_decision,
        COALESCE(p_rejection_reason, p_notes),
        v_admin_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'licence_id', p_licence_id,
        'status', p_decision
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.review_renter_dl(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_renter_dl(uuid, text, text, text, text) TO authenticated, service_role;


-- D. Admin Query Verification Audit Logs RPC
CREATE OR REPLACE FUNCTION public.get_admin_verification_audit_logs(
    p_entity_type text DEFAULT NULL,
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    entity_type text,
    entity_id uuid,
    subject_user_id uuid,
    subject_name text,
    document_type text,
    action text,
    previous_status text,
    new_status text,
    reason text,
    actor_id uuid,
    actor_name text,
    created_at timestamptz
) AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Administrator access required.';
    END IF;

    RETURN QUERY
    SELECT 
        val.id,
        val.entity_type,
        val.entity_id,
        val.subject_user_id,
        p_sub.full_name AS subject_name,
        val.document_type,
        val.action,
        val.previous_status,
        val.new_status,
        val.reason,
        val.actor_id,
        p_act.full_name AS actor_name,
        val.created_at
    FROM public.verification_audit_logs val
    LEFT JOIN public.profiles p_sub ON p_sub.id = val.subject_user_id
    LEFT JOIN public.profiles p_act ON p_act.id = val.actor_id
    WHERE (p_entity_type IS NULL OR val.entity_type = p_entity_type)
    ORDER BY val.created_at DESC
    LIMIT LEAST(p_limit, 200)
    OFFSET GREATEST(p_offset, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_admin_verification_audit_logs(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_verification_audit_logs(text, integer, integer) TO authenticated, service_role;

-- E. Admin Confirm Test User Email RPC (Testing Support)
CREATE OR REPLACE FUNCTION public.confirm_test_user_email(p_email text)
RETURNS boolean AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Administrator access required.';
    END IF;

    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE email = p_email;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE EXECUTE ON FUNCTION public.confirm_test_user_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_test_user_email(text) TO authenticated, service_role;
