-- Migration: 20261110000013_auth_hook_remediation.sql
-- Description: Remediates custom_access_token_hook permissions, profile RLS access, and restores server-side rejection for pending/rejected accounts.

-- ============================================================================
-- 1. Profile RLS Policy and Column Permissions for supabase_auth_admin
-- Resolves the root cause where supabase_auth_admin returned 0 rows due to RLS,
-- while strictly preserving column privacy (no phone numbers or bio granted).
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        -- Allow supabase_auth_admin to read status columns needed for claims evaluation
        GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
        GRANT SELECT (id, role, registration_status, registration_rejection_reason) ON public.profiles TO supabase_auth_admin;
        GRANT USAGE ON TYPE public.user_role TO supabase_auth_admin;
        GRANT USAGE ON TYPE public.registration_approval_status TO supabase_auth_admin;
    END IF;
END $$;

-- Explicit RLS policy permitting supabase_auth_admin to read profile status
DROP POLICY IF EXISTS "profiles_select_auth_admin" ON public.profiles;
CREATE POLICY "profiles_select_auth_admin" ON public.profiles
    FOR SELECT TO supabase_auth_admin
    USING (true);

-- ============================================================================
-- 2. Remediated Custom Access Token Hook
-- - Rejection restored on password login and token refresh for pending/rejected accounts.
-- - Approved users and administrators authenticate cleanly.
-- - Email confirmation and password recovery callbacks are preserved without exception.
-- - Defensively handles event structure, NULLs, and empty UUID strings.
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
    v_rejection_reason text;
    v_auth_method text;
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

    v_auth_method := COALESCE(event->>'authentication_method', '');

    -- Query profile standing (accessible via supabase_auth_admin policy and SECURITY DEFINER)
    SELECT role, registration_status, registration_rejection_reason
    INTO v_role, v_reg_status, v_rejection_reason
    FROM public.profiles
    WHERE id = v_user_id;

    -- If profile does not exist yet (e.g. initial signup callback), default safely
    IF v_role IS NULL THEN
        v_role := 'student';
        v_reg_status := 'pending';
    END IF;

    -- 1. Administrator bypass: always grant full admin claims
    IF v_role = 'admin' THEN
        claims := jsonb_set(claims, '{user_role}', to_jsonb('admin'::text));
        claims := jsonb_set(claims, '{registration_status}', to_jsonb('approved'::text));
        event := jsonb_set(event, '{claims}', claims);
        RETURN event;
    END IF;

    -- 2. Approved student: permit normal session
    IF v_reg_status = 'approved' THEN
        claims := jsonb_set(claims, '{user_role}', to_jsonb('student'::text));
        claims := jsonb_set(claims, '{registration_status}', to_jsonb('approved'::text));
        event := jsonb_set(event, '{claims}', claims);
        RETURN event;
    END IF;

    -- 3. Server-Side Rejection: Block interactive password login and token refresh for pending/rejected users
    IF v_auth_method IN ('password', 'token_refresh') THEN
        IF v_reg_status = 'rejected' THEN
            RAISE EXCEPTION 'REGISTRATION_REJECTED: %', COALESCE(v_rejection_reason, 'Your registration was rejected by campus administration.');
        ELSE
            RAISE EXCEPTION 'REGISTRATION_PENDING: Your registration has been submitted and is pending administrator review and approval.';
        END IF;
    END IF;

    -- 4. Preserve non-password lifecycle flows (email confirmation, recovery, signup exchange)
    -- Claims are enriched with standing without mutating core system claims (role remains 'authenticated')
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role::text));
    claims := jsonb_set(claims, '{registration_status}', to_jsonb(COALESCE(v_reg_status::text, 'pending')));
    event := jsonb_set(event, '{claims}', claims);

    RETURN event;
END;
$$;

-- Ensure function ownership is postgres (superuser with bypassrls)
ALTER FUNCTION public.custom_access_token_hook(jsonb) OWNER TO postgres;

-- Grant execution to supabase_auth_admin and revoke from untrusted public roles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
    END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
