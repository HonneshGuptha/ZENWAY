-- Migration: 20261110000005_rent_module.sql
-- Description: Creates vehicles, vehicle_images, and rental_requests with GiST exclusion, lifecycle integrity, and atomic approval

-- 1. Create vehicles table
CREATE TABLE IF NOT EXISTS public.vehicles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    type public.vehicle_type NOT NULL,
    title text NOT NULL CHECK (length(trim(title)) >= 4),
    description text NOT NULL CHECK (length(trim(description)) >= 10),
    brand_model text NULL,
    hourly_rate numeric(10,2) NULL CHECK (hourly_rate IS NULL OR hourly_rate > 0),
    daily_rate numeric(10,2) NULL CHECK (daily_rate IS NULL OR daily_rate > 0),
    deposit_amount numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (deposit_amount >= 0),
    pickup_location text NOT NULL,
    latitude double precision NULL CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
    longitude double precision NULL CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
    status public.listing_status NOT NULL DEFAULT 'available',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_vehicle_has_rate CHECK (hourly_rate IS NOT NULL OR daily_rate IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON public.vehicles(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_browse ON public.vehicles(type, status) WHERE status = 'available';

DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER trg_vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: Ensure vehicle listing owner_id matches auth.uid()
CREATE OR REPLACE FUNCTION public.protect_vehicle_owner()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
            NEW.owner_id := auth.uid();
        END IF;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF NEW.owner_id IS DISTINCT FROM OLD.owner_id AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Immutable Field: Vehicle owner cannot be transferred.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_vehicle_owner ON public.vehicles;
CREATE TRIGGER trg_protect_vehicle_owner
BEFORE INSERT OR UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.protect_vehicle_owner();

-- 2. Create vehicle_images table
CREATE TABLE IF NOT EXISTS public.vehicle_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    image_path text NOT NULL,
    display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_single_primary_vehicle_image 
    ON public.vehicle_images(vehicle_id) 
    WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_vehicle_images_lookup 
    ON public.vehicle_images(vehicle_id, display_order ASC);

-- 3. Create rental_requests table
CREATE TABLE IF NOT EXISTS public.rental_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
    renter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    start_time timestamptz NOT NULL,
    end_time timestamptz NOT NULL,
    total_price numeric(10,2) NOT NULL CHECK (total_price >= 0),
    deposit_amount numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (deposit_amount >= 0),
    status public.rental_request_status NOT NULL DEFAULT 'pending',
    renter_notes text NULL,
    owner_notes text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_rental_dates CHECK (end_time > start_time),
    CONSTRAINT chk_rental_not_self CHECK (renter_id != owner_id)
);

-- Absolute Database-Level Concurrency Guard: GiST exclusion prevents double-booking
DO $$ BEGIN
    ALTER TABLE public.rental_requests
    ADD CONSTRAINT no_overlapping_accepted_rentals
    EXCLUDE USING gist (
        vehicle_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
    ) WHERE (status IN ('accepted', 'active'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_rental_requests_renter ON public.rental_requests(renter_id, status);
CREATE INDEX IF NOT EXISTS idx_rental_requests_owner ON public.rental_requests(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_rental_requests_vehicle ON public.rental_requests(vehicle_id, status);

DROP TRIGGER IF EXISTS trg_rental_requests_updated_at ON public.rental_requests;
CREATE TRIGGER trg_rental_requests_updated_at
BEFORE UPDATE ON public.rental_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Anti-Forgery & Integrity Trigger: Enforces vehicle owner alignment and prevents forged owner_id / renter_id / lifecycle tampering
CREATE OR REPLACE FUNCTION public.protect_rental_request_owner()
RETURNS trigger AS $$
DECLARE
    v_actual_owner_id uuid;
    v_vehicle_status public.listing_status;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Query authoritative owner and status directly from the vehicle record
        SELECT owner_id, status INTO v_actual_owner_id, v_vehicle_status
        FROM public.vehicles
        WHERE id = NEW.vehicle_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid Vehicle: The referenced vehicle does not exist.';
        END IF;

        IF v_vehicle_status != 'available' THEN
            RAISE EXCEPTION 'Vehicle Unavailable: Cannot request a vehicle that is not currently listed as available.';
        END IF;

        -- Enforce renter_id matches authenticated user
        IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
            NEW.renter_id := auth.uid();
        END IF;

        -- Strictly override any client-supplied owner_id with the authoritative owner_id
        NEW.owner_id := v_actual_owner_id;

        -- Disallow self-rental attempt
        IF NEW.renter_id = NEW.owner_id THEN
            RAISE EXCEPTION 'Invalid Booking: You cannot rent your own vehicle.';
        END IF;

        -- Force initial status to pending
        NEW.status := 'pending';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Immutable critical associations
        IF (NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id) OR
           (NEW.renter_id IS DISTINCT FROM OLD.renter_id) OR
           (NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
            RAISE EXCEPTION 'Immutable Fields: Vehicle, renter, and owner references cannot be modified.';
        END IF;

        -- Prevent modifying schedule or price after confirmation
        IF OLD.status IN ('accepted', 'active', 'completed', 'rejected', 'cancelled') AND 
           (NEW.start_time IS DISTINCT FROM OLD.start_time OR 
            NEW.end_time IS DISTINCT FROM OLD.end_time OR 
            NEW.total_price IS DISTINCT FROM OLD.total_price OR
            NEW.deposit_amount IS DISTINCT FROM OLD.deposit_amount) THEN
            RAISE EXCEPTION 'Immutable Fields: Cannot modify schedule or pricing on an accepted or completed rental.';
        END IF;

        -- Enforce strict lifecycle transitions
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
                ELSIF OLD.status IN ('rejected', 'completed', 'cancelled') THEN
                    RAISE EXCEPTION 'Terminal State: Cannot modify status of a completed, rejected, or cancelled rental.';
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_rental_request_owner ON public.rental_requests;
CREATE TRIGGER trg_protect_rental_request_owner
BEFORE INSERT OR UPDATE ON public.rental_requests
FOR EACH ROW EXECUTE FUNCTION public.protect_rental_request_owner();

-- 5. Atomic Rental Acceptance Function (Auto-rejects conflicting pending requests)
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
    -- 1. Fetch and row-lock the target rental request
    SELECT vehicle_id, renter_id, start_time, end_time, owner_id
    INTO v_vehicle_id, v_renter_id, v_start_time, v_end_time, v_owner_id
    FROM public.rental_requests
    WHERE id = p_request_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rental request not found or not in pending state.';
    END IF;

    -- 2. Authorization check: must be vehicle owner or administrator
    IF v_owner_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only the vehicle owner can accept rental requests.';
    END IF;

    -- 3. Row-lock parent vehicle to serialize approvals
    SELECT title INTO v_vehicle_title
    FROM public.vehicles
    WHERE id = v_vehicle_id
    FOR UPDATE;

    -- 4. Check for overlapping accepted or active rentals
    IF EXISTS (
        SELECT 1 FROM public.rental_requests
        WHERE vehicle_id = v_vehicle_id
          AND status IN ('accepted', 'active')
          AND tstzrange(start_time, end_time, '[)') && tstzrange(v_start_time, v_end_time, '[)')
          AND id != p_request_id
    ) THEN
        RAISE EXCEPTION 'Cannot accept: An accepted or active rental already occupies this time window.';
    END IF;

    -- 5. Transition target booking to accepted
    UPDATE public.rental_requests
    SET status = 'accepted'
    WHERE id = p_request_id;

    -- 6. Atomically auto-reject all conflicting pending requests and dispatch notifications
    FOR v_conflicting_rec IN
        SELECT id, renter_id, start_time, end_time
        FROM public.rental_requests
        WHERE vehicle_id = v_vehicle_id
          AND id != p_request_id
          AND status = 'pending'
          AND tstzrange(start_time, end_time, '[)') && tstzrange(v_start_time, v_end_time, '[)')
        FOR UPDATE
    LOOP
        UPDATE public.rental_requests
        SET status = 'rejected'
        WHERE id = v_conflicting_rec.id;

        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            v_conflicting_rec.renter_id,
            'rental_request_rejected',
            'Rental Request Declined (Time Slot Reserved)',
            format('Your request for "%s" (%s to %s) was declined because another reservation was approved.',
                   v_vehicle_title,
                   to_char(v_conflicting_rec.start_time, 'Mon DD, HH24:MI'),
                   to_char(v_conflicting_rec.end_time, 'Mon DD, HH24:MI')),
            jsonb_build_object('request_id', v_conflicting_rec.id, 'reason', 'slot_unavailable')
        );
    END LOOP;

    -- 7. Notify approved student
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
        v_renter_id,
        'rental_request_accepted',
        'Rental Request Approved!',
        format('Your booking for "%s" has been approved! Meet the owner at the scheduled pickup time.', v_vehicle_title),
        jsonb_build_object('request_id', p_request_id, 'vehicle_id', v_vehicle_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.accept_rental_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_rental_request(uuid) TO authenticated, service_role;
