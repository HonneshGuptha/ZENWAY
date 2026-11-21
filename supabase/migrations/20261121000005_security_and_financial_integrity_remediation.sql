-- Migration: 20261121000005_security_and_financial_integrity_remediation.sql
-- Description: Comprehensive security, backend integrity, and admin authentication remediation.
-- 1. Secure administrator sessions & multi-layer verification (invalidating exposed static keys).
-- 2. Server-side booking price integrity RPCs & defense-in-depth triggers for Rentals and Rides.
-- 3. RLS policy corrections for ride request lifecycle management (driver rejection).
-- 4. Secure administrative provisioning procedures.

SET search_path TO public, extensions;

-- ============================================================================
-- 1. SECURE ADMINISTRATOR SESSION & AUTHENTICATION ARCHITECTURE
-- ============================================================================

-- A. Active Admin Sessions Table
CREATE TABLE IF NOT EXISTS public.admin_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_token text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours')
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_lookup 
    ON public.admin_sessions(admin_id, expires_at);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_sessions TO service_role;

-- B. Helper function to check if caller has an active verified administrator session
CREATE OR REPLACE FUNCTION public.has_active_admin_session()
RETURNS boolean AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    -- Must be an administrator in profiles
    IF NOT public.is_admin() THEN
        RETURN false;
    END IF;

    -- Must have an active, non-expired session record
    RETURN EXISTS (
        SELECT 1 FROM public.admin_sessions
        WHERE admin_id = auth.uid()
          AND expires_at > now()
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.has_active_admin_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_admin_session() TO authenticated, service_role;

-- C. Check Admin Session RPC (used by frontend to verify standing without trusting localStorage)
CREATE OR REPLACE FUNCTION public.check_admin_session()
RETURNS boolean AS $$
BEGIN
    RETURN public.has_active_admin_session();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.check_admin_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_admin_session() TO authenticated, service_role;

-- D. Secure Admin Key Verification RPC
-- Validates:
-- 1) Caller has administrator role in profiles
-- 2) Access key matches blowfish hash in admin_access_config
-- 3) Provisions a time-limited server-side admin session
CREATE OR REPLACE FUNCTION public.verify_admin_access_key(p_key text)
RETURNS boolean AS $$
DECLARE
    v_stored_hash text;
    v_token text;
    v_is_valid boolean;
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

    v_is_valid := (v_stored_hash = extensions.crypt(trim(p_key), v_stored_hash));

    IF v_is_valid THEN
        -- Cleanup any expired sessions for this admin
        DELETE FROM public.admin_sessions 
        WHERE admin_id = auth.uid() AND expires_at < now();

        -- Generate secure random session token
        v_token := encode(gen_random_bytes(32), 'hex');

        -- Create active admin session valid for 2 hours
        INSERT INTO public.admin_sessions (admin_id, session_token, expires_at)
        VALUES (auth.uid(), v_token, now() + interval '2 hours');

        PERFORM public.create_audit_log(
            auth.uid(),
            'ADMIN_ACCESS_KEY_VERIFIED',
            'admin_sessions',
            auth.uid(),
            jsonb_build_object('admin_id', auth.uid(), 'action', 'session_granted')
        );

        RETURN true;
    ELSE
        PERFORM public.create_audit_log(
            auth.uid(),
            'ADMIN_ACCESS_KEY_FAILED',
            'admin_access_config',
            auth.uid(),
            jsonb_build_object('admin_id', auth.uid(), 'reason', 'invalid_key_attempt')
        );
        RETURN false;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE EXECUTE ON FUNCTION public.verify_admin_access_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_admin_access_key(text) TO authenticated, service_role;

-- E. Admin Sign Out RPC (Invalidates active admin session server-side immediately)
CREATE OR REPLACE FUNCTION public.admin_sign_out()
RETURNS boolean AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        DELETE FROM public.admin_sessions WHERE admin_id = auth.uid();

        PERFORM public.create_audit_log(
            auth.uid(),
            'ADMIN_SIGNED_OUT',
            'admin_sessions',
            auth.uid(),
            jsonb_build_object('admin_id', auth.uid())
        );
    END IF;
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.admin_sign_out() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_sign_out() TO authenticated, service_role;

-- F. Rotate Compromised Legacy 2077 Key
-- If live database contains the blowfish hash of '2077', immediately rotate it to an
-- uncompromised secure cryptographic random key and terminate lingering sessions.
DO $$
DECLARE
    v_current_hash text;
    v_rotated_key text;
BEGIN
    SELECT access_key_hash INTO v_current_hash 
    FROM public.admin_access_config 
    WHERE id = true;

    IF v_current_hash IS NOT NULL AND v_current_hash = extensions.crypt('2077', v_current_hash) THEN
        v_rotated_key := encode(gen_random_bytes(16), 'hex');
        UPDATE public.admin_access_config
        SET access_key_hash = extensions.crypt(v_rotated_key, extensions.gen_salt('bf')),
            updated_at = now()
        WHERE id = true;

        -- Invalidate all active admin sessions on key rotation
        DELETE FROM public.admin_sessions;
        RAISE NOTICE 'Rotated legacy admin access key away from 2077.';
    END IF;
END $$;

-- G. Update Admin Access Key RPC (Requires active admin session and enforces >= 8 characters)
CREATE OR REPLACE FUNCTION public.update_admin_access_key(p_old_key text, p_new_key text)
RETURNS boolean AS $$
DECLARE
    v_stored_hash text;
BEGIN
    IF NOT public.is_admin() OR NOT public.has_active_admin_session() THEN
        RAISE EXCEPTION 'Access Denied: Valid verified administrator session required.';
    END IF;

    IF length(trim(p_new_key)) < 8 THEN
        RAISE EXCEPTION 'Invalid Key: New admin access key must be at least 8 characters long for security compliance.';
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

    -- Invalidate existing sessions on key change so re-verification is enforced
    DELETE FROM public.admin_sessions;

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

-- H. Trusted Provisioning RPCs (Only callable by service_role, e.g. SQL Editor / CLI)
CREATE OR REPLACE FUNCTION public.provision_initial_admin(p_user_email text, p_admin_key text)
RETURNS text AS $$
DECLARE
    v_user_id uuid;
BEGIN
    IF current_user != 'service_role' AND COALESCE(auth.role(), '') != 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Only service_role can provision administrators.';
    END IF;

    IF p_admin_key IS NULL OR length(trim(p_admin_key)) < 8 THEN
        RAISE EXCEPTION 'Security Policy: Admin access key must be at least 8 characters.';
    END IF;

    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = lower(trim(p_user_email));

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found with email: %', p_user_email;
    END IF;

    -- Elevate role to admin in profiles
    SET LOCAL zenway.trusted_provisioning = 'true';
    UPDATE public.profiles
    SET role = 'admin',
        verification_status = 'verified',
        registration_status = 'approved',
        updated_at = now()
    WHERE id = v_user_id;

    -- Set the access key
    INSERT INTO public.admin_access_config (id, access_key_hash, updated_at, updated_by)
    VALUES (true, extensions.crypt(trim(p_admin_key), extensions.gen_salt('bf')), now(), v_user_id)
    ON CONFLICT (id) DO UPDATE SET
        access_key_hash = EXCLUDED.access_key_hash,
        updated_at = now(),
        updated_by = v_user_id;

    -- Invalidate existing sessions
    DELETE FROM public.admin_sessions;

    RETURN 'Successfully provisioned admin ' || p_user_email || ' with secure access key.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth, pg_temp;

REVOKE ALL ON FUNCTION public.provision_initial_admin(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_initial_admin(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.provision_admin_access_key(p_new_key text)
RETURNS text AS $$
BEGIN
    IF current_user != 'service_role' AND COALESCE(auth.role(), '') != 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Only service_role can provision admin access key.';
    END IF;

    IF p_new_key IS NULL OR length(trim(p_new_key)) < 8 THEN
        RAISE EXCEPTION 'Security Policy: Admin access key must be at least 8 characters.';
    END IF;

    INSERT INTO public.admin_access_config (id, access_key_hash, updated_at)
    VALUES (true, extensions.crypt(trim(p_new_key), extensions.gen_salt('bf')), now())
    ON CONFLICT (id) DO UPDATE SET
        access_key_hash = EXCLUDED.access_key_hash,
        updated_at = now();

    -- Invalidate sessions so new key is required
    DELETE FROM public.admin_sessions;

    RETURN 'Admin access key updated successfully.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.provision_admin_access_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_admin_access_key(text) TO service_role;

-- I. Re-arm Privileged Admin RPCs with Session Verification
CREATE OR REPLACE FUNCTION public.review_student_verification(
    p_verification_id uuid,
    p_decision text,
    p_reason text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
    v_clean_reason text;
BEGIN
    IF NOT public.is_admin() OR NOT public.has_active_admin_session() THEN
        RAISE EXCEPTION 'Access Denied: Valid verified administrator session required.';
    END IF;

    IF p_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid Decision: Decision must be approved or rejected.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.student_verifications WHERE id = p_verification_id) THEN
        RAISE EXCEPTION 'Verification record not found.';
    END IF;

    IF p_decision = 'rejected' THEN
        v_clean_reason := NULLIF(trim(p_reason), '');
        IF v_clean_reason IS NULL THEN
            RAISE EXCEPTION 'A rejection reason is required when rejecting verification.';
        END IF;
    END IF;

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

CREATE OR REPLACE FUNCTION public.toggle_user_suspension(
    p_user_id uuid,
    p_suspend boolean,
    p_reason text DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
    IF NOT public.is_admin() OR NOT public.has_active_admin_session() THEN
        RAISE EXCEPTION 'Access Denied: Valid verified administrator session required.';
    END IF;

    UPDATE public.profiles
    SET verification_status = CASE WHEN p_suspend THEN 'suspended'::public.account_verification_status ELSE 'verified'::public.account_verification_status END,
        updated_at = now()
    WHERE id = p_user_id;

    PERFORM public.create_audit_log(
        auth.uid(),
        CASE WHEN p_suspend THEN 'USER_SUSPENDED' ELSE 'USER_UNSUSPENDED' END,
        'profiles',
        p_user_id,
        jsonb_build_object('suspended', p_suspend, 'reason', p_reason)
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.toggle_user_suspension(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_user_suspension(uuid, boolean, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.approve_registration(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
    IF NOT public.is_admin() OR NOT public.has_active_admin_session() THEN
        RAISE EXCEPTION 'Access Denied: Valid verified administrator session required.';
    END IF;

    UPDATE public.profiles
    SET registration_status = 'approved',
        registration_rejection_reason = NULL,
        registration_reviewed_at = now(),
        registration_reviewed_by = auth.uid(),
        updated_at = now()
    WHERE id = p_user_id;

    PERFORM public.create_audit_log(
        auth.uid(),
        'REGISTRATION_APPROVED',
        'profiles',
        p_user_id,
        jsonb_build_object('approved_user', p_user_id)
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.approve_registration(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_registration(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reject_registration(p_user_id uuid, p_rejection_reason text)
RETURNS boolean AS $$
BEGIN
    IF NOT public.is_admin() OR NOT public.has_active_admin_session() THEN
        RAISE EXCEPTION 'Access Denied: Valid verified administrator session required.';
    END IF;

    IF p_rejection_reason IS NULL OR length(trim(p_rejection_reason)) = 0 THEN
        RAISE EXCEPTION 'A rejection reason is required.';
    END IF;

    UPDATE public.profiles
    SET registration_status = 'rejected',
        registration_rejection_reason = trim(p_rejection_reason),
        registration_reviewed_at = now(),
        registration_reviewed_by = auth.uid(),
        updated_at = now()
    WHERE id = p_user_id;

    PERFORM public.create_audit_log(
        auth.uid(),
        'REGISTRATION_REJECTED',
        'profiles',
        p_user_id,
        jsonb_build_object('rejected_user', p_user_id, 'reason', trim(p_rejection_reason))
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.reject_registration(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_registration(uuid, text) TO authenticated, service_role;

-- ============================================================================
-- 2. SERVER-SIDE BOOKING PRICE INTEGRITY (RENTAL & RIDE)
-- ============================================================================

-- A. Authoritative Rental Booking Creation RPC
CREATE OR REPLACE FUNCTION public.create_rental_booking(
    p_vehicle_id uuid,
    p_start_time timestamptz,
    p_end_time timestamptz,
    p_renter_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_owner_id uuid;
    v_vehicle_status public.listing_status;
    v_hourly_rate numeric(10,2);
    v_daily_rate numeric(10,2);
    v_deposit_amount numeric(10,2);
    v_rate numeric(10,2);
    v_duration_hours integer;
    v_total_price numeric(10,2);
    v_new_request_id uuid;
BEGIN
    -- 1. Authorization checks
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication Required: Please sign in to book a vehicle.';
    END IF;

    IF NOT public.is_verified_student() THEN
        RAISE EXCEPTION 'Verification Required: Only verified students can submit rental bookings.';
    END IF;

    -- 2. Validate timestamps
    IF p_start_time IS NULL OR p_end_time IS NULL THEN
        RAISE EXCEPTION 'Invalid Schedule: Start and end times must be specified.';
    END IF;

    IF p_start_time < (now() - interval '5 minutes') THEN
        RAISE EXCEPTION 'Invalid Schedule: Rental start time cannot be in the past.';
    END IF;

    IF p_end_time <= p_start_time THEN
        RAISE EXCEPTION 'Invalid Schedule: Rental end time must be after the start time.';
    END IF;

    -- Calculate duration in whole hours (minimum 1 hour)
    v_duration_hours := ceil(extract(epoch from (p_end_time - p_start_time)) / 3600.0)::integer;
    IF v_duration_hours < 1 THEN
        v_duration_hours := 1;
    END IF;

    -- Maximum duration guard (30 days = 720 hours)
    IF v_duration_hours > 720 THEN
        RAISE EXCEPTION 'Invalid Duration: Maximum rental booking duration is 30 days.';
    END IF;

    -- 3. Fetch and lock vehicle for price calculation
    SELECT owner_id, status, hourly_rate, daily_rate, deposit_amount
    INTO v_owner_id, v_vehicle_status, v_hourly_rate, v_daily_rate, v_deposit_amount
    FROM public.vehicles
    WHERE id = p_vehicle_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid Vehicle: The requested vehicle does not exist.';
    END IF;

    IF v_vehicle_status != 'available' THEN
        RAISE EXCEPTION 'Vehicle Unavailable: Vehicle is not currently listed as available.';
    END IF;

    -- 4. Prevent self-rental
    IF v_owner_id = auth.uid() THEN
        RAISE EXCEPTION 'Invalid Booking: You cannot rent your own vehicle.';
    END IF;

    -- 5. Authoritative price calculation using database values
    IF v_hourly_rate IS NOT NULL AND v_hourly_rate > 0 THEN
        v_rate := v_hourly_rate;
    ELSIF v_daily_rate IS NOT NULL AND v_daily_rate > 0 THEN
        v_rate := round(v_daily_rate / 24.0, 2);
    ELSE
        v_rate := 100.00;
    END IF;

    v_total_price := round(v_duration_hours * v_rate, 2);

    -- 6. Check for overlapping accepted/active bookings for this vehicle
    IF EXISTS (
        SELECT 1 FROM public.rental_requests
        WHERE vehicle_id = p_vehicle_id
          AND status IN ('accepted', 'active')
          AND tstzrange(start_time, end_time, '[)') && tstzrange(p_start_time, p_end_time, '[)')
    ) THEN
        RAISE EXCEPTION 'Schedule Conflict: This vehicle is already reserved for the selected period.';
    END IF;

    -- 7. Prevent duplicate pending requests by same renter for same timeframe
    IF EXISTS (
        SELECT 1 FROM public.rental_requests
        WHERE vehicle_id = p_vehicle_id
          AND renter_id = auth.uid()
          AND status = 'pending'
          AND tstzrange(start_time, end_time, '[)') && tstzrange(p_start_time, p_end_time, '[)')
    ) THEN
        RAISE EXCEPTION 'Duplicate Request: You already have a pending booking request for this vehicle during this period.';
    END IF;

    -- 8. Insert authoritative rental request
    INSERT INTO public.rental_requests (
        vehicle_id,
        renter_id,
        owner_id,
        start_time,
        end_time,
        total_price,
        deposit_amount,
        status,
        renter_notes
    ) VALUES (
        p_vehicle_id,
        auth.uid(),
        v_owner_id,
        p_start_time,
        p_end_time,
        v_total_price,
        COALESCE(v_deposit_amount, 0.00),
        'pending',
        NULLIF(trim(p_renter_notes), '')
    )
    RETURNING id INTO v_new_request_id;

    RETURN v_new_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE EXECUTE ON FUNCTION public.create_rental_booking(uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_rental_booking(uuid, timestamptz, timestamptz, text) TO authenticated, service_role;

-- B. Authoritative Ride Booking Creation RPC
CREATE OR REPLACE FUNCTION public.create_ride_booking(
    p_ride_id uuid,
    p_seats_requested integer,
    p_pickup_note text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_driver_id uuid;
    v_ride_status public.ride_status;
    v_departure_time timestamptz;
    v_available_seats integer;
    v_price_per_seat numeric(10,2);
    v_total_price numeric(10,2);
    v_new_request_id uuid;
BEGIN
    -- 1. Authorization checks
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication Required: Please sign in to join a ride.';
    END IF;

    IF NOT public.is_verified_student() THEN
        RAISE EXCEPTION 'Verification Required: Only verified students can reserve ride seats.';
    END IF;

    -- 2. Validate seat count
    IF p_seats_requested IS NULL OR p_seats_requested < 1 OR p_seats_requested > 8 THEN
        RAISE EXCEPTION 'Invalid Seat Count: Requested seats must be between 1 and 8.';
    END IF;

    -- 3. Lock ride row for share and fetch authoritative data
    SELECT driver_id, status, departure_time, available_seats, price_per_seat
    INTO v_driver_id, v_ride_status, v_departure_time, v_available_seats, v_price_per_seat
    FROM public.rides
    WHERE id = p_ride_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid Ride: Referenced carpool ride does not exist.';
    END IF;

    IF v_ride_status != 'scheduled' THEN
        RAISE EXCEPTION 'Ride Closed: Cannot request seats on a ride that is not scheduled.';
    END IF;

    IF v_departure_time <= now() THEN
        RAISE EXCEPTION 'Ride Departed: Cannot book seats on a ride that has already departed.';
    END IF;

    -- 4. Prevent driver self-booking
    IF v_driver_id = auth.uid() THEN
        RAISE EXCEPTION 'Invalid Request: Drivers cannot reserve seats on their own rides.';
    END IF;

    -- 5. Validate seat availability
    IF p_seats_requested > v_available_seats THEN
        RAISE EXCEPTION 'Insufficient Seats: Only % seat(s) available on this ride.', v_available_seats;
    END IF;

    -- 6. Prevent duplicate active or pending booking by same passenger
    IF EXISTS (
        SELECT 1 FROM public.ride_requests
        WHERE ride_id = p_ride_id
          AND passenger_id = auth.uid()
          AND status IN ('pending', 'accepted')
    ) THEN
        RAISE EXCEPTION 'Duplicate Request: You already have a pending or accepted seat request for this ride.';
    END IF;

    -- 7. Calculate authoritative total price
    v_total_price := round(p_seats_requested * COALESCE(v_price_per_seat, 0.00), 2);

    -- 8. Insert authoritative ride request
    INSERT INTO public.ride_requests (
        ride_id,
        passenger_id,
        seats_requested,
        total_price,
        pickup_note,
        status
    ) VALUES (
        p_ride_id,
        auth.uid(),
        p_seats_requested,
        v_total_price,
        NULLIF(trim(p_pickup_note), ''),
        'pending'
    )
    RETURNING id INTO v_new_request_id;

    RETURN v_new_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE EXECUTE ON FUNCTION public.create_ride_booking(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_ride_booking(uuid, integer, text) TO authenticated, service_role;

-- C. Defense-in-depth Trigger: protect_rental_request_owner
-- Forcibly recalculates total_price & deposit from vehicle record even if directly inserted
CREATE OR REPLACE FUNCTION public.protect_rental_request_owner()
RETURNS trigger AS $$
DECLARE
    v_actual_owner_id uuid;
    v_vehicle_status public.listing_status;
    v_hourly_rate numeric(10,2);
    v_daily_rate numeric(10,2);
    v_deposit_amount numeric(10,2);
    v_rate numeric(10,2);
    v_duration_hours integer;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT owner_id, status, hourly_rate, daily_rate, deposit_amount
        INTO v_actual_owner_id, v_vehicle_status, v_hourly_rate, v_daily_rate, v_deposit_amount
        FROM public.vehicles
        WHERE id = NEW.vehicle_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid Vehicle: The referenced vehicle does not exist.';
        END IF;

        IF v_vehicle_status != 'available' THEN
            RAISE EXCEPTION 'Vehicle Unavailable: Cannot request a vehicle that is not currently listed as available.';
        END IF;

        IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
            NEW.renter_id := auth.uid();
        END IF;

        NEW.owner_id := v_actual_owner_id;

        IF NEW.renter_id = NEW.owner_id THEN
            RAISE EXCEPTION 'Invalid Booking: You cannot rent your own vehicle.';
        END IF;

        IF NEW.end_time <= NEW.start_time THEN
            RAISE EXCEPTION 'Invalid Schedule: End time must be after start time.';
        END IF;

        -- Authoritative price recalculation (defense-in-depth against client tampering)
        v_duration_hours := ceil(extract(epoch from (NEW.end_time - NEW.start_time)) / 3600.0)::integer;
        IF v_duration_hours < 1 THEN
            v_duration_hours := 1;
        END IF;

        IF v_hourly_rate IS NOT NULL AND v_hourly_rate > 0 THEN
            v_rate := v_hourly_rate;
        ELSIF v_daily_rate IS NOT NULL AND v_daily_rate > 0 THEN
            v_rate := round(v_daily_rate / 24.0, 2);
        ELSE
            v_rate := 100.00;
        END IF;

        NEW.total_price := round(v_duration_hours * v_rate, 2);
        NEW.deposit_amount := COALESCE(v_deposit_amount, 0.00);
        NEW.status := 'pending';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF (NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id) OR
           (NEW.renter_id IS DISTINCT FROM OLD.renter_id) OR
           (NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
            RAISE EXCEPTION 'Immutable Fields: Vehicle, renter, and owner references cannot be modified.';
        END IF;

        IF OLD.status IN ('accepted', 'active', 'completed', 'rejected', 'cancelled') AND 
           (NEW.start_time IS DISTINCT FROM OLD.start_time OR 
            NEW.end_time IS DISTINCT FROM OLD.end_time OR 
            NEW.total_price IS DISTINCT FROM OLD.total_price OR
            NEW.deposit_amount IS DISTINCT FROM OLD.deposit_amount) THEN
            RAISE EXCEPTION 'Immutable Fields: Cannot modify schedule or pricing on an accepted or completed rental.';
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF NOT public.is_admin() THEN
                IF OLD.status = 'pending' THEN
                    IF NEW.status = 'accepted' THEN
                        IF auth.uid() != OLD.owner_id THEN
                            RAISE EXCEPTION 'Access Denied: Only the vehicle owner can accept rental requests.';
                        END IF;
                    ELSIF NEW.status = 'rejected' THEN
                        IF auth.uid() != OLD.owner_id THEN
                            RAISE EXCEPTION 'Access Denied: Only the vehicle owner can reject rental requests.';
                        END IF;
                    ELSIF NEW.status = 'cancelled' THEN
                        IF auth.uid() != OLD.renter_id AND auth.uid() != OLD.owner_id THEN
                            RAISE EXCEPTION 'Access Denied: Only booking participants can cancel a pending rental.';
                        END IF;
                    ELSE
                        RAISE EXCEPTION 'Invalid Transition: Pending rentals can only transition to accepted, rejected, or cancelled.';
                    END IF;
                ELSIF OLD.status = 'accepted' THEN
                    IF NEW.status = 'active' THEN
                        IF auth.uid() != OLD.owner_id THEN
                            RAISE EXCEPTION 'Access Denied: Only the vehicle owner can confirm vehicle handoff to active.';
                        END IF;
                    ELSIF NEW.status = 'cancelled' THEN
                        IF auth.uid() != OLD.renter_id AND auth.uid() != OLD.owner_id THEN
                            RAISE EXCEPTION 'Access Denied: Only booking participants can cancel an accepted rental.';
                        END IF;
                    ELSE
                        RAISE EXCEPTION 'Invalid Transition: Accepted rentals can only transition to active or cancelled.';
                    END IF;
                ELSIF OLD.status = 'active' THEN
                    IF NEW.status = 'completed' THEN
                        IF auth.uid() != OLD.owner_id THEN
                            RAISE EXCEPTION 'Access Denied: Only the vehicle owner can mark a rental completed.';
                        END IF;
                    ELSE
                        RAISE EXCEPTION 'Invalid Transition: Active rentals can only transition to completed.';
                    END IF;
                ELSIF OLD.status IN ('completed', 'rejected', 'cancelled') THEN
                    RAISE EXCEPTION 'Terminal State: Cannot modify status of a completed, rejected, or cancelled rental.';
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- D. Defense-in-depth Trigger: protect_ride_request_submission
-- Forcibly recalculates total_price & validates seats from ride record even if directly inserted
CREATE OR REPLACE FUNCTION public.protect_ride_request_submission()
RETURNS trigger AS $$
DECLARE
    v_driver_id uuid;
    v_ride_status public.ride_status;
    v_available_seats integer;
    v_price_per_seat numeric(10,2);
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT driver_id, status, available_seats, price_per_seat 
        INTO v_driver_id, v_ride_status, v_available_seats, v_price_per_seat
        FROM public.rides
        WHERE id = NEW.ride_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid Ride: Referenced carpool ride does not exist.';
        END IF;

        IF v_ride_status != 'scheduled' THEN
            RAISE EXCEPTION 'Ride Closed: Cannot request seats on a ride that is not scheduled.';
        END IF;

        IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
            NEW.passenger_id := auth.uid();
        END IF;

        IF NEW.passenger_id = v_driver_id THEN
            RAISE EXCEPTION 'Invalid Request: Drivers cannot reserve seats on their own carpool rides.';
        END IF;

        IF NEW.seats_requested IS NULL OR NEW.seats_requested < 1 OR NEW.seats_requested > 8 THEN
            RAISE EXCEPTION 'Invalid Seats: Requested seats must be between 1 and 8.';
        END IF;

        IF NEW.seats_requested > v_available_seats THEN
            RAISE EXCEPTION 'Insufficient Seats: Only % seat(s) available on this ride.', v_available_seats;
        END IF;

        -- Authoritative price calculation (defense-in-depth)
        NEW.total_price := round(NEW.seats_requested * COALESCE(v_price_per_seat, 0.00), 2);
        NEW.status := 'pending';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF (NEW.ride_id IS DISTINCT FROM OLD.ride_id) OR
           (NEW.passenger_id IS DISTINCT FROM OLD.passenger_id) OR
           (NEW.seats_requested IS DISTINCT FROM OLD.seats_requested) OR
           (NEW.total_price IS DISTINCT FROM OLD.total_price) THEN
            RAISE EXCEPTION 'Immutable Fields: Ride booking core parameters cannot be altered.';
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.is_admin() THEN
            SELECT driver_id INTO v_driver_id
            FROM public.rides
            WHERE id = OLD.ride_id;

            IF OLD.status = 'pending' THEN
                IF NEW.status = 'accepted' THEN
                    IF auth.uid() != v_driver_id THEN
                        RAISE EXCEPTION 'Access Denied: Only the driver can accept ride requests.';
                    END IF;
                ELSIF NEW.status = 'rejected' THEN
                    IF auth.uid() != v_driver_id THEN
                        RAISE EXCEPTION 'Access Denied: Only the driver can decline ride requests.';
                    END IF;
                ELSIF NEW.status = 'cancelled' THEN
                    IF auth.uid() != OLD.passenger_id THEN
                        RAISE EXCEPTION 'Access Denied: Only the passenger can cancel a pending request.';
                    END IF;
                ELSE
                    RAISE EXCEPTION 'Invalid Transition: Pending requests can only transition to accepted, rejected, or cancelled.';
                END IF;
            ELSIF OLD.status = 'accepted' THEN
                IF NEW.status = 'cancelled' THEN
                    IF auth.uid() != OLD.passenger_id AND auth.uid() != v_driver_id THEN
                        RAISE EXCEPTION 'Access Denied: Only passenger or driver can cancel an accepted seat booking.';
                    END IF;
                ELSE
                    RAISE EXCEPTION 'Invalid Transition: Accepted seat bookings can only transition to cancelled.';
                END IF;
            ELSIF OLD.status IN ('rejected', 'cancelled') THEN
                RAISE EXCEPTION 'Terminal State: Cannot modify status of a rejected or cancelled seat request.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- 3. RLS POLICY CORRECTION: RIDE REQUESTS DRIVER DECLINE / PASSENGER CANCEL
-- ============================================================================

DROP POLICY IF EXISTS "ride_requests_update_passenger_cancel" ON public.ride_requests;
DROP POLICY IF EXISTS "ride_requests_update_parties" ON public.ride_requests;

CREATE POLICY "ride_requests_update_parties" ON public.ride_requests
    FOR UPDATE TO authenticated
    USING (
        passenger_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.rides 
            WHERE rides.id = ride_requests.ride_id 
              AND rides.driver_id = auth.uid()
        )
        OR public.is_admin()
    )
    WITH CHECK (
        (status = 'cancelled' AND passenger_id = auth.uid())
        OR (status = 'rejected' AND EXISTS (
            SELECT 1 FROM public.rides 
            WHERE rides.id = ride_requests.ride_id 
              AND rides.driver_id = auth.uid()
        ))
        OR public.is_admin()
    );
