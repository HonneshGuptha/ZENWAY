-- Migration: 20261110000006_ride_module.sql
-- Description: Creates rides and ride_requests with atomic seat allocation, ride cancellation trigger, and seat protection

-- 1. Create rides table
CREATE TABLE IF NOT EXISTS public.rides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    origin_name text NOT NULL,
    origin_lat double precision NULL CHECK (origin_lat IS NULL OR (origin_lat >= -90 AND origin_lat <= 90)),
    origin_lng double precision NULL CHECK (origin_lng IS NULL OR (origin_lng >= -180 AND origin_lng <= 180)),
    destination_name text NOT NULL,
    destination_lat double precision NULL CHECK (destination_lat IS NULL OR (destination_lat >= -90 AND destination_lat <= 90)),
    destination_lng double precision NULL CHECK (destination_lng IS NULL OR (destination_lng >= -180 AND destination_lng <= 180)),
    departure_time timestamptz NOT NULL,
    total_seats integer NOT NULL CHECK (total_seats BETWEEN 1 AND 8),
    available_seats integer NOT NULL CHECK (available_seats >= 0),
    price_per_seat numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (price_per_seat >= 0),
    notes text NULL CHECK (notes IS NULL OR length(notes) <= 500),
    status public.ride_status NOT NULL DEFAULT 'scheduled',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_seats_available_lte_total CHECK (available_seats <= total_seats)
);

CREATE INDEX IF NOT EXISTS idx_rides_driver ON public.rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_feed ON public.rides(departure_time ASC, status) WHERE status = 'scheduled';

DROP TRIGGER IF EXISTS trg_rides_updated_at ON public.rides;
CREATE TRIGGER trg_rides_updated_at
BEFORE UPDATE ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: Ensure ride driver_id matches authenticated user, manage seat count changes, and protect lifecycle
CREATE OR REPLACE FUNCTION public.protect_ride_driver()
RETURNS trigger AS $$
DECLARE
    v_booked_seats integer;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
            NEW.driver_id := auth.uid();
        END IF;
        -- Initial available seats default to total_seats if unassigned
        IF NEW.available_seats IS NULL THEN
            NEW.available_seats := NEW.total_seats;
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.driver_id IS DISTINCT FROM OLD.driver_id AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Immutable Field: Ride driver cannot be transferred.';
        END IF;

        -- If driver alters total_seats, ensure total_seats is not reduced below already booked seats
        IF NEW.total_seats IS DISTINCT FROM OLD.total_seats THEN
            v_booked_seats := OLD.total_seats - OLD.available_seats;
            IF NEW.total_seats < v_booked_seats THEN
                RAISE EXCEPTION 'Integrity Error: Cannot reduce total seats below currently booked seat count (Booked: %).', v_booked_seats;
            END IF;
            -- Adjust available seats according to delta
            NEW.available_seats := OLD.available_seats + (NEW.total_seats - OLD.total_seats);
        END IF;

        -- Enforce lifecycle transitions
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF NOT public.is_admin() THEN
                IF OLD.status = 'scheduled' THEN
                    IF NEW.status NOT IN ('in_progress', 'completed', 'cancelled') THEN
                        RAISE EXCEPTION 'Invalid Transition: Scheduled rides can only move to in_progress, completed, or cancelled.';
                    END IF;
                ELSIF OLD.status = 'in_progress' THEN
                    IF NEW.status NOT IN ('completed', 'cancelled') THEN
                        RAISE EXCEPTION 'Invalid Transition: In-progress rides can only move to completed or cancelled.';
                    END IF;
                ELSIF OLD.status IN ('completed', 'cancelled') THEN
                    RAISE EXCEPTION 'Terminal State: Cannot modify status of a completed or cancelled ride.';
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_ride_driver ON public.rides;
CREATE TRIGGER trg_protect_ride_driver
BEFORE INSERT OR UPDATE ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.protect_ride_driver();

-- Trigger: Notify passengers and auto-cancel bookings if driver cancels the ride
CREATE OR REPLACE FUNCTION public.on_ride_cancelled()
RETURNS trigger AS $$
BEGIN
    IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
        -- Notify all active or pending passengers
        INSERT INTO public.notifications (user_id, type, title, message, data)
        SELECT 
            rr.passenger_id,
            'ride_cancelled',
            'Ride Cancelled by Driver',
            format('The ride to "%s" scheduled for %s has been cancelled by the driver.',
                   NEW.destination_name,
                   to_char(NEW.departure_time, 'Mon DD, HH24:MI')),
            jsonb_build_object('ride_id', NEW.id)
        FROM public.ride_requests rr
        WHERE rr.ride_id = NEW.id AND rr.status IN ('pending', 'accepted');

        -- Transition all pending and accepted requests to cancelled
        UPDATE public.ride_requests
        SET status = 'cancelled'
        WHERE ride_id = NEW.id AND status IN ('pending', 'accepted');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_on_ride_cancelled ON public.rides;
CREATE TRIGGER trg_on_ride_cancelled
AFTER UPDATE OF status ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.on_ride_cancelled();

-- 2. Create ride_requests table (Preserves booking history: ON DELETE RESTRICT)
CREATE TABLE IF NOT EXISTS public.ride_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE RESTRICT,
    passenger_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    seats_requested integer NOT NULL DEFAULT 1 CHECK (seats_requested BETWEEN 1 AND 4),
    total_price numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (total_price >= 0),
    status public.ride_request_status NOT NULL DEFAULT 'pending',
    pickup_note text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Integrity: Prevent duplicate active seat applications for the same ride
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_passenger_ride_request 
    ON public.ride_requests(ride_id, passenger_id) 
    WHERE status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS idx_ride_requests_passenger ON public.ride_requests(passenger_id, status);
CREATE INDEX IF NOT EXISTS idx_ride_requests_ride ON public.ride_requests(ride_id, status);

DROP TRIGGER IF EXISTS trg_ride_requests_updated_at ON public.ride_requests;
CREATE TRIGGER trg_ride_requests_updated_at
BEFORE UPDATE ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Trigger: Prevent drivers from requesting seats on their own rides and protect parameters on update
CREATE OR REPLACE FUNCTION public.protect_ride_request_submission()
RETURNS trigger AS $$
DECLARE
    v_driver_id uuid;
    v_ride_status public.ride_status;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT driver_id, status INTO v_driver_id, v_ride_status
        FROM public.rides
        WHERE id = NEW.ride_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid Ride: Referenced carpool ride does not exist.';
        END IF;

        IF v_ride_status != 'scheduled' THEN
            RAISE EXCEPTION 'Ride Closed: Cannot request seats on a ride that is not scheduled.';
        END IF;

        -- Enforce passenger_id matches authenticated user
        IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
            NEW.passenger_id := auth.uid();
        END IF;

        IF NEW.passenger_id = v_driver_id THEN
            RAISE EXCEPTION 'Invalid Request: Drivers cannot reserve seats on their own carpool rides.';
        END IF;

        NEW.status := 'pending';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF (NEW.ride_id IS DISTINCT FROM OLD.ride_id) OR
           (NEW.passenger_id IS DISTINCT FROM OLD.passenger_id) OR
           (NEW.seats_requested IS DISTINCT FROM OLD.seats_requested) OR
           (NEW.total_price IS DISTINCT FROM OLD.total_price) THEN
            RAISE EXCEPTION 'Immutable Fields: Ride booking core parameters cannot be altered.';
        END IF;

        -- Enforce lifecycle transitions
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

DROP TRIGGER IF EXISTS trg_protect_ride_request_submission ON public.ride_requests;
CREATE TRIGGER trg_protect_ride_request_submission
BEFORE INSERT OR UPDATE ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.protect_ride_request_submission();

-- 4. Atomic Seat Acceptance Function (Row-level lock prevents overbooking)
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

REVOKE EXECUTE ON FUNCTION public.accept_ride_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_ride_request(uuid) TO authenticated, service_role;

-- 5. Seat Restoration on Cancellation (Restores seats exactly once)
CREATE OR REPLACE FUNCTION public.restore_ride_seats_on_cancel()
RETURNS trigger AS $$
BEGIN
    -- Triggered strictly when an accepted request transitions to cancelled
    IF OLD.status = 'accepted' AND NEW.status = 'cancelled' THEN
        UPDATE public.rides
        SET available_seats = available_seats + OLD.seats_requested
        WHERE id = OLD.ride_id;

        -- Notify driver that a passenger cancelled their seat
        INSERT INTO public.notifications (user_id, type, title, message, data)
        SELECT 
            driver_id,
            'ride_cancelled',
            'Passenger Cancelled Seat',
            format('A passenger cancelled %s seat(s) on your scheduled ride to %s.', OLD.seats_requested, destination_name),
            jsonb_build_object('ride_id', id, 'request_id', OLD.id)
        FROM public.rides
        WHERE id = OLD.ride_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_restore_ride_seats_on_cancel ON public.ride_requests;
CREATE TRIGGER trg_restore_ride_seats_on_cancel
AFTER UPDATE OF status ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.restore_ride_seats_on_cancel();
