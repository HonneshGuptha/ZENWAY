-- Migration: 20261122000002_mandatory_registration_and_profile_protection.sql
-- Description: Enforces mandatory university and phone during registration, provides profile completeness protection across Rent, Ride, and Carry, updates auth trigger, and maintains full administrator exemption.

-- ============================================================================
-- 1. Phone Normalization & University Validation Functions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.normalize_indian_phone(p_phone text)
RETURNS text AS $$
DECLARE
    v_digits text;
    v_ten_digits text;
BEGIN
    IF p_phone IS NULL THEN
        RETURN NULL;
    END IF;

    -- Strip non-digits
    v_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');

    IF length(v_digits) = 12 AND v_digits LIKE '91%' THEN
        v_ten_digits := substr(v_digits, 3);
    ELSIF length(v_digits) = 11 AND v_digits LIKE '0%' THEN
        v_ten_digits := substr(v_digits, 2);
    ELSIF length(v_digits) = 10 THEN
        v_ten_digits := v_digits;
    ELSE
        RETURN NULL;
    END IF;

    -- Standard Indian mobile number must begin with 6, 7, 8, or 9
    IF length(v_ten_digits) = 10 AND v_ten_digits ~ '^[6-9][0-9]{9}$' THEN
        RETURN '+91' || v_ten_digits;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_valid_university(p_name text)
RETURNS boolean AS $$
BEGIN
    IF p_name IS NULL THEN
        RETURN false;
    END IF;

    RETURN trim(p_name) IN (
        'MS Ramaiah University of Applied Sciences',
        'MSRUAS'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- 2. Safe Backfill / Normalization for Existing Legacy Accounts
-- ============================================================================
UPDATE public.profiles
SET university_name = 'MS Ramaiah University of Applied Sciences'
WHERE university_name = 'MSRUAS';

UPDATE public.profiles
SET phone = public.normalize_indian_phone(COALESCE(phone, phone_number)),
    phone_number = public.normalize_indian_phone(COALESCE(phone, phone_number))
WHERE (phone IS NOT NULL OR phone_number IS NOT NULL)
  AND (phone !~ '^\+91[6-9][0-9]{9}$' OR phone_number !~ '^\+91[6-9][0-9]{9}$');

-- Database constraints that tolerate existing legacy NULLs
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS chk_profiles_university_valid;

ALTER TABLE public.profiles
    ADD CONSTRAINT chk_profiles_university_valid
    CHECK (university_name IS NULL OR public.is_valid_university(university_name));

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS chk_profiles_phone_valid;

ALTER TABLE public.profiles
    ADD CONSTRAINT chk_profiles_phone_valid
    CHECK (phone IS NULL OR phone ~ '^\+91[6-9][0-9]{9}$');

-- ============================================================================
-- 3. Profile Completeness Verification Helper
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_profile_complete(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
DECLARE
    v_role public.user_role;
    v_univ text;
    v_phone text;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;

    -- Unconditional Administrator Exemption
    IF public.is_admin() THEN
        RETURN true;
    END IF;

    SELECT role, university_name, COALESCE(phone, phone_number)
    INTO v_role, v_univ, v_phone
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_role = 'admin' THEN
        RETURN true;
    END IF;

    -- University check
    IF v_univ IS NULL OR NOT public.is_valid_university(v_univ) THEN
        RETURN false;
    END IF;

    -- Phone check (normalized Indian mobile)
    IF v_phone IS NULL OR v_phone !~ '^\+91[6-9][0-9]{9}$' THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.is_profile_complete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_profile_complete(uuid) TO authenticated, service_role;

-- Detailed completeness inspection RPC for client
CREATE OR REPLACE FUNCTION public.check_profile_completeness()
RETURNS TABLE (
    is_complete boolean,
    missing_fields text[],
    university_name text,
    phone_number text
) AS $$
DECLARE
    v_uid uuid;
    v_role public.user_role;
    v_univ text;
    v_phone text;
    v_missing text[] := ARRAY[]::text[];
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN QUERY SELECT false, ARRAY['auth']::text[], NULL::text, NULL::text;
        RETURN;
    END IF;

    IF public.is_admin() THEN
        RETURN QUERY SELECT true, ARRAY[]::text[], 'MS Ramaiah University of Applied Sciences'::text, '+919999999999'::text;
        RETURN;
    END IF;

    SELECT role, p.university_name, COALESCE(p.phone, p.phone_number)
    INTO v_role, v_univ, v_phone
    FROM public.profiles p
    WHERE p.id = v_uid;

    IF v_univ IS NULL OR NOT public.is_valid_university(v_univ) THEN
        v_missing := array_append(v_missing, 'university');
    END IF;

    IF v_phone IS NULL OR v_phone !~ '^\+91[6-9][0-9]{9}$' THEN
        v_missing := array_append(v_missing, 'phone');
    END IF;

    RETURN QUERY SELECT (cardinality(v_missing) = 0), v_missing, v_univ, v_phone;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.check_profile_completeness() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_profile_completeness() TO authenticated, service_role;

-- ============================================================================
-- 4. Auth Signup Trigger Update (Email confirmation compatible)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_full_name text;
    v_univ text;
    v_phone text;
    v_normalized_univ text;
    v_normalized_phone text;
BEGIN
    v_full_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(trim(split_part(NEW.email, '@', 1)), ''),
        'Student'
    );

    IF length(v_full_name) < 2 THEN
        v_full_name := v_full_name || ' Student';
    END IF;

    -- Extract university metadata (supporting both university and university_name keys)
    v_univ := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'university'), ''),
        NULLIF(trim(NEW.raw_user_meta_data->>'university_name'), '')
    );

    IF v_univ IS NOT NULL AND public.is_valid_university(v_univ) THEN
        v_normalized_univ := 'MS Ramaiah University of Applied Sciences';
    ELSE
        v_normalized_univ := v_univ;
    END IF;

    -- Extract phone metadata (supporting both phone and phone_number keys)
    v_phone := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'phone'), ''),
        NULLIF(trim(NEW.raw_user_meta_data->>'phone_number'), '')
    );

    v_normalized_phone := public.normalize_indian_phone(v_phone);

    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        phone,
        phone_number,
        university_name,
        role,
        verification_status,
        registration_status
    ) VALUES (
        NEW.id,
        v_full_name,
        NEW.email,
        v_normalized_phone,
        v_normalized_phone,
        v_normalized_univ,
        'student',
        'unverified',
        'pending'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = COALESCE(profiles.email, EXCLUDED.email),
        phone = COALESCE(profiles.phone, EXCLUDED.phone),
        phone_number = COALESCE(profiles.phone_number, EXCLUDED.phone_number),
        university_name = COALESCE(profiles.university_name, EXCLUDED.university_name);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- 5. Secure Phone Exposure View: public_profiles
-- ============================================================================
DROP VIEW IF EXISTS public.public_profiles CASCADE;

CREATE VIEW public.public_profiles AS
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
        WHEN auth.uid() = p.id THEN COALESCE(p.phone, p.phone_number)
        WHEN public.is_admin() THEN COALESCE(p.phone, p.phone_number)
        WHEN EXISTS (
            SELECT 1 FROM public.rental_requests rr 
            WHERE ((rr.renter_id = auth.uid() AND rr.owner_id = p.id)
                OR (rr.owner_id = auth.uid() AND rr.renter_id = p.id))
              AND rr.status IN ('accepted', 'active')
        ) THEN COALESCE(p.phone, p.phone_number)
        WHEN EXISTS (
            SELECT 1 FROM public.ride_requests rq
            JOIN public.rides r ON r.id = rq.ride_id
            WHERE ((rq.passenger_id = auth.uid() AND r.driver_id = p.id)
                OR (r.driver_id = auth.uid() AND rq.passenger_id = p.id))
              AND rq.status = 'accepted'
        ) THEN COALESCE(p.phone, p.phone_number)
        WHEN EXISTS (
            SELECT 1 FROM public.carry_requests cr
            WHERE ((cr.requester_id = auth.uid() AND cr.assigned_carrier_id = p.id)
                OR (cr.assigned_carrier_id = auth.uid() AND cr.requester_id = p.id))
              AND cr.status IN ('accepted', 'in_transit')
        ) THEN COALESCE(p.phone, p.phone_number)
        ELSE NULL
    END AS phone_number,
    CASE 
        WHEN auth.uid() = p.id THEN p.upi_id
        WHEN public.is_admin() THEN p.upi_id
        WHEN EXISTS (
            SELECT 1 FROM public.rental_requests rr 
            WHERE ((rr.renter_id = auth.uid() AND rr.owner_id = p.id)
                OR (rr.owner_id = auth.uid() AND rr.renter_id = p.id))
              AND rr.status IN ('accepted', 'active', 'completed')
        ) THEN p.upi_id
        WHEN EXISTS (
            SELECT 1 FROM public.ride_requests rq
            JOIN public.rides r ON r.id = rq.ride_id
            WHERE ((rq.passenger_id = auth.uid() AND r.driver_id = p.id)
                OR (r.driver_id = auth.uid() AND rq.passenger_id = p.id))
              AND (rq.status = 'accepted' OR r.status = 'completed')
        ) THEN p.upi_id
        WHEN EXISTS (
            SELECT 1 FROM public.carry_requests cr
            WHERE ((cr.requester_id = auth.uid() AND cr.assigned_carrier_id = p.id)
                OR (cr.assigned_carrier_id = auth.uid() AND cr.requester_id = p.id))
              AND cr.status IN ('accepted', 'in_transit', 'delivered')
        ) THEN p.upi_id
        ELSE NULL
    END AS upi_id,
    CASE 
        WHEN auth.uid() = p.id THEN COALESCE(p.phone, p.phone_number)
        WHEN public.is_admin() THEN COALESCE(p.phone, p.phone_number)
        WHEN EXISTS (
            SELECT 1 FROM public.rental_requests rr 
            WHERE ((rr.renter_id = auth.uid() AND rr.owner_id = p.id)
                OR (rr.owner_id = auth.uid() AND rr.renter_id = p.id))
              AND rr.status IN ('accepted', 'active')
        ) THEN COALESCE(p.phone, p.phone_number)
        WHEN EXISTS (
            SELECT 1 FROM public.ride_requests rq
            JOIN public.rides r ON r.id = rq.ride_id
            WHERE ((rq.passenger_id = auth.uid() AND r.driver_id = p.id)
                OR (r.driver_id = auth.uid() AND rq.passenger_id = p.id))
              AND rq.status = 'accepted'
        ) THEN COALESCE(p.phone, p.phone_number)
        WHEN EXISTS (
            SELECT 1 FROM public.carry_requests cr
            WHERE ((cr.requester_id = auth.uid() AND cr.assigned_carrier_id = p.id)
                OR (cr.assigned_carrier_id = auth.uid() AND cr.requester_id = p.id))
              AND cr.status IN ('accepted', 'in_transit')
        ) THEN COALESCE(p.phone, p.phone_number)
        ELSE NULL
    END AS phone
FROM public.profiles p;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- ============================================================================
-- 6. RLS Policy Hardening: Incomplete Non-Admin Profile Protection
-- ============================================================================

-- RENT: Vehicles listing creation
DROP POLICY IF EXISTS "vehicles_insert_verified" ON public.vehicles;
CREATE POLICY "vehicles_insert_verified" ON public.vehicles
    FOR INSERT TO authenticated
    WITH CHECK (
        owner_id = auth.uid() 
        AND (public.is_admin() OR (public.is_verified_student() AND public.is_profile_complete(auth.uid())))
    );

-- RENT: Rental requests
DROP POLICY IF EXISTS "rental_requests_insert_verified" ON public.rental_requests;
CREATE POLICY "rental_requests_insert_verified" ON public.rental_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        renter_id = auth.uid() 
        AND (public.is_admin() OR (public.is_verified_student() AND public.is_profile_complete(auth.uid())))
        AND renter_id != owner_id
        AND status = 'pending'
    );

-- RIDE: Ride creation
DROP POLICY IF EXISTS "rides_insert_driver" ON public.rides;
CREATE POLICY "rides_insert_driver" ON public.rides
    FOR INSERT TO authenticated
    WITH CHECK (
        driver_id = auth.uid() 
        AND (public.is_admin() OR (public.is_verified_student() AND public.is_profile_complete(auth.uid())))
    );

-- RIDE: Seat request
DROP POLICY IF EXISTS "ride_requests_insert_passenger" ON public.ride_requests;
CREATE POLICY "ride_requests_insert_passenger" ON public.ride_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        passenger_id = auth.uid() 
        AND (public.is_admin() OR (public.is_verified_student() AND public.is_profile_complete(auth.uid())))
        AND status = 'pending'
    );

-- CARRY: Package delivery request
DROP POLICY IF EXISTS "carry_requests_insert_requester" ON public.carry_requests;
CREATE POLICY "carry_requests_insert_requester" ON public.carry_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        requester_id = auth.uid() 
        AND (public.is_admin() OR (public.is_verified_student() AND public.is_profile_complete(auth.uid())))
        AND status = 'open'
    );

-- CARRY: Carrier offer
DROP POLICY IF EXISTS "carry_offers_insert_carrier" ON public.carry_offers;
CREATE POLICY "carry_offers_insert_carrier" ON public.carry_offers
    FOR INSERT TO authenticated
    WITH CHECK (
        carrier_id = auth.uid() 
        AND (public.is_admin() OR (public.is_verified_student() AND public.is_profile_complete(auth.uid())))
        AND status = 'pending'
    );

-- ============================================================================
-- 7. Atomic Acceptance RPC Hardening (Rent, Ride, Carry)
-- ============================================================================

-- A. Rental Acceptance RPC
CREATE OR REPLACE FUNCTION public.accept_rental_request(p_request_id uuid)
RETURNS void AS $$
DECLARE
    v_vehicle_id uuid;
    v_renter_id uuid;
    v_start_time timestamptz;
    v_end_time timestamptz;
    v_owner_id uuid;
    v_vehicle_title text;
    v_conflicting_rec RECORD;
BEGIN
    -- 1. Profile completeness gate (admin exempt)
    IF NOT public.is_admin() AND NOT public.is_profile_complete(auth.uid()) THEN
        RAISE EXCEPTION 'Incomplete profile: You must complete your university and phone number before accepting rentals.';
    END IF;

    -- 2. Fetch and row-lock the target rental request
    SELECT vehicle_id, renter_id, start_time, end_time, owner_id
    INTO v_vehicle_id, v_renter_id, v_start_time, v_end_time, v_owner_id
    FROM public.rental_requests
    WHERE id = p_request_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rental request not found or not in pending state.';
    END IF;

    -- 3. Authorization check: must be vehicle owner or administrator
    IF v_owner_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only the vehicle owner can accept rental requests.';
    END IF;

    -- 4. Row-lock parent vehicle to serialize approvals
    SELECT title INTO v_vehicle_title
    FROM public.vehicles
    WHERE id = v_vehicle_id
    FOR UPDATE;

    -- 5. Check for overlapping accepted or active rentals
    IF EXISTS (
        SELECT 1 FROM public.rental_requests
        WHERE vehicle_id = v_vehicle_id
          AND status IN ('accepted', 'active')
          AND tstzrange(start_time, end_time, '[)') && tstzrange(v_start_time, v_end_time, '[)')
          AND id != p_request_id
    ) THEN
        RAISE EXCEPTION 'Cannot accept: An accepted or active rental already occupies this time window.';
    END IF;

    -- 6. Transition target request to accepted
    UPDATE public.rental_requests
    SET status = 'accepted',
        updated_at = now()
    WHERE id = p_request_id;

    -- 7. Auto-reject conflicting overlapping pending requests
    FOR v_conflicting_rec IN
        SELECT id, renter_id
        FROM public.rental_requests
        WHERE vehicle_id = v_vehicle_id
          AND status = 'pending'
          AND id != p_request_id
          AND tstzrange(start_time, end_time, '[)') && tstzrange(v_start_time, v_end_time, '[)')
        FOR UPDATE
    LOOP
        UPDATE public.rental_requests
        SET status = 'rejected',
            owner_notes = 'Automatically rejected: Vehicle booked by another student for overlapping time.',
            updated_at = now()
        WHERE id = v_conflicting_rec.id;

        INSERT INTO public.notifications (
            user_id,
            actor_id,
            type,
            title,
            message,
            data
        ) VALUES (
            v_conflicting_rec.renter_id,
            auth.uid(),
            'rental_request_rejected',
            'Rental Request Unavailable',
            'Your rental request for "' || v_vehicle_title || '" was declined because another reservation was approved.',
            jsonb_build_object('rental_request_id', v_conflicting_rec.id, 'vehicle_id', v_vehicle_id)
        );
    END LOOP;

    -- 8. Notify the accepted renter
    INSERT INTO public.notifications (
        user_id,
        actor_id,
        type,
        title,
        message,
        data
    ) VALUES (
        v_renter_id,
        auth.uid(),
        'rental_request_accepted',
        'Rental Request Approved!',
        'Your booking for "' || v_vehicle_title || '" has been accepted! Coordinate handoff via confirmed contact details.',
        jsonb_build_object('rental_request_id', p_request_id, 'vehicle_id', v_vehicle_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- B. Ride Acceptance RPC
CREATE OR REPLACE FUNCTION public.accept_ride_request(p_request_id uuid)
RETURNS void AS $$
DECLARE
    v_ride_id uuid;
    v_passenger_id uuid;
    v_seats_requested integer;
    v_driver_id uuid;
    v_available_seats integer;
    v_origin_name text;
    v_destination_name text;
BEGIN
    -- 1. Profile completeness gate (admin exempt)
    IF NOT public.is_admin() AND NOT public.is_profile_complete(auth.uid()) THEN
        RAISE EXCEPTION 'Incomplete profile: You must complete your university and phone number before accepting ride requests.';
    END IF;

    -- 2. Fetch and row-lock the target ride request
    SELECT ride_id, passenger_id, seats_requested
    INTO v_ride_id, v_passenger_id, v_seats_requested
    FROM public.ride_requests
    WHERE id = p_request_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ride request not found or not in pending state.';
    END IF;

    -- 3. Fetch and row-lock the parent ride to serialize seat reservations
    SELECT driver_id, available_seats, origin_name, destination_name
    INTO v_driver_id, v_available_seats, v_origin_name, v_destination_name
    FROM public.rides
    WHERE id = v_ride_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated ride not found.';
    END IF;

    -- 4. Authorization check: only driver or administrator
    IF v_driver_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only the ride driver can accept passenger requests.';
    END IF;

    -- 5. Seat capacity check
    IF v_available_seats < v_seats_requested THEN
        RAISE EXCEPTION 'Insufficient seats available (Requested: %, Remaining: %).', v_seats_requested, v_available_seats;
    END IF;

    -- 6. Transition request status to accepted
    UPDATE public.ride_requests
    SET status = 'accepted',
        updated_at = now()
    WHERE id = p_request_id;

    -- 7. Deduct reserved seats from the parent ride
    UPDATE public.rides
    SET available_seats = available_seats - v_seats_requested,
        updated_at = now()
    WHERE id = v_ride_id;

    -- 8. Notify the passenger
    INSERT INTO public.notifications (
        user_id,
        actor_id,
        type,
        title,
        message,
        data
    ) VALUES (
        v_passenger_id,
        auth.uid(),
        'ride_request_accepted',
        'Carpool Seat Confirmed!',
        'Your ride request from ' || v_origin_name || ' to ' || v_destination_name || ' was accepted.',
        jsonb_build_object('ride_request_id', p_request_id, 'ride_id', v_ride_id, 'seats', v_seats_requested)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- C. Carry Acceptance RPC
CREATE OR REPLACE FUNCTION public.accept_carry_offer(p_offer_id uuid)
RETURNS void AS $$
DECLARE
    v_request_id uuid;
    v_carrier_id uuid;
    v_requester_id uuid;
    v_item_title text;
    v_conflicting_offer RECORD;
BEGIN
    -- 1. Profile completeness gate (admin exempt)
    IF NOT public.is_admin() AND NOT public.is_profile_complete(auth.uid()) THEN
        RAISE EXCEPTION 'Incomplete profile: You must complete your university and phone number before accepting carry offers.';
    END IF;

    -- 2. Fetch and row-lock the target offer
    SELECT request_id, carrier_id
    INTO v_request_id, v_carrier_id
    FROM public.carry_offers
    WHERE id = p_offer_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Carry offer not found or not in pending state.';
    END IF;

    -- 3. Fetch and row-lock parent carry request
    SELECT requester_id, item_title
    INTO v_requester_id, v_item_title
    FROM public.carry_requests
    WHERE id = v_request_id AND status = 'open'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Carry request not found or no longer open.';
    END IF;

    -- 4. Authorization check: requester or administrator
    IF v_requester_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only the package requester can accept delivery offers.';
    END IF;

    -- 5. Transition target offer to accepted
    UPDATE public.carry_offers
    SET status = 'accepted',
        updated_at = now()
    WHERE id = p_offer_id;

    -- 6. Assign carrier and bind accepted offer on parent request
    UPDATE public.carry_requests
    SET status = 'accepted',
        assigned_carrier_id = v_carrier_id,
        accepted_offer_id = p_offer_id,
        updated_at = now()
    WHERE id = v_request_id;

    -- 7. Auto-reject other competing offers for this carry request
    FOR v_conflicting_offer IN
        SELECT id, carrier_id
        FROM public.carry_offers
        WHERE request_id = v_request_id
          AND status = 'pending'
          AND id != p_offer_id
        FOR UPDATE
    LOOP
        UPDATE public.carry_offers
        SET status = 'rejected',
            updated_at = now()
        WHERE id = v_conflicting_offer.id;

        INSERT INTO public.notifications (
            user_id,
            actor_id,
            type,
            title,
            message,
            data
        ) VALUES (
            v_conflicting_offer.carrier_id,
            auth.uid(),
            'carry_offer_rejected',
            'Delivery Offer Declined',
            'Another carrier was selected for "' || v_item_title || '". Thank you for offering!',
            jsonb_build_object('carry_offer_id', v_conflicting_offer.id, 'request_id', v_request_id)
        );
    END LOOP;

    -- 8. Notify the winning carrier
    INSERT INTO public.notifications (
        user_id,
        actor_id,
        type,
        title,
        message,
        data
    ) VALUES (
        v_carrier_id,
        auth.uid(),
        'carry_offer_accepted',
        'Carry Offer Accepted!',
        'Your offer to deliver "' || v_item_title || '" has been accepted! Coordinate package pickup via confirmed details.',
        jsonb_build_object('carry_offer_id', p_offer_id, 'request_id', v_request_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
