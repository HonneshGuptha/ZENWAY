-- Migration: 20261110000002_profiles_and_base_auth.sql
-- Description: Creates profiles table, base timestamp triggers, auth trigger, and role/verification protection

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL CHECK (length(trim(full_name)) >= 2),
    phone_number text NULL,
    university_name text NULL,
    role user_role NOT NULL DEFAULT 'student',
    verification_status account_verification_status NOT NULL DEFAULT 'unverified',
    avatar_url text NULL,
    bio text NULL CHECK (bio IS NULL OR length(bio) <= 500),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for administrative and standing filters
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON public.profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 2. Shared updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Authorization helper functions (SECURITY DEFINER with safe search_path to prevent RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
DECLARE
    v_role public.user_role;
    v_jwt_role text;
BEGIN
    -- Trusted service_role execution is unconditionally authorized as admin
    -- Supabase passes service_role identity in request JWT claims
    v_jwt_role := COALESCE(
        auth.jwt() ->> 'role',
        (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
        ''
    );
    IF v_jwt_role = 'service_role' OR current_user = 'service_role' OR session_user = 'service_role' THEN
        RETURN true;
    END IF;

    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();

    RETURN COALESCE(v_role = 'admin', false);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_verified_student()
RETURNS boolean AS $$
DECLARE
    v_status public.account_verification_status;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    SELECT verification_status INTO v_status
    FROM public.profiles
    WHERE id = auth.uid();

    RETURN COALESCE(v_status = 'verified', false);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_verified_student() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_verified_student() TO authenticated, service_role;

-- 4. Automatic profile initialization for new Supabase auth users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_full_name text;
BEGIN
    v_full_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(trim(split_part(NEW.email, '@', 1)), ''),
        'Student'
    );

    IF length(v_full_name) < 2 THEN
        v_full_name := v_full_name || ' Student';
    END IF;

    INSERT INTO public.profiles (
        id,
        full_name,
        role,
        verification_status
    ) VALUES (
        NEW.id,
        v_full_name,
        'student',
        'unverified'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Anti-Escalation: Prevent users from self-promoting role or verification_status
-- Zero-admin loophole completely eliminated: No user can self-promote via direct UPDATE under any circumstance.
-- Trusted provisioning proceeds exclusively through restricted procedures setting transaction-scoped token.
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS trigger AS $$
DECLARE
    v_is_trusted_provisioning boolean;
BEGIN
    -- Check if local transaction is authorized by restricted administrative provisioning procedures
    v_is_trusted_provisioning := (current_setting('zenway.trusted_provisioning', true) = 'true');

    -- Guard Role modifications: Strictly forbidden to direct client updates
    IF (NEW.role IS DISTINCT FROM OLD.role) THEN
        IF NOT v_is_trusted_provisioning AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Access Denied: Only administrators or trusted provisioning can modify user roles.';
        END IF;
    END IF;

    -- Guard Verification Status modifications
    IF (NEW.verification_status IS DISTINCT FROM OLD.verification_status) THEN
        IF v_is_trusted_provisioning THEN
            -- Authorized via trusted administrative procedure
            NULL;
        ELSIF NEW.verification_status IN ('verified', 'suspended') OR (auth.uid() IS NOT NULL AND NEW.id != auth.uid()) THEN
            -- Promoting to verified or suspended, or modifying other users, is strictly administrator-only
            IF NOT public.is_admin() THEN
                RAISE EXCEPTION 'Access Denied: Only administrators can verify or suspend accounts.';
            END IF;
        ELSIF NEW.verification_status = 'pending' THEN
            -- Allow legitimate student transition from 'unverified' to 'pending' upon document submission
            IF OLD.verification_status != 'unverified' AND NOT public.is_admin() THEN
                RAISE EXCEPTION 'Access Denied: Invalid verification status transition.';
            END IF;
        ELSIF NEW.verification_status = 'unverified' THEN
            -- Reverting standing requires administrative authorization
            IF NOT public.is_admin() THEN
                RAISE EXCEPTION 'Access Denied: Only administrators can reset verification standing.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_sensitive_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_columns();
