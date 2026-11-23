-- Migration: 20261123000005_fix_carry_acceptance_and_incoming_notifications.sql
-- Description:
-- 1. Fix accept_carry_offer and protect_carry_offer_submission with GUC flag zenway.in_accept_carry_rpc.
-- 2. Add automated notification triggers for incoming booking requests (ride, rent, carry) so drivers, owners, and requesters receive in-app notifications.

-- ============================================================================
-- 1. Fix Carry Offer Protection Trigger to permit RPC acceptance
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
            -- Check if transaction flag or requester cancellation/acceptance is in effect
            IF current_setting('zenway.in_accept_carry_rpc', true) = 'true' THEN
                -- Permitted from accept_carry_offer()
                NULL;
            ELSIF current_setting('zenway.in_cancel_transaction_rpc', true) = 'true' THEN
                -- Permitted from cancel_transaction_with_reason()
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
-- 2. Update accept_carry_offer to set the GUC flag
-- ============================================================================
CREATE OR REPLACE FUNCTION public.accept_carry_offer(p_offer_id uuid)
RETURNS void AS $$
DECLARE
    v_request_id uuid;
    v_carrier_id uuid;
    v_requester_id uuid;
    v_item_title text;
    v_conflicting_offer RECORD;
BEGIN
    -- 0. Set local transaction flag to permit status transition in trigger
    PERFORM set_config('zenway.in_accept_carry_rpc', 'true', true);

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

REVOKE EXECUTE ON FUNCTION public.accept_carry_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_carry_offer(uuid) TO authenticated, service_role;

-- ============================================================================
-- 3. Automated Notifications for Incoming Requests & Offers
-- ============================================================================

-- A. Ride: Notify driver when a passenger books a seat
CREATE OR REPLACE FUNCTION public.notify_driver_on_ride_request()
RETURNS trigger AS $$
DECLARE
    v_driver_id uuid;
    v_origin text;
    v_destination text;
BEGIN
    SELECT driver_id, origin_name, destination_name
    INTO v_driver_id, v_origin, v_destination
    FROM public.rides
    WHERE id = NEW.ride_id;

    IF v_driver_id IS NOT NULL AND v_driver_id != NEW.passenger_id THEN
        INSERT INTO public.notifications (
            user_id,
            actor_id,
            type,
            title,
            message,
            data
        ) VALUES (
            v_driver_id,
            NEW.passenger_id,
            'ride_request_received',
            'New Passenger Seat Booking!',
            'A student requested ' || NEW.seats_requested || ' seat(s) for your ride to ' || v_destination || '.',
            jsonb_build_object('ride_id', NEW.ride_id, 'request_id', NEW.id, 'seats', NEW.seats_requested)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_notify_driver_on_ride_request ON public.ride_requests;
CREATE TRIGGER trg_notify_driver_on_ride_request
AFTER INSERT ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_driver_on_ride_request();

-- B. Rent: Notify vehicle owner when a student submits a rental request
CREATE OR REPLACE FUNCTION public.notify_owner_on_rental_request()
RETURNS trigger AS $$
DECLARE
    v_owner_id uuid;
    v_title text;
BEGIN
    SELECT owner_id, title
    INTO v_owner_id, v_title
    FROM public.vehicles
    WHERE id = NEW.vehicle_id;

    IF v_owner_id IS NOT NULL AND v_owner_id != NEW.renter_id THEN
        INSERT INTO public.notifications (
            user_id,
            actor_id,
            type,
            title,
            message,
            data
        ) VALUES (
            v_owner_id,
            NEW.renter_id,
            'rental_request_received',
            'New Vehicle Booking Request!',
            'A student requested to rent "' || v_title || '" for ₹' || NEW.total_price || '.',
            jsonb_build_object('vehicle_id', NEW.vehicle_id, 'request_id', NEW.id, 'price', NEW.total_price)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_notify_owner_on_rental_request ON public.rental_requests;
CREATE TRIGGER trg_notify_owner_on_rental_request
AFTER INSERT ON public.rental_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_on_rental_request();

-- C. Carry: Notify package requester when a student submits an offer to carry
CREATE OR REPLACE FUNCTION public.notify_requester_on_carry_offer()
RETURNS trigger AS $$
DECLARE
    v_requester_id uuid;
    v_item_title text;
BEGIN
    SELECT requester_id, item_title
    INTO v_requester_id, v_item_title
    FROM public.carry_requests
    WHERE id = NEW.request_id;

    IF v_requester_id IS NOT NULL AND v_requester_id != NEW.carrier_id THEN
        INSERT INTO public.notifications (
            user_id,
            actor_id,
            type,
            title,
            message,
            data
        ) VALUES (
            v_requester_id,
            NEW.carrier_id,
            'carry_offer_received',
            'New Carry Delivery Offer!',
            'A student offered to deliver your package "' || v_item_title || '".',
            jsonb_build_object('request_id', NEW.request_id, 'offer_id', NEW.id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_notify_requester_on_carry_offer ON public.carry_offers;
CREATE TRIGGER trg_notify_requester_on_carry_offer
AFTER INSERT ON public.carry_offers
FOR EACH ROW EXECUTE FUNCTION public.notify_requester_on_carry_offer();
