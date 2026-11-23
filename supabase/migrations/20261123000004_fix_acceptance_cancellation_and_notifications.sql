-- Migration: 20261123000004_fix_acceptance_cancellation_and_notifications.sql
-- Description:
-- 1. Add missing `actor_id` column to `public.notifications` table to support notification tracking.
-- 2. Fix `accept_ride_request` to set `zenway.in_accept_ride_rpc` so the trigger permits atomic acceptance.
-- 3. Fix `cancel_transaction_with_reason` and `protect_carry_offer_submission` so requesters can cancel their carry requests.
-- 4. Grant insert privileges and RLS policy on `public.audit_logs` for authenticated client logging.

-- ============================================================================
-- 1. Notifications Table: Add actor_id column & index
-- ============================================================================
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS actor_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON public.notifications(actor_id);

-- Enable Realtime publication for notifications if not already enabled
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_object THEN null;
END $$;

-- ============================================================================
-- 2. Audit Logs: Grant Insert & RLS policy for authenticated users
-- ============================================================================
GRANT INSERT ON public.audit_logs TO authenticated;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'audit_logs' 
          AND policyname = 'authenticated_insert_audit_logs'
    ) THEN
        CREATE POLICY "authenticated_insert_audit_logs" ON public.audit_logs
        FOR INSERT TO authenticated 
        WITH CHECK (actor_id = auth.uid() OR auth.uid() IS NOT NULL);
    END IF;
END $$;

-- ============================================================================
-- 3. Fix accept_ride_request: Set local transaction GUC flag
-- ============================================================================
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
    -- 0. Set local transaction flag to permit status transition in trigger
    PERFORM set_config('zenway.in_accept_ride_rpc', 'true', true);

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

REVOKE EXECUTE ON FUNCTION public.accept_ride_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_ride_request(uuid) TO authenticated, service_role;

-- ============================================================================
-- 4. Fix Carry Offer Protection Trigger to permit requester cancellation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_carry_offer_submission()
RETURNS trigger AS $$
DECLARE
    v_requester_id uuid;
    v_request_status public.carry_request_status;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT requester_id, status 
        INTO v_requester_id, v_request_status
        FROM public.carry_requests
        WHERE id = NEW.request_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid Request: Referenced carry request does not exist.';
        END IF;

        IF v_request_status != 'open' THEN
            RAISE EXCEPTION 'Carry Closed: Cannot offer to carry packages for requests that are not open.';
        END IF;

        IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
            NEW.carrier_id := auth.uid();
        END IF;

        IF NEW.carrier_id = v_requester_id THEN
            RAISE EXCEPTION 'Invalid Offer: Requesters cannot offer to carry their own package.';
        END IF;

        NEW.status := 'pending';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF (NEW.request_id IS DISTINCT FROM OLD.request_id) OR
           (NEW.carrier_id IS DISTINCT FROM OLD.carrier_id) THEN
            RAISE EXCEPTION 'Immutable Fields: Offer request and carrier associations cannot be modified.';
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.is_admin() THEN
            -- Check if transaction flag or requester cancellation is in effect
            IF current_setting('zenway.in_cancel_transaction_rpc', true) = 'true' THEN
                -- Permitted from cancel_transaction_with_reason
                NULL;
            ELSIF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
                IF auth.uid() != OLD.carrier_id 
                   AND auth.uid() != (SELECT requester_id FROM public.carry_requests WHERE id = OLD.request_id) THEN
                    RAISE EXCEPTION 'Access Denied: Only the carrier or requester can cancel their pending offer.';
                END IF;
            ELSE
                RAISE EXCEPTION 'Invalid Transition: Direct client updates on carry offers are restricted to cancellation. Offer acceptances must be routed through accept_carry_offer().';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- 5. Fix cancel_transaction_with_reason: Set GUC flag & auth check for carry
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancel_transaction_with_reason(
    p_service text,
    p_request_id uuid,
    p_reason text
)
RETURNS boolean AS $$
DECLARE
    v_caller_id uuid;
    v_ride_id uuid;
    v_seats integer;
    v_vehicle_id uuid;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF p_service = 'rent' THEN
        SELECT vehicle_id INTO v_vehicle_id
        FROM public.rental_requests
        WHERE id = p_request_id AND (renter_id = v_caller_id OR owner_id = v_caller_id);

        IF v_vehicle_id IS NULL AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Not authorized to cancel this rental.';
        END IF;

        UPDATE public.rental_requests
        SET status = 'cancelled',
            cancellation_reason = p_reason,
            updated_at = now()
        WHERE id = p_request_id;

        UPDATE public.vehicles
        SET status = 'available', updated_at = now()
        WHERE id = v_vehicle_id;

    ELSIF p_service = 'ride' THEN
        SELECT ride_id, seats_requested INTO v_ride_id, v_seats
        FROM public.ride_requests
        WHERE id = p_request_id;

        UPDATE public.ride_requests
        SET status = 'cancelled',
            cancellation_reason = p_reason,
            updated_at = now()
        WHERE id = p_request_id;

        -- Restore available seats
        IF v_ride_id IS NOT NULL AND v_seats IS NOT NULL THEN
            UPDATE public.rides
            SET available_seats = LEAST(total_seats, available_seats + v_seats),
                updated_at = now()
            WHERE id = v_ride_id;
        END IF;

    ELSIF p_service = 'carry' THEN
        -- Allow package requester, assigned carrier, or admin to cancel
        IF NOT public.is_admin() AND NOT EXISTS (
            SELECT 1 FROM public.carry_requests
            WHERE id = p_request_id AND (requester_id = v_caller_id OR assigned_carrier_id = v_caller_id)
        ) THEN
            RAISE EXCEPTION 'Not authorized to cancel this carry request.';
        END IF;

        -- Set transaction flag so carry_offers trigger permits cascading cancellation
        PERFORM set_config('zenway.in_cancel_transaction_rpc', 'true', true);

        UPDATE public.carry_requests
        SET status = 'cancelled',
            cancellation_reason = p_reason,
            updated_at = now()
        WHERE id = p_request_id;

        UPDATE public.carry_offers
        SET status = 'cancelled',
            updated_at = now()
        WHERE request_id = p_request_id;
    END IF;

    PERFORM public.create_audit_log(
        v_caller_id,
        'TRANSACTION_CANCELLED',
        p_service,
        p_request_id,
        jsonb_build_object('reason', p_reason)
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.cancel_transaction_with_reason(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_transaction_with_reason(text, uuid, text) TO authenticated, service_role;
