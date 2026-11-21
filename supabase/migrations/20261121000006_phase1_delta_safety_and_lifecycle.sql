-- Migration: 20261121000006_phase1_delta_safety_and_lifecycle.sql
-- Description: Phase 1 Delta Remediation:
--   1. Clean-slate demo reset server RPC with admin session validation and demo scoping.
--   2. Atomic booking concurrency trigger enforcement (blocks direct uncounted acceptance)
--      and lifecycle alignment for rental direct completion.
--   3. UPI settlement safety: 3-tier payment status machine (pending -> reported_paid -> settled)
--      and Carry module counterpart UPI disclosure in public_profiles view.

-- ============================================================================
-- PART 1: PRESENTATION CLEAN-SLATE RESET & PRODUCTION SAFETY
-- ============================================================================

CREATE OR REPLACE FUNCTION public.clean_slate_demo_reset(p_confirmation_token text)
RETURNS jsonb AS $$
DECLARE
    v_admin_id uuid;
    v_deleted_counts jsonb;
    v_vehicles_deleted integer := 0;
    v_rides_deleted integer := 0;
    v_carry_deleted integer := 0;
    v_reviews_deleted integer := 0;
    v_disputes_deleted integer := 0;
BEGIN
    -- 1. Enforce admin role and active session
    IF NOT public.is_admin() OR NOT public.has_active_admin_session() THEN
        RAISE EXCEPTION 'Access Denied: Valid verified administrator session required.';
    END IF;

    -- 2. Validate confirmation token
    IF p_confirmation_token IS DISTINCT FROM 'RESET' THEN
        RAISE EXCEPTION 'Invalid Confirmation: You must supply the exact confirmation token RESET.';
    END IF;

    v_admin_id := auth.uid();

    -- 3. Production safety guard:
    -- Never touch audit_logs, real student profiles, or real student_verifications.
    -- Strictly delete demo records (e.g. created by admin or demo/test accounts).

    -- A. Disputes linked to demo records or admin reporter/respondent
    WITH del_disputes AS (
        DELETE FROM public.disputes
        WHERE reporter_id = v_admin_id OR respondent_id = v_admin_id
           OR reporter_id IN (SELECT id FROM public.profiles WHERE university_name ILIKE '%demo%' OR university_name ILIKE '%test%')
        RETURNING id
    )
    SELECT count(*) INTO v_disputes_deleted FROM del_disputes;

    -- B. Reviews created by or for demo users / admin
    WITH del_reviews AS (
        DELETE FROM public.reviews
        WHERE reviewer_id = v_admin_id OR reviewee_id = v_admin_id
           OR reviewer_id IN (SELECT id FROM public.profiles WHERE university_name ILIKE '%demo%' OR university_name ILIKE '%test%')
        RETURNING id
    )
    SELECT count(*) INTO v_reviews_deleted FROM del_reviews;

    -- C. Carry offers and requests by demo users / admin
    DELETE FROM public.carry_offers
    WHERE carrier_id = v_admin_id
       OR request_id IN (
           SELECT id FROM public.carry_requests
           WHERE requester_id = v_admin_id
              OR requester_id IN (SELECT id FROM public.profiles WHERE university_name ILIKE '%demo%' OR university_name ILIKE '%test%')
       );

    WITH del_carry AS (
        DELETE FROM public.carry_requests
        WHERE requester_id = v_admin_id
           OR requester_id IN (SELECT id FROM public.profiles WHERE university_name ILIKE '%demo%' OR university_name ILIKE '%test%')
        RETURNING id
    )
    SELECT count(*) INTO v_carry_deleted FROM del_carry;

    -- D. Ride requests and rides by demo users / admin
    DELETE FROM public.ride_requests
    WHERE passenger_id = v_admin_id
       OR ride_id IN (
           SELECT id FROM public.rides
           WHERE driver_id = v_admin_id
              OR driver_id IN (SELECT id FROM public.profiles WHERE university_name ILIKE '%demo%' OR university_name ILIKE '%test%')
       );

    WITH del_rides AS (
        DELETE FROM public.rides
        WHERE driver_id = v_admin_id
           OR driver_id IN (SELECT id FROM public.profiles WHERE university_name ILIKE '%demo%' OR university_name ILIKE '%test%')
        RETURNING id
    )
    SELECT count(*) INTO v_rides_deleted FROM del_rides;

    -- E. Rental requests and vehicles by demo users / admin
    DELETE FROM public.rental_requests
    WHERE renter_id = v_admin_id OR owner_id = v_admin_id
       OR vehicle_id IN (
           SELECT id FROM public.vehicles
           WHERE owner_id = v_admin_id
              OR owner_id IN (SELECT id FROM public.profiles WHERE university_name ILIKE '%demo%' OR university_name ILIKE '%test%')
       );

    DELETE FROM public.vehicle_images
    WHERE vehicle_id IN (
        SELECT id FROM public.vehicles
        WHERE owner_id = v_admin_id
           OR owner_id IN (SELECT id FROM public.profiles WHERE university_name ILIKE '%demo%' OR university_name ILIKE '%test%')
    );

    WITH del_vehicles AS (
        DELETE FROM public.vehicles
        WHERE owner_id = v_admin_id
           OR owner_id IN (SELECT id FROM public.profiles WHERE university_name ILIKE '%demo%' OR university_name ILIKE '%test%')
        RETURNING id
    )
    SELECT count(*) INTO v_vehicles_deleted FROM del_vehicles;

    -- F. Audit log the clean slate reset
    PERFORM public.create_audit_log(
        v_admin_id,
        'CLEAN_SLATE_DEMO_RESET',
        'system',
        v_admin_id,
        jsonb_build_object(
            'vehicles_deleted', v_vehicles_deleted,
            'rides_deleted', v_rides_deleted,
            'carry_deleted', v_carry_deleted,
            'reviews_deleted', v_reviews_deleted,
            'disputes_deleted', v_disputes_deleted
        )
    );

    v_deleted_counts := jsonb_build_object(
        'success', true,
        'vehicles_deleted', v_vehicles_deleted,
        'rides_deleted', v_rides_deleted,
        'carry_deleted', v_carry_deleted,
        'reviews_deleted', v_reviews_deleted,
        'disputes_deleted', v_disputes_deleted
    );

    RETURN v_deleted_counts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.clean_slate_demo_reset(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clean_slate_demo_reset(text) TO authenticated, service_role;


-- ============================================================================
-- PART 2: ATOMIC BOOKING CONCURRENCY & FULL EXCHANGE LIFECYCLE
-- ============================================================================

-- A. Update accept_ride_request to set transaction-local GUC flag
CREATE OR REPLACE FUNCTION public.accept_ride_request(p_request_id uuid)
RETURNS void AS $$
DECLARE
    v_ride_id uuid;
    v_seats_requested integer;
    v_passenger_id uuid;
    v_driver_id uuid;
    v_available_seats integer;
    v_destination_name text;
BEGIN
    -- 0. Set local transaction flag to permit status transition in trigger
    PERFORM set_config('zenway.in_accept_ride_rpc', 'true', true);

    -- 1. Lock the pending ride request
    SELECT ride_id, seats_requested, passenger_id
    INTO v_ride_id, v_seats_requested, v_passenger_id
    FROM public.ride_requests
    WHERE id = p_request_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ride request not found or not in pending state.';
    END IF;

    -- 2. Lock parent ride row to serialize seat allocation
    SELECT driver_id, available_seats, destination_name
    INTO v_driver_id, v_available_seats, v_destination_name
    FROM public.rides
    WHERE id = v_ride_id
    FOR UPDATE;

    -- 3. Authorization check
    IF v_driver_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only the ride driver can accept seat bookings.';
    END IF;

    -- 4. Inventory check
    IF v_available_seats < v_seats_requested THEN
        RAISE EXCEPTION 'Cannot accept request: Insufficient seats remaining (Requested: %, Available: %).',
            v_seats_requested, v_available_seats;
    END IF;

    -- 5. Decrement seats and update request status
    UPDATE public.rides
    SET available_seats = available_seats - v_seats_requested
    WHERE id = v_ride_id;

    UPDATE public.ride_requests
    SET status = 'accepted'
    WHERE id = p_request_id;

    -- 6. Notify passenger
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
        v_passenger_id,
        'ride_request_accepted',
        'Ride Seat Confirmed!',
        format('Your seat request for the ride to "%s" was accepted by the driver.', v_destination_name),
        jsonb_build_object('ride_id', v_ride_id, 'request_id', p_request_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.accept_ride_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_ride_request(uuid) TO authenticated, service_role;


-- B. Hardened protect_ride_request_submission: Rejects direct status updates to accepted
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

        IF NEW.status IS DISTINCT FROM OLD.status THEN
            SELECT driver_id INTO v_driver_id
            FROM public.rides
            WHERE id = OLD.ride_id;

            IF OLD.status = 'pending' THEN
                IF NEW.status = 'accepted' THEN
                    -- Enforce that acceptance must be executed via the atomic accept_ride_request RPC
                    IF current_setting('zenway.in_accept_ride_rpc', true) IS DISTINCT FROM 'true' THEN
                        RAISE EXCEPTION 'Direct acceptance not allowed: Ride requests must be accepted via accept_ride_request() to guarantee atomic seat reduction.';
                    END IF;
                ELSIF NEW.status = 'rejected' THEN
                    IF auth.uid() != v_driver_id AND NOT public.is_admin() THEN
                        RAISE EXCEPTION 'Access Denied: Only the driver can decline ride requests.';
                    END IF;
                ELSIF NEW.status = 'cancelled' THEN
                    IF auth.uid() != OLD.passenger_id AND NOT public.is_admin() THEN
                        RAISE EXCEPTION 'Access Denied: Only the passenger can cancel a pending request.';
                    END IF;
                ELSE
                    RAISE EXCEPTION 'Invalid Transition: Pending requests can only transition to accepted, rejected, or cancelled.';
                END IF;
            ELSIF OLD.status = 'accepted' THEN
                IF NEW.status = 'cancelled' THEN
                    IF auth.uid() != OLD.passenger_id AND auth.uid() != v_driver_id AND NOT public.is_admin() THEN
                        RAISE EXCEPTION 'Access Denied: Only passenger or driver can cancel an accepted seat booking.';
                    END IF;
                ELSIF NEW.status = 'completed' THEN
                    IF auth.uid() != v_driver_id AND NOT public.is_admin() THEN
                        RAISE EXCEPTION 'Access Denied: Only the driver can mark seat booking completed.';
                    END IF;
                ELSE
                    RAISE EXCEPTION 'Invalid Transition: Accepted seat bookings can only transition to completed or cancelled.';
                END IF;
            ELSIF OLD.status IN ('rejected', 'cancelled', 'completed') THEN
                RAISE EXCEPTION 'Terminal State: Cannot modify status of a completed, rejected, or cancelled seat request.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- C. Align protect_rental_request_owner: Allows both accepted -> active -> completed and direct accepted -> completed
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
            RAISE EXCEPTION 'Invalid Request: You cannot submit a rental booking for your own vehicle.';
        END IF;

        IF NEW.start_time IS NULL OR NEW.end_time IS NULL THEN
            RAISE EXCEPTION 'Invalid Schedule: Start and end times must be specified.';
        END IF;

        IF NEW.end_time <= NEW.start_time THEN
            RAISE EXCEPTION 'Invalid Schedule: Rental end time must be after start time.';
        END IF;

        v_duration_hours := ceil(extract(epoch from (NEW.end_time - NEW.start_time)) / 3600.0)::integer;
        IF v_duration_hours < 1 THEN
            v_duration_hours := 1;
        END IF;

        IF v_duration_hours > 720 THEN
            RAISE EXCEPTION 'Invalid Duration: Maximum rental duration is 30 days.';
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
                    ELSIF NEW.status = 'completed' THEN
                        -- Directly completed upon return/meetup
                        IF auth.uid() != OLD.owner_id THEN
                            RAISE EXCEPTION 'Access Denied: Only the vehicle owner can mark a rental completed.';
                        END IF;
                    ELSIF NEW.status = 'cancelled' THEN
                        IF auth.uid() != OLD.renter_id AND auth.uid() != OLD.owner_id THEN
                            RAISE EXCEPTION 'Access Denied: Only booking participants can cancel an accepted rental.';
                        END IF;
                    ELSE
                        RAISE EXCEPTION 'Invalid Transition: Accepted rentals can only transition to active, completed, or cancelled.';
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

            -- Free vehicle upon completion or cancellation
            IF NEW.status IN ('completed', 'cancelled') THEN
                UPDATE public.vehicles
                SET status = 'available', updated_at = now()
                WHERE id = NEW.vehicle_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- ============================================================================
-- PART 3: UPI SETTLEMENT SAFETY & DISCLOSURE
-- ============================================================================

-- A. Rebuild public_profiles view with Carry module counterpart UPI disclosure
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
        WHEN auth.uid() = p.id THEN p.phone_number
        WHEN public.is_admin() THEN p.phone_number
        WHEN EXISTS (
            SELECT 1 FROM public.rental_requests rr
            WHERE ((rr.renter_id = auth.uid() AND rr.owner_id = p.id)
                OR (rr.owner_id = auth.uid() AND rr.renter_id = p.id))
              AND rr.status IN ('accepted', 'active')
        ) THEN p.phone_number
        WHEN EXISTS (
            SELECT 1 FROM public.ride_requests rq
            JOIN public.rides r ON r.id = rq.ride_id
            WHERE ((rq.passenger_id = auth.uid() AND r.driver_id = p.id)
                OR (r.driver_id = auth.uid() AND rq.passenger_id = p.id))
              AND rq.status = 'accepted'
        ) THEN p.phone_number
        WHEN EXISTS (
            SELECT 1 FROM public.carry_requests cr
            WHERE ((cr.requester_id = auth.uid() AND cr.assigned_carrier_id = p.id)
                OR (cr.assigned_carrier_id = auth.uid() AND cr.requester_id = p.id))
              AND cr.status IN ('accepted', 'in_transit')
        ) THEN p.phone_number
        ELSE NULL
    END AS phone_number,
    CASE
        -- Owner or administrator always sees their own UPI handle
        WHEN auth.uid() = p.id THEN p.upi_id
        WHEN public.is_admin() THEN p.upi_id

        -- RENT: counterpart in an accepted, active, or completed rental
        WHEN EXISTS (
            SELECT 1 FROM public.rental_requests rr
            WHERE ((rr.renter_id = auth.uid() AND rr.owner_id = p.id)
                OR (rr.owner_id = auth.uid() AND rr.renter_id = p.id))
              AND rr.status IN ('accepted', 'active', 'completed')
        ) THEN p.upi_id

        -- RIDE: driver or passenger in an accepted ride request (or completed ride)
        WHEN EXISTS (
            SELECT 1 FROM public.ride_requests rq
            JOIN public.rides r ON r.id = rq.ride_id
            WHERE ((rq.passenger_id = auth.uid() AND r.driver_id = p.id)
                OR (r.driver_id = auth.uid() AND rq.passenger_id = p.id))
              AND (rq.status = 'accepted' OR r.status = 'completed')
        ) THEN p.upi_id

        -- CARRY: requester or assigned carrier in an accepted, in_transit, or delivered carry request
        WHEN EXISTS (
            SELECT 1 FROM public.carry_requests cr
            WHERE ((cr.requester_id = auth.uid() AND cr.assigned_carrier_id = p.id)
                OR (cr.assigned_carrier_id = auth.uid() AND cr.requester_id = p.id))
              AND cr.status IN ('accepted', 'in_transit', 'delivered')
        ) THEN p.upi_id

        ELSE NULL
    END AS upi_id
FROM public.profiles p;

GRANT SELECT ON public.public_profiles TO authenticated, anon;


-- B. Dedicated RPC: report_payment_sent (Payer reports they sent payment)
CREATE OR REPLACE FUNCTION public.report_payment_sent(
    p_service text,
    p_request_id uuid,
    p_utr_reference text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
    v_caller_id uuid;
    v_clean_ref text;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication Required: Please sign in to report payment.';
    END IF;

    v_clean_ref := NULLIF(trim(p_utr_reference), '');

    IF p_service = 'rent' THEN
        -- Caller must be the renter (payer)
        IF NOT EXISTS (SELECT 1 FROM public.rental_requests WHERE id = p_request_id AND renter_id = v_caller_id) THEN
            RAISE EXCEPTION 'Access Denied: Only the renter can report payment sent.';
        END IF;

        UPDATE public.rental_requests
        SET payment_status = 'reported_paid',
            renter_confirmed_at = now(),
            payment_arrangement = CASE WHEN v_clean_ref IS NOT NULL THEN 'UPI_REF:' || v_clean_ref ELSE payment_arrangement END,
            updated_at = now()
        WHERE id = p_request_id AND renter_id = v_caller_id;

        -- Notify vehicle owner
        INSERT INTO public.notifications (user_id, type, title, message, data)
        SELECT 
            owner_id,
            'payment_reported',
            'Payment Reported by Renter',
            'Renter reported sending UPI payment for your rental. Please verify receipt upon handoff.',
            jsonb_build_object('rental_request_id', p_request_id, 'ref', v_clean_ref)
        FROM public.rental_requests WHERE id = p_request_id;

    ELSIF p_service = 'ride' THEN
        -- Caller must be the passenger (payer)
        IF NOT EXISTS (SELECT 1 FROM public.ride_requests WHERE id = p_request_id AND passenger_id = v_caller_id) THEN
            RAISE EXCEPTION 'Access Denied: Only the passenger can report payment sent.';
        END IF;

        UPDATE public.ride_requests
        SET payment_status = 'reported_paid',
            passenger_confirmed_at = now(),
            payment_arrangement = CASE WHEN v_clean_ref IS NOT NULL THEN 'UPI_REF:' || v_clean_ref ELSE payment_arrangement END,
            updated_at = now()
        WHERE id = p_request_id AND passenger_id = v_caller_id;

        -- Notify ride driver
        INSERT INTO public.notifications (user_id, type, title, message, data)
        SELECT 
            r.driver_id,
            'payment_reported',
            'Payment Reported by Passenger',
            'A passenger reported sending UPI payment for their seat. Please verify receipt.',
            jsonb_build_object('ride_request_id', p_request_id, 'ref', v_clean_ref)
        FROM public.ride_requests rq
        JOIN public.rides r ON r.id = rq.ride_id
        WHERE rq.id = p_request_id;

    ELSIF p_service = 'carry' THEN
        -- Caller must be the package requester (payer)
        IF NOT EXISTS (SELECT 1 FROM public.carry_requests WHERE id = p_request_id AND requester_id = v_caller_id) THEN
            RAISE EXCEPTION 'Access Denied: Only the package requester can report payment sent.';
        END IF;

        UPDATE public.carry_requests
        SET payment_status = 'reported_paid',
            requester_confirmed_at = now(),
            payment_arrangement = CASE WHEN v_clean_ref IS NOT NULL THEN 'UPI_REF:' || v_clean_ref ELSE payment_arrangement END,
            updated_at = now()
        WHERE id = p_request_id AND requester_id = v_caller_id;

        -- Notify assigned carrier
        INSERT INTO public.notifications (user_id, type, title, message, data)
        SELECT 
            assigned_carrier_id,
            'payment_reported',
            'Delivery Payment Reported',
            'Package sender reported sending UPI payment. Please verify receipt upon handoff.',
            jsonb_build_object('carry_request_id', p_request_id, 'ref', v_clean_ref)
        FROM public.carry_requests WHERE id = p_request_id AND assigned_carrier_id IS NOT NULL;

    ELSE
        RAISE EXCEPTION 'Invalid Service: %', p_service;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.report_payment_sent(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_payment_sent(text, uuid, text) TO authenticated, service_role;


-- C. Hardened confirm_mutual_completion:
-- Prevents payer from unilaterally marking payment 'settled'.
-- Renter/passenger/requester confirming sets 'reported_paid'; only payee (owner/driver/carrier) or mutual confirmation sets 'settled'.
CREATE OR REPLACE FUNCTION public.confirm_mutual_completion(
    p_service text,
    p_request_id uuid
)
RETURNS jsonb AS $$
DECLARE
    v_caller_id uuid;
    v_is_fully_completed boolean := false;
    v_rec RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF p_service = 'rent' THEN
        SELECT renter_id, owner_id, renter_confirmed_at, owner_confirmed_at, vehicle_id
        INTO v_rec
        FROM public.rental_requests
        WHERE id = p_request_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Rental request not found.';
        END IF;

        IF v_caller_id != v_rec.renter_id AND v_caller_id != v_rec.owner_id AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Unauthorized: Only booking participants can confirm completion.';
        END IF;

        -- If caller is the owner (payee)
        IF v_caller_id = v_rec.owner_id OR public.is_admin() THEN
            UPDATE public.rental_requests
            SET owner_confirmed_at = COALESCE(owner_confirmed_at, now()),
                payment_status = 'settled',
                status = 'completed',
                updated_at = now()
            WHERE id = p_request_id;

            UPDATE public.vehicles
            SET status = 'available', updated_at = now()
            WHERE id = v_rec.vehicle_id;

            v_is_fully_completed := true;
        -- If caller is the renter (payer)
        ELSE
            UPDATE public.rental_requests
            SET renter_confirmed_at = COALESCE(renter_confirmed_at, now()),
                payment_status = CASE WHEN owner_confirmed_at IS NOT NULL THEN 'settled' ELSE 'reported_paid' END,
                status = CASE WHEN owner_confirmed_at IS NOT NULL THEN 'completed'::public.rental_request_status ELSE status END,
                updated_at = now()
            WHERE id = p_request_id;

            IF v_rec.owner_confirmed_at IS NOT NULL THEN
                UPDATE public.vehicles
                SET status = 'available', updated_at = now()
                WHERE id = v_rec.vehicle_id;
                v_is_fully_completed := true;
            END IF;
        END IF;

    ELSIF p_service = 'ride' THEN
        SELECT rq.passenger_id, r.driver_id, rq.passenger_confirmed_at, rq.driver_confirmed_at
        INTO v_rec
        FROM public.ride_requests rq
        JOIN public.rides r ON r.id = rq.ride_id
        WHERE rq.id = p_request_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Ride request not found.';
        END IF;

        IF v_caller_id != v_rec.passenger_id AND v_caller_id != v_rec.driver_id AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Unauthorized: Only ride participants can confirm completion.';
        END IF;

        -- If caller is driver (payee)
        IF v_caller_id = v_rec.driver_id OR public.is_admin() THEN
            UPDATE public.ride_requests
            SET driver_confirmed_at = COALESCE(driver_confirmed_at, now()),
                payment_status = 'settled',
                status = 'completed',
                updated_at = now()
            WHERE id = p_request_id;

            v_is_fully_completed := true;
        -- If caller is passenger (payer)
        ELSE
            UPDATE public.ride_requests
            SET passenger_confirmed_at = COALESCE(passenger_confirmed_at, now()),
                payment_status = CASE WHEN driver_confirmed_at IS NOT NULL THEN 'settled' ELSE 'reported_paid' END,
                status = CASE WHEN driver_confirmed_at IS NOT NULL THEN 'completed'::public.ride_request_status ELSE status END,
                updated_at = now()
            WHERE id = p_request_id;

            IF v_rec.driver_confirmed_at IS NOT NULL THEN
                v_is_fully_completed := true;
            END IF;
        END IF;

    ELSIF p_service = 'carry' THEN
        SELECT requester_id, assigned_carrier_id, requester_confirmed_at, carrier_confirmed_at
        INTO v_rec
        FROM public.carry_requests
        WHERE id = p_request_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Carry request not found.';
        END IF;

        IF v_caller_id != v_rec.requester_id AND v_caller_id != v_rec.assigned_carrier_id AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Unauthorized: Only carry participants can confirm completion.';
        END IF;

        -- If caller is carrier (payee)
        IF v_caller_id = v_rec.assigned_carrier_id OR public.is_admin() THEN
            UPDATE public.carry_requests
            SET carrier_confirmed_at = COALESCE(carrier_confirmed_at, now()),
                payment_status = 'settled',
                status = 'delivered',
                updated_at = now()
            WHERE id = p_request_id;

            v_is_fully_completed := true;
        -- If caller is requester (payer)
        ELSE
            UPDATE public.carry_requests
            SET requester_confirmed_at = COALESCE(requester_confirmed_at, now()),
                payment_status = CASE WHEN carrier_confirmed_at IS NOT NULL THEN 'settled' ELSE 'reported_paid' END,
                status = CASE WHEN carrier_confirmed_at IS NOT NULL THEN 'delivered'::public.carry_request_status ELSE status END,
                updated_at = now()
            WHERE id = p_request_id;

            IF v_rec.carrier_confirmed_at IS NOT NULL THEN
                v_is_fully_completed := true;
            END IF;
        END IF;

    ELSE
        RAISE EXCEPTION 'Invalid service: %', p_service;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'fully_completed', v_is_fully_completed,
        'service', p_service,
        'request_id', p_request_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.confirm_mutual_completion(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_mutual_completion(text, uuid) TO authenticated, service_role;
