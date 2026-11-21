-- Migration: 20261110000014_admin_portal_and_access_key.sql
-- Description: Dedicated admin portal infrastructure, access key authentication, student ID review RPCs, user moderation, and platform statistics.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET search_path TO public, extensions;

-- ============================================================================
-- 1. Admin Access Key Configuration (Singleton Secure Table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_access_config (
    id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
    access_key_hash text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Seed initial access key '2077' using crypt with blowfish salt
INSERT INTO public.admin_access_config (id, access_key_hash)
VALUES (true, extensions.crypt('2077', extensions.gen_salt('bf')))
ON CONFLICT (id) DO NOTHING;

-- Restrict direct access from client roles
REVOKE ALL ON public.admin_access_config FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_access_config TO service_role;

-- ============================================================================
-- 2. Verify Admin Access Key RPC
-- Validates: 1) Caller is an authorized administrator, 2) Provided key matches hash
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verify_admin_access_key(p_key text)
RETURNS boolean AS $$
DECLARE
    v_stored_hash text;
BEGIN
    -- Verify caller has administrator standing
    IF NOT public.is_admin() THEN
        RETURN false;
    END IF;

    IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
        RETURN false;
    END IF;

    SELECT access_key_hash INTO v_stored_hash
    FROM public.admin_access_config
    WHERE id = true;

    IF v_stored_hash IS NULL THEN
        RETURN false;
    END IF;

    RETURN (v_stored_hash = extensions.crypt(trim(p_key), v_stored_hash));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE EXECUTE ON FUNCTION public.verify_admin_access_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_admin_access_key(text) TO authenticated, service_role;

-- ============================================================================
-- 3. Update Admin Access Key RPC
-- Allows existing authenticated administrators to change the access key
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_admin_access_key(p_old_key text, p_new_key text)
RETURNS boolean AS $$
DECLARE
    v_stored_hash text;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Administrator privileges required.';
    END IF;

    IF length(trim(p_new_key)) < 4 THEN
        RAISE EXCEPTION 'Invalid Key: New admin access key must be at least 4 characters long.';
    END IF;

    SELECT access_key_hash INTO v_stored_hash
    FROM public.admin_access_config
    WHERE id = true;

    IF v_stored_hash IS DISTINCT FROM extensions.crypt(trim(p_old_key), v_stored_hash) THEN
        RAISE EXCEPTION 'Authentication Failed: Current access key is incorrect.';
    END IF;

    UPDATE public.admin_access_config
    SET access_key_hash = extensions.crypt(trim(p_new_key), extensions.gen_salt('bf')),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = true;

    PERFORM public.create_audit_log(
        auth.uid(),
        'ADMIN_ACCESS_KEY_CHANGED',
        'admin_access_config',
        gen_random_uuid(),
        jsonb_build_object('changed_by', auth.uid())
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE EXECUTE ON FUNCTION public.update_admin_access_key(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_admin_access_key(text, text) TO authenticated, service_role;

-- ============================================================================
-- 4. Student ID Verification Management RPCs
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_verifications(p_status text DEFAULT NULL)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    student_id_number text,
    id_document_path text,
    document_type public.document_type,
    status public.verification_submission_status,
    rejection_reason text,
    created_at timestamptz,
    reviewed_at timestamptz,
    reviewed_by uuid,
    full_name text,
    email text,
    university_name text
) AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Administrator privileges required.';
    END IF;

    RETURN QUERY
    SELECT 
        sv.id,
        sv.user_id,
        sv.student_id_number,
        sv.id_document_path,
        sv.document_type,
        sv.status,
        sv.rejection_reason,
        sv.created_at,
        sv.reviewed_at,
        sv.reviewed_by,
        p.full_name,
        u.email::text,
        p.university_name
    FROM public.student_verifications sv
    JOIN public.profiles p ON p.id = sv.user_id
    LEFT JOIN auth.users u ON u.id = sv.user_id
    WHERE (p_status IS NULL OR sv.status::text = p_status)
    ORDER BY sv.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_admin_verifications(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_verifications(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.review_student_verification(
    p_verification_id uuid,
    p_decision text,
    p_reason text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
    v_target_user_id uuid;
    v_current_status public.verification_submission_status;
    v_clean_reason text;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Administrator privileges required.';
    END IF;

    IF p_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid Decision: Decision must be approved or rejected.';
    END IF;

    SELECT user_id, status INTO v_target_user_id, v_current_status
    FROM public.student_verifications
    WHERE id = p_verification_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Verification record not found.';
    END IF;

    IF p_decision = 'rejected' THEN
        v_clean_reason := NULLIF(trim(p_reason), '');
        IF v_clean_reason IS NULL THEN
            RAISE EXCEPTION 'A rejection reason is required when rejecting verification.';
        END IF;
    END IF;

    -- Update verification submission (triggers protect_verification_submission automatically)
    UPDATE public.student_verifications
    SET status = p_decision::public.verification_submission_status,
        rejection_reason = CASE WHEN p_decision = 'rejected' THEN v_clean_reason ELSE NULL END,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    WHERE id = p_verification_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE EXECUTE ON FUNCTION public.review_student_verification(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_student_verification(uuid, text, text) TO authenticated, service_role;

-- ============================================================================
-- 5. User Management & Suspension RPCs
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE (
    id uuid,
    full_name text,
    email text,
    university_name text,
    role public.user_role,
    verification_status public.account_verification_status,
    registration_status public.registration_approval_status,
    created_at timestamptz
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
        p.university_name,
        p.role,
        p.verification_status,
        p.registration_status,
        p.created_at
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_admin_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.toggle_user_suspension(
    p_user_id uuid,
    p_suspend boolean,
    p_reason text DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Administrator privileges required.';
    END IF;

    -- Authorize profile trigger for administrative status change
    PERFORM set_config('zenway.trusted_provisioning', 'true', true);

    IF p_suspend THEN
        UPDATE public.profiles
        SET verification_status = 'suspended',
            updated_at = now()
        WHERE id = p_user_id;

        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            p_user_id,
            'verification_rejected',
            'Account Suspended',
            COALESCE(p_reason, 'Your account privileges have been suspended by campus administration.'),
            jsonb_build_object('reason', p_reason)
        );

        PERFORM public.create_audit_log(
            auth.uid(),
            'USER_SUSPENDED',
            'profiles',
            p_user_id,
            jsonb_build_object('reason', p_reason)
        );
    ELSE
        UPDATE public.profiles
        SET verification_status = 'verified',
            updated_at = now()
        WHERE id = p_user_id;

        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            p_user_id,
            'verification_approved',
            'Account Reinstated',
            'Your account privileges have been reinstated by campus administration.',
            jsonb_build_object('reinstated_by', auth.uid())
        );

        PERFORM public.create_audit_log(
            auth.uid(),
            'USER_REINSTATED',
            'profiles',
            p_user_id,
            jsonb_build_object('reinstated_by', auth.uid())
        );
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE EXECUTE ON FUNCTION public.toggle_user_suspension(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_user_suspension(uuid, boolean, text) TO authenticated, service_role;

-- ============================================================================
-- 6. Content Moderation & Platform Statistics RPCs
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_moderate_listing(
    p_entity_type text,
    p_entity_id uuid,
    p_action text,
    p_reason text DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Administrator privileges required.';
    END IF;

    IF p_entity_type = 'vehicle' THEN
        UPDATE public.vehicles
        SET status = CASE WHEN p_action = 'archive' THEN 'archived'::public.listing_status ELSE 'paused'::public.listing_status END,
            updated_at = now()
        WHERE id = p_entity_id;

    ELSIF p_entity_type = 'ride' THEN
        UPDATE public.rides
        SET status = 'cancelled',
            updated_at = now()
        WHERE id = p_entity_id;

    ELSIF p_entity_type = 'carry' THEN
        UPDATE public.carry_requests
        SET status = 'cancelled',
            updated_at = now()
        WHERE id = p_entity_id;

    ELSE
        RAISE EXCEPTION 'Invalid entity type for moderation: %', p_entity_type;
    END IF;

    PERFORM public.create_audit_log(
        auth.uid(),
        'LISTING_MODERATED',
        p_entity_type,
        p_entity_id,
        jsonb_build_object('action', p_action, 'reason', p_reason)
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE EXECUTE ON FUNCTION public.admin_moderate_listing(text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_listing(text, uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_platform_statistics()
RETURNS jsonb AS $$
DECLARE
    v_total_users integer;
    v_verified_students integer;
    v_pending_registrations integer;
    v_pending_verifications integer;
    v_available_vehicles integer;
    v_active_rentals integer;
    v_open_rides integer;
    v_open_carries integer;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Administrator privileges required.';
    END IF;

    SELECT count(*) INTO v_total_users FROM public.profiles;
    SELECT count(*) INTO v_verified_students FROM public.profiles WHERE verification_status = 'verified';
    SELECT count(*) INTO v_pending_registrations FROM public.profiles WHERE registration_status = 'pending';
    SELECT count(*) INTO v_pending_verifications FROM public.student_verifications WHERE status = 'pending';
    SELECT count(*) INTO v_available_vehicles FROM public.vehicles WHERE status = 'available';
    SELECT count(*) INTO v_active_rentals FROM public.rental_requests WHERE status IN ('accepted', 'active');
    SELECT count(*) INTO v_open_rides FROM public.rides WHERE status = 'scheduled' AND available_seats > 0;
    SELECT count(*) INTO v_open_carries FROM public.carry_requests WHERE status = 'open';

    RETURN jsonb_build_object(
        'total_users', v_total_users,
        'verified_students', v_verified_students,
        'pending_registrations', v_pending_registrations,
        'pending_verifications', v_pending_verifications,
        'available_vehicles', v_available_vehicles,
        'active_rentals', v_active_rentals,
        'open_rides', v_open_rides,
        'open_carries', v_open_carries
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_platform_statistics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_statistics() TO authenticated, service_role;
