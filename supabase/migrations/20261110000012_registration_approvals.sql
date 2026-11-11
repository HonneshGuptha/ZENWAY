-- Migration: 20261110000012_registration_approvals.sql
-- Description: Administrator registration approval system with anti-tamper triggers and dedicated administrative review RPCs.

-- 1. Create registration approval status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'registration_approval_status') THEN
        CREATE TYPE public.registration_approval_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END $$;

-- 2. Add registration approval columns to profiles
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS registration_status public.registration_approval_status NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS registration_rejection_reason text NULL,
    ADD COLUMN IF NOT EXISTS registration_reviewed_at timestamptz NULL,
    ADD COLUMN IF NOT EXISTS registration_reviewed_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Automatically mark ALL existing profiles created before migration 12 as approved
-- Preserves login eligibility for all existing users (including unverified students)
-- while column DEFAULT 'pending' and handle_new_user() ensure newly registered users require admin approval.
UPDATE public.profiles 
SET registration_status = 'approved'
WHERE registration_status != 'approved';

-- Explicitly grant SELECT on new registration approval columns to authenticated users
-- (Preserves column-level security restrictions established in migration 09)
GRANT SELECT (registration_status, registration_rejection_reason, registration_reviewed_at, registration_reviewed_by) 
    ON public.profiles TO authenticated;

-- Index for admin registration queue
CREATE INDEX IF NOT EXISTS idx_profiles_registration_queue 
    ON public.profiles(registration_status, created_at ASC);

-- 3. Update handle_new_user() to populate phone_number, university_name and set registration_status to pending
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_full_name text;
    v_phone text;
    v_university text;
BEGIN
    v_full_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(trim(split_part(NEW.email, '@', 1)), ''),
        'Student'
    );

    IF length(v_full_name) < 2 THEN
        v_full_name := v_full_name || ' Student';
    END IF;

    v_phone := NULLIF(trim(NEW.raw_user_meta_data->>'phone_number'), '');
    v_university := NULLIF(trim(NEW.raw_user_meta_data->>'university_name'), '');

    INSERT INTO public.profiles (
        id,
        full_name,
        phone_number,
        university_name,
        role,
        verification_status,
        registration_status
    ) VALUES (
        NEW.id,
        v_full_name,
        v_phone,
        v_university,
        'student',
        'unverified',
        'pending'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone_number = COALESCE(public.profiles.phone_number, EXCLUDED.phone_number),
        university_name = COALESCE(public.profiles.university_name, EXCLUDED.university_name);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. Update protect_profile_sensitive_columns() to strictly protect registration approval fields
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS trigger AS $$
BEGIN
    -- If trusted administrative provisioning is active for this transaction, permit updates
    IF current_setting('zenway.trusted_provisioning', true) = 'true' THEN
        RETURN NEW;
    END IF;

    -- Non-administrators cannot modify role
    IF (NEW.role IS DISTINCT FROM OLD.role) THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Access Denied: Only administrators can modify user roles.';
        END IF;
    END IF;

    -- Non-administrators cannot modify verification_status directly (except unverified -> pending)
    IF (NEW.verification_status IS DISTINCT FROM OLD.verification_status) THEN
        IF NOT public.is_admin() THEN
            IF NOT (OLD.verification_status = 'unverified' AND NEW.verification_status = 'pending') THEN
                RAISE EXCEPTION 'Access Denied: Only administrators or verification workflows can modify account verification status.';
            END IF;
        END IF;
    END IF;

    -- Non-administrators cannot modify registration_status, rejection reason, or review metadata
    IF (NEW.registration_status IS DISTINCT FROM OLD.registration_status) OR
       (NEW.registration_rejection_reason IS DISTINCT FROM OLD.registration_rejection_reason) OR
       (NEW.registration_reviewed_at IS DISTINCT FROM OLD.registration_reviewed_at) OR
       (NEW.registration_reviewed_by IS DISTINCT FROM OLD.registration_reviewed_by) THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Access Denied: Only administrators can modify registration approval status.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. Administrative RPC: Approve Registration
CREATE OR REPLACE FUNCTION public.approve_registration(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
    v_current_status public.registration_approval_status;
    v_user_email text;
BEGIN
    -- Verify administrator authorization
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Administrator privileges required to approve registrations.';
    END IF;

    -- Verify target profile exists
    SELECT registration_status INTO v_current_status
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Profile not found for ID %', p_user_id;
    END IF;

    -- Set local token authorizing the profile trigger
    PERFORM set_config('zenway.trusted_provisioning', 'true', true);

    -- Update registration status to approved
    UPDATE public.profiles
    SET registration_status = 'approved',
        registration_rejection_reason = NULL,
        registration_reviewed_at = now(),
        registration_reviewed_by = auth.uid(),
        updated_at = now()
    WHERE id = p_user_id;

    -- Lookup email for audit
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = p_user_id;

    -- Record immutable audit log
    PERFORM public.create_audit_log(
        auth.uid(),
        'REGISTRATION_APPROVED',
        'profiles',
        p_user_id,
        jsonb_build_object(
            'approved_user_id', p_user_id,
            'approved_email', v_user_email,
            'approved_by', auth.uid()
        )
    );

    -- Notify the student
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
        p_user_id,
        'verification_approved',
        'Registration Approved!',
        'Your ZENWAY registration has been approved by campus administration. You can now log in and complete student ID verification.',
        jsonb_build_object('profile_id', p_user_id)
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. Administrative RPC: Reject Registration
CREATE OR REPLACE FUNCTION public.reject_registration(p_user_id uuid, p_rejection_reason text)
RETURNS boolean AS $$
DECLARE
    v_current_status public.registration_approval_status;
    v_user_email text;
    v_reason text;
BEGIN
    -- Verify administrator authorization
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Administrator privileges required to reject registrations.';
    END IF;

    v_reason := NULLIF(trim(p_rejection_reason), '');
    IF v_reason IS NULL THEN
        RAISE EXCEPTION 'A rejection reason is required.';
    END IF;

    -- Verify target profile exists
    SELECT registration_status INTO v_current_status
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Profile not found for ID %', p_user_id;
    END IF;

    -- Set local token authorizing the profile trigger
    PERFORM set_config('zenway.trusted_provisioning', 'true', true);

    -- Update registration status to rejected
    UPDATE public.profiles
    SET registration_status = 'rejected',
        registration_rejection_reason = v_reason,
        registration_reviewed_at = now(),
        registration_reviewed_by = auth.uid(),
        updated_at = now()
    WHERE id = p_user_id;

    -- Lookup email for audit
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = p_user_id;

    -- Record immutable audit log
    PERFORM public.create_audit_log(
        auth.uid(),
        'REGISTRATION_REJECTED',
        'profiles',
        p_user_id,
        jsonb_build_object(
            'rejected_user_id', p_user_id,
            'rejected_email', v_user_email,
            'rejection_reason', v_reason,
            'rejected_by', auth.uid()
        )
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 7. Administrative RPC: Fetch Registrations with User Emails
-- Protected: Callable only by verified administrators
CREATE OR REPLACE FUNCTION public.get_admin_registrations(p_status text DEFAULT NULL)
RETURNS TABLE (
    id uuid,
    full_name text,
    email text,
    phone_number text,
    university_name text,
    role public.user_role,
    verification_status public.account_verification_status,
    registration_status public.registration_approval_status,
    registration_rejection_reason text,
    created_at timestamptz,
    registration_reviewed_at timestamptz,
    registration_reviewed_by uuid
) AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Administrator privileges required.';
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        u.email::text,
        p.phone_number,
        p.university_name,
        p.role,
        p.verification_status,
        p.registration_status,
        p.registration_rejection_reason,
        p.created_at,
        p.registration_reviewed_at,
        p.registration_reviewed_by
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE (p_status IS NULL OR p.registration_status::text = p_status)
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke execute from PUBLIC, anon; grant to authenticated (enforced by is_admin check) and service_role
REVOKE EXECUTE ON FUNCTION public.approve_registration(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_registration(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reject_registration(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_registration(uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_admin_registrations(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_registrations(text) TO authenticated, service_role;

-- ============================================================================
-- 8. Enhance is_verified_student() Authorization Helper
-- Requires both account_verification_status = 'verified' AND registration_approval_status = 'approved'
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_verified_student()
RETURNS boolean AS $$
DECLARE
    v_ver_status public.account_verification_status;
    v_reg_status public.registration_approval_status;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    SELECT verification_status, registration_status 
    INTO v_ver_status, v_reg_status
    FROM public.profiles
    WHERE id = auth.uid();

    RETURN COALESCE(v_ver_status = 'verified' AND v_reg_status = 'approved', false);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- 9. Protect Student Verification Submissions (Enforce Stage Separation)
-- Unapproved registrations are strictly forbidden from submitting ID verification
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_verification_submission()
RETURNS trigger AS $$
DECLARE
    v_reg_status public.registration_approval_status;
BEGIN
    -- On INSERT: Students submit as 'pending'; wipe any forged review metadata
    IF TG_OP = 'INSERT' THEN
        IF NOT public.is_admin() THEN
            -- Verify that the applicant has an approved registration standing
            SELECT registration_status INTO v_reg_status
            FROM public.profiles
            WHERE id = NEW.user_id;

            IF v_reg_status IS DISTINCT FROM 'approved' THEN
                RAISE EXCEPTION 'Access Denied: Account registration must be approved by campus administration before submitting student ID verification.';
            END IF;

            NEW.status := 'pending';
            NEW.reviewed_by := NULL;
            NEW.reviewed_at := NULL;
            NEW.rejection_reason := NULL;
        END IF;

        -- Update user profile standing to pending
        UPDATE public.profiles
        SET verification_status = 'pending'
        WHERE id = NEW.user_id AND verification_status != 'verified';

        -- Create notification confirming submission
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            NEW.user_id,
            'verification_submitted',
            'Verification Submitted',
            'Your student credentials have been received and are pending campus administrator review.',
            jsonb_build_object('verification_id', NEW.id)
        );
    END IF;

    -- On UPDATE: Only administrators can alter status, review timestamps, or rejection reasons
    IF TG_OP = 'UPDATE' THEN
        IF (NEW.status IS DISTINCT FROM OLD.status) OR
           (NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by) OR
           (NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at) OR
           (NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason) THEN
            IF NOT public.is_admin() THEN
                RAISE EXCEPTION 'Access Denied: Only administrators can review or update verification submissions.';
            END IF;
        END IF;

        -- If status transitioned to approved
        IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
            NEW.reviewed_by := auth.uid();
            NEW.reviewed_at := now();
            
            UPDATE public.profiles 
            SET verification_status = 'verified'
            WHERE id = NEW.user_id;

            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (
                NEW.user_id,
                'verification_approved',
                'Student Verification Approved!',
                'Your student ID has been approved. You now have full access to RENT, RIDE, and CARRY on ZENWAY.',
                jsonb_build_object('verification_id', NEW.id)
            );

            PERFORM public.create_audit_log(
                auth.uid(),
                'VERIFICATION_APPROVED',
                'student_verifications',
                NEW.id,
                jsonb_build_object('user_id', NEW.user_id, 'student_id_number', NEW.student_id_number)
            );

        -- If status transitioned to rejected
        ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
            NEW.reviewed_by := auth.uid();
            NEW.reviewed_at := now();

            UPDATE public.profiles 
            SET verification_status = 'unverified'
            WHERE id = NEW.user_id;

            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (
                NEW.user_id,
                'verification_rejected',
                'Verification Needs Attention',
                COALESCE(NEW.rejection_reason, 'Your verification could not be approved. Please review requirements and resubmit.'),
                jsonb_build_object('verification_id', NEW.id, 'reason', NEW.rejection_reason)
            );

            PERFORM public.create_audit_log(
                auth.uid(),
                'VERIFICATION_REJECTED',
                'student_verifications',
                NEW.id,
                jsonb_build_object('user_id', NEW.user_id, 'reason', NEW.rejection_reason)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- 10. Update RLS Policy on student_verifications
-- Restricts insertion to users who are approved or administrator
-- ============================================================================
DROP POLICY IF EXISTS "student_verifications_insert" ON public.student_verifications;
CREATE POLICY "student_verifications_insert" ON public.student_verifications
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (registration_status = 'approved' OR role = 'admin')
        )
    );

-- ============================================================================
-- 11. Update Storage RLS Policy on student-ids Bucket
-- Prevents unapproved users from uploading ID document files directly to storage
-- ============================================================================
DROP POLICY IF EXISTS "student_ids_upload_owner" ON storage.objects;
CREATE POLICY "student_ids_upload_owner" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'student-ids' 
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (registration_status = 'approved' OR role = 'admin')
        )
    );

-- ============================================================================
-- 12. Update Admin Provisioning Procedures to Approve Registration Status
-- ============================================================================
CREATE OR REPLACE FUNCTION public.provision_initial_admin(p_user_email text)
RETURNS boolean AS $$
DECLARE
    v_target_id uuid;
    v_admin_count integer;
    v_jwt_role text;
BEGIN
    v_jwt_role := COALESCE(
        auth.jwt() ->> 'role',
        (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
        ''
    );
    IF v_jwt_role != 'service_role' 
       AND current_user != 'service_role' 
       AND session_user != 'service_role' 
       AND session_user != 'postgres' THEN
        RAISE EXCEPTION 'Access Denied: Initial administrator provisioning can only be performed via trusted service_role execution.';
    END IF;

    LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;

    SELECT count(*) INTO v_admin_count
    FROM public.profiles
    WHERE role = 'admin';

    IF v_admin_count > 0 THEN
        RAISE EXCEPTION 'Access Denied: An administrator already exists. Use promote_student_to_admin for subsequent administrative appointments.';
    END IF;

    SELECT id INTO v_target_id
    FROM auth.users
    WHERE email = p_user_email;

    IF v_target_id IS NULL THEN
        RAISE EXCEPTION 'User not found: No registered user found with email %.', p_user_email;
    END IF;

    PERFORM set_config('zenway.trusted_provisioning', 'true', true);

    UPDATE public.profiles
    SET role = 'admin',
        verification_status = 'verified',
        registration_status = 'approved',
        updated_at = now()
    WHERE id = v_target_id;

    PERFORM public.create_audit_log(
        v_target_id,
        'INITIAL_ADMIN_PROVISIONED',
        'profiles',
        v_target_id,
        jsonb_build_object('email', p_user_email, 'mode', 'service_role_bootstrap')
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.provision_initial_admin(text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.provision_initial_admin(text) TO service_role;

CREATE OR REPLACE FUNCTION public.promote_student_to_admin(p_user_email text)
RETURNS boolean AS $$
DECLARE
    v_target_id uuid;
    v_jwt_role text;
BEGIN
    v_jwt_role := COALESCE(
        auth.jwt() ->> 'role',
        (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
        ''
    );

    IF NOT public.is_admin() 
       AND v_jwt_role != 'service_role' 
       AND current_user != 'service_role' 
       AND session_user != 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Only existing administrators can promote users to administrator.';
    END IF;

    SELECT id INTO v_target_id
    FROM auth.users
    WHERE email = p_user_email;

    IF v_target_id IS NULL THEN
        RAISE EXCEPTION 'User not found: No registered user found with email %.', p_user_email;
    END IF;

    PERFORM set_config('zenway.trusted_provisioning', 'true', true);

    UPDATE public.profiles
    SET role = 'admin',
        verification_status = 'verified',
        registration_status = 'approved',
        updated_at = now()
    WHERE id = v_target_id;

    PERFORM public.create_audit_log(
        auth.uid(),
        'SUBSEQUENT_ADMIN_PROMOTED',
        'profiles',
        v_target_id,
        jsonb_build_object('promoted_email', p_user_email, 'promoted_by', auth.uid())
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.promote_student_to_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_student_to_admin(text) TO authenticated, service_role;

-- ============================================================================
-- 13. Supabase Custom Access Token Hook
-- Augments JWT claims with user_role and registration_status.
-- Complies strictly with GoTrue's contract: preserves core system claims (role = 'authenticated'),
-- safely handles missing or malformed inputs without raising unhandled exceptions,
-- and allows backend RLS and frontend auth guards to govern session validity.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    claims jsonb;
    v_user_id uuid;
    v_role public.user_role;
    v_reg_status public.registration_approval_status;
BEGIN
    -- Safely extract claims
    claims := event->'claims';
    IF claims IS NULL THEN
        RETURN event;
    END IF;

    -- Safely extract user_id from either top-level event or claims.sub
    BEGIN
        v_user_id := NULLIF(COALESCE(event->>'user_id', claims->>'sub'), '')::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN event;
    END;

    IF v_user_id IS NULL THEN
        RETURN event;
    END IF;

    -- Safely query profile standing with fallback
    BEGIN
        SELECT role, registration_status
        INTO v_role, v_reg_status
        FROM public.profiles
        WHERE id = v_user_id;
    EXCEPTION WHEN OTHERS THEN
        v_role := 'student';
        v_reg_status := 'pending';
    END;

    -- Default safely to unapproved student if profile not yet established
    IF v_role IS NULL THEN
        v_role := 'student';
        v_reg_status := 'pending';
    END IF;

    -- Inject verified application claims into the JWT payload
    -- Core claims (aud, sub, exp, iat, role = 'authenticated') remain untouched for GoTrue validator compliance
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role::text));
    claims := jsonb_set(claims, '{registration_status}', to_jsonb(COALESCE(v_reg_status::text, 'pending')));
    event := jsonb_set(event, '{claims}', claims);

    RETURN event;
END;
$$;

-- Ensure function ownership is postgres (superuser with bypassrls)
ALTER FUNCTION public.custom_access_token_hook(jsonb) OWNER TO postgres;

-- Grant schema usage, function execution, table read, and type access to supabase_auth_admin
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
        GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
        GRANT SELECT ON public.profiles TO supabase_auth_admin;
        GRANT USAGE ON ALL TYPES IN SCHEMA public TO supabase_auth_admin;
    END IF;
END $$;

-- Revoke execution from untrusted public roles to protect the hook
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;



