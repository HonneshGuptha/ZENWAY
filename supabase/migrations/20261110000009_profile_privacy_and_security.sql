-- Migration: 20261110000009_profile_privacy_and_security.sql
-- Description: Creates public_profiles secure view, revokes table-level updates, enforces column-level privileges, and establishes safe admin provisioning

-- 1. Secure Phone Number Disclosure: public_profiles View
-- Protects phone numbers from mass scraping while exposing them only to confirmed exchange peers
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
    p.id,
    p.full_name,
    p.university_name,
    p.avatar_url,
    p.bio,
    p.role,
    p.verification_status,
    p.created_at,
    CASE 
        -- Owner or administrator always views their own phone number
        WHEN auth.uid() = p.id THEN p.phone_number
        WHEN public.is_admin() THEN p.phone_number

        -- RENT: Counterpart in an accepted or active rental
        WHEN EXISTS (
            SELECT 1 FROM public.rental_requests rr 
            WHERE ((rr.renter_id = auth.uid() AND rr.owner_id = p.id)
                OR (rr.owner_id = auth.uid() AND rr.renter_id = p.id))
              AND rr.status IN ('accepted', 'active')
        ) THEN p.phone_number

        -- RIDE: Driver or confirmed passenger in an accepted ride
        WHEN EXISTS (
            SELECT 1 FROM public.ride_requests rq
            JOIN public.rides r ON r.id = rq.ride_id
            WHERE ((rq.passenger_id = auth.uid() AND r.driver_id = p.id)
                OR (r.driver_id = auth.uid() AND rq.passenger_id = p.id))
              AND rq.status = 'accepted'
        ) THEN p.phone_number

        -- CARRY: Requester or assigned carrier in an accepted or in_transit carry
        WHEN EXISTS (
            SELECT 1 FROM public.carry_requests cr
            WHERE ((cr.requester_id = auth.uid() AND cr.assigned_carrier_id = p.id)
                OR (cr.assigned_carrier_id = auth.uid() AND cr.requester_id = p.id))
              AND cr.status IN ('accepted', 'in_transit')
        ) THEN p.phone_number

        ELSE NULL
    END AS phone_number
FROM public.profiles p;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- ============================================================================
-- 2. Explicit Table-Level Privilege Revocations & Column-Level Grants
-- In PostgreSQL, column-level REVOKEs do NOT override broad table-level UPDATE grants.
-- We explicitly revoke table-level UPDATE from authenticated, anon, and PUBLIC across all
-- tables before granting only the specific columns needed for legitimate client operations.
-- ============================================================================

-- A. PROFILES
-- Revoke direct phone_number SELECT; grant public attributes
REVOKE SELECT ON public.profiles FROM authenticated, anon, PUBLIC;
GRANT SELECT (id, full_name, university_name, avatar_url, bio, role, verification_status, created_at, updated_at) ON public.profiles TO authenticated, anon;

-- Explicitly revoke table-level UPDATE and grant only editable student bio/contact fields
-- Protected: role, verification_status, id, created_at
REVOKE UPDATE ON public.profiles FROM authenticated, anon, PUBLIC;
GRANT UPDATE (full_name, phone_number, university_name, avatar_url, bio, updated_at) ON public.profiles TO authenticated;

-- B. VEHICLES
-- Explicitly revoke table-level UPDATE and grant listing parameters
-- Protected: id, owner_id, created_at
REVOKE UPDATE ON public.vehicles FROM authenticated, anon, PUBLIC;
GRANT UPDATE (type, title, description, brand_model, hourly_rate, daily_rate, deposit_amount, pickup_location, latitude, longitude, status, updated_at) ON public.vehicles TO authenticated;

-- C. RENTAL_REQUESTS
-- Explicitly revoke table-level UPDATE and grant only lifecycle and notes fields
-- Protected: id, vehicle_id, renter_id, owner_id, start_time, end_time, total_price, deposit_amount, created_at
REVOKE UPDATE ON public.rental_requests FROM authenticated, anon, PUBLIC;
GRANT UPDATE (status, renter_notes, owner_notes, updated_at) ON public.rental_requests TO authenticated;

-- D. RIDES
-- Explicitly revoke table-level UPDATE and grant ride metadata
-- Protected: id, driver_id, available_seats, created_at
REVOKE UPDATE ON public.rides FROM authenticated, anon, PUBLIC;
GRANT UPDATE (origin_name, origin_lat, origin_lng, destination_name, destination_lat, destination_lng, departure_time, total_seats, price_per_seat, notes, status, updated_at) ON public.rides TO authenticated;

-- E. RIDE_REQUESTS
-- Explicitly revoke table-level UPDATE and grant only passenger status/note fields
-- Protected: id, ride_id, passenger_id, seats_requested, total_price, created_at
REVOKE UPDATE ON public.ride_requests FROM authenticated, anon, PUBLIC;
GRANT UPDATE (status, pickup_note, updated_at) ON public.ride_requests TO authenticated;

-- F. CARRY_REQUESTS
-- Explicitly revoke table-level UPDATE and grant package specifications & delivery tracking
-- Protected: id, requester_id, assigned_carrier_id, accepted_offer_id, created_at
REVOKE UPDATE ON public.carry_requests FROM authenticated, anon, PUBLIC;
GRANT UPDATE (item_title, item_description, item_size, weight_kg, pickup_location, pickup_lat, pickup_lng, delivery_location, delivery_lat, delivery_lng, needed_by, reward_amount, status, pickup_photo_path, delivery_photo_path, special_instructions, updated_at) ON public.carry_requests TO authenticated;

-- G. CARRY_OFFERS
-- Explicitly revoke table-level UPDATE and grant proposal fields
-- Protected: id, request_id, carrier_id, created_at
REVOKE UPDATE ON public.carry_offers FROM authenticated, anon, PUBLIC;
GRANT UPDATE (status, message, proposed_delivery_time, updated_at) ON public.carry_offers TO authenticated;

-- H. VEHICLE_IMAGES
-- Explicitly revoke table-level UPDATE and grant gallery ordering attributes
-- Protected: id, vehicle_id, created_at
REVOKE UPDATE ON public.vehicle_images FROM authenticated, anon, PUBLIC;
GRANT UPDATE (image_path, display_order, is_primary) ON public.vehicle_images TO authenticated;

-- I. NOTIFICATIONS
-- Explicitly revoke table-level INSERT, UPDATE, DELETE; grant only is_read update
-- Protected: id, user_id, type, title, message, data, created_at
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM authenticated, anon, PUBLIC;
GRANT SELECT, UPDATE (is_read) ON public.notifications TO authenticated;

-- J. STUDENT_VERIFICATIONS
-- Explicitly revoke table-level UPDATE; grant review fields to authenticated (governed by is_admin RLS)
-- Protected: id, user_id, student_id_number, id_document_path, document_type, created_at
REVOKE UPDATE ON public.student_verifications FROM authenticated, anon, PUBLIC;
GRANT UPDATE (status, rejection_reason, reviewed_by, reviewed_at, updated_at) ON public.student_verifications TO authenticated;

-- K. REVIEWS
-- Explicitly revoke table-level UPDATE; reviews are strictly immutable
REVOKE UPDATE ON public.reviews FROM authenticated, anon, PUBLIC;

-- L. AUDIT_LOGS
-- Explicitly revoke all client mutation privileges
REVOKE ALL ON public.audit_logs FROM authenticated, anon, PUBLIC;
GRANT SELECT ON public.audit_logs TO authenticated;

-- ============================================================================
-- 3. Dedicated Administrative Provisioning Procedures
-- Separates initial bootstrap provisioning from subsequent administrative promotions.
-- ============================================================================

-- Procedure 1: First-Administrator Bootstrap Provisioning
-- Callable EXCLUSIVELY by service_role (backend script / server-side migration runner).
-- Normal authenticated users have zero execution permission.
CREATE OR REPLACE FUNCTION public.provision_initial_admin(p_user_email text)
RETURNS boolean AS $$
DECLARE
    v_target_id uuid;
    v_admin_count integer;
    v_jwt_role text;
BEGIN
    -- Verify trusted execution context (Supabase service_role JWT or superuser/service connection)
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

    -- Prevent concurrent bootstrap race conditions with exclusive table lock
    LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;

    -- Verify that zero administrators currently exist
    SELECT count(*) INTO v_admin_count
    FROM public.profiles
    WHERE role = 'admin';

    IF v_admin_count > 0 THEN
        RAISE EXCEPTION 'Access Denied: An administrator already exists. Use promote_student_to_admin for subsequent administrative appointments.';
    END IF;

    -- Lookup user id from auth.users
    SELECT id INTO v_target_id
    FROM auth.users
    WHERE email = p_user_email;

    IF v_target_id IS NULL THEN
        RAISE EXCEPTION 'User not found: No registered user found with email %.', p_user_email;
    END IF;

    -- Set local transaction token authorizing the profile trigger
    PERFORM set_config('zenway.trusted_provisioning', 'true', true);

    -- Promote target user to admin
    UPDATE public.profiles
    SET role = 'admin',
        verification_status = 'verified'
    WHERE id = v_target_id;

    -- Record immutable audit log
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

-- Revoke execute from PUBLIC and authenticated; grant ONLY to service_role
REVOKE EXECUTE ON FUNCTION public.provision_initial_admin(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_initial_admin(text) TO service_role;

-- Procedure 2: Subsequent Administrator Promotion
-- Callable by authenticated users (must be an existing administrator) or trusted service_role.
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

    -- Authorization check: caller must be an existing administrator or service_role
    IF NOT public.is_admin() 
       AND v_jwt_role != 'service_role' 
       AND current_user != 'service_role' 
       AND session_user != 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Only existing administrators can promote users to administrator.';
    END IF;

    -- Lookup target user id from auth.users
    SELECT id INTO v_target_id
    FROM auth.users
    WHERE email = p_user_email;

    IF v_target_id IS NULL THEN
        RAISE EXCEPTION 'User not found: No registered user found with email %.', p_user_email;
    END IF;

    -- Set local transaction token authorizing the profile trigger
    PERFORM set_config('zenway.trusted_provisioning', 'true', true);

    -- Promote target user to admin
    UPDATE public.profiles
    SET role = 'admin',
        verification_status = 'verified'
    WHERE id = v_target_id;

    -- Record immutable audit log with acting administrator ID
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

-- Revoke execute from PUBLIC; grant to authenticated (enforced by is_admin check) and service_role
REVOKE EXECUTE ON FUNCTION public.promote_student_to_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_student_to_admin(text) TO authenticated, service_role;
