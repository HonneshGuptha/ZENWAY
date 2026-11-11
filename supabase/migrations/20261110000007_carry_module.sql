-- Migration: 20261110000007_carry_module.sql
-- Description: Creates carry_requests and carry_offers with atomic single-winner acceptance, lifecycle state machine, and assignment protection

-- 1. Create carry_requests table
CREATE TABLE IF NOT EXISTS public.carry_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    assigned_carrier_id uuid NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    accepted_offer_id uuid NULL, -- Foreign key linked below after carry_offers table creation
    item_title text NOT NULL CHECK (length(trim(item_title)) >= 3),
    item_description text NOT NULL,
    item_size public.package_size NOT NULL DEFAULT 'small_box',
    weight_kg numeric(5,2) NULL CHECK (weight_kg IS NULL OR weight_kg > 0),
    pickup_location text NOT NULL,
    pickup_lat double precision NULL CHECK (pickup_lat IS NULL OR (pickup_lat >= -90 AND pickup_lat <= 90)),
    pickup_lng double precision NULL CHECK (pickup_lng IS NULL OR (pickup_lng >= -180 AND pickup_lng <= 180)),
    delivery_location text NOT NULL,
    delivery_lat double precision NULL CHECK (delivery_lat IS NULL OR (delivery_lat >= -90 AND delivery_lat <= 90)),
    delivery_lng double precision NULL CHECK (delivery_lng IS NULL OR (delivery_lng >= -180 AND delivery_lng <= 180)),
    needed_by timestamptz NOT NULL,
    reward_amount numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (reward_amount >= 0),
    status public.carry_request_status NOT NULL DEFAULT 'open',
    pickup_photo_path text NULL,
    delivery_photo_path text NULL,
    special_instructions text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_carry_carrier_not_requester CHECK (assigned_carrier_id IS NULL OR assigned_carrier_id != requester_id)
);

CREATE INDEX IF NOT EXISTS idx_carry_requests_requester ON public.carry_requests(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_carry_requests_carrier ON public.carry_requests(assigned_carrier_id, status);
CREATE INDEX IF NOT EXISTS idx_carry_requests_open ON public.carry_requests(needed_by ASC, status) WHERE status = 'open';

DROP TRIGGER IF EXISTS trg_carry_requests_updated_at ON public.carry_requests;
CREATE TRIGGER trg_carry_requests_updated_at
BEFORE UPDATE ON public.carry_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: Ensure requester_id matches authenticated user, protect assignment, and enforce strict lifecycle
CREATE OR REPLACE FUNCTION public.protect_carry_request_integrity()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
            NEW.requester_id := auth.uid();
        END IF;
        NEW.assigned_carrier_id := NULL;
        NEW.accepted_offer_id := NULL;
        NEW.status := 'open';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Immutable requester_id
        IF NEW.requester_id IS DISTINCT FROM OLD.requester_id AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Immutable Field: Requester cannot be modified.';
        END IF;

        -- Direct client tampering with assignment fields is forbidden (must use accept_carry_offer)
        IF (NEW.assigned_carrier_id IS DISTINCT FROM OLD.assigned_carrier_id OR 
            NEW.accepted_offer_id IS DISTINCT FROM OLD.accepted_offer_id) THEN
            IF NOT public.is_admin() AND (OLD.status != 'open' OR NEW.status != 'accepted') THEN
                RAISE EXCEPTION 'Access Denied: Carrier assignment can only be modified by accepting an offer.';
            END IF;
        END IF;

        -- Prevent modifying package parameters once confirmed/accepted
        IF OLD.status IN ('accepted', 'in_transit', 'delivered', 'cancelled') AND
           (NEW.item_title IS DISTINCT FROM OLD.item_title OR
            NEW.item_description IS DISTINCT FROM OLD.item_description OR
            NEW.item_size IS DISTINCT FROM OLD.item_size OR
            NEW.weight_kg IS DISTINCT FROM OLD.weight_kg OR
            NEW.pickup_location IS DISTINCT FROM OLD.pickup_location OR
            NEW.delivery_location IS DISTINCT FROM OLD.delivery_location OR
            NEW.reward_amount IS DISTINCT FROM OLD.reward_amount) THEN
            RAISE EXCEPTION 'Immutable Fields: Package specifications and reward cannot be altered once accepted.';
        END IF;

        -- Enforce strict lifecycle transitions (prohibits reopening an accepted request)
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF NOT public.is_admin() THEN
                IF OLD.status = 'open' THEN
                    IF NEW.status = 'cancelled' THEN
                        IF auth.uid() != OLD.requester_id THEN
                            RAISE EXCEPTION 'Access Denied: Only the requester can cancel an open carry request.';
                        END IF;
                    ELSIF NEW.status = 'accepted' THEN
                        IF NEW.assigned_carrier_id IS NULL OR NEW.accepted_offer_id IS NULL THEN
                            RAISE EXCEPTION 'Invalid Transition: Cannot transition to accepted without an offer acceptance.';
                        END IF;
                    ELSE
                        RAISE EXCEPTION 'Invalid Transition: Open carry requests can only transition to accepted or cancelled.';
                    END IF;
                ELSIF OLD.status = 'accepted' THEN
                    IF NEW.status = 'open' THEN
                        RAISE EXCEPTION 'Invalid Transition: An accepted carry request cannot be reopened.';
                    ELSIF NEW.status = 'in_transit' THEN
                        IF auth.uid() != OLD.assigned_carrier_id THEN
                            RAISE EXCEPTION 'Access Denied: Only the assigned carrier can mark package in transit.';
                        END IF;
                    ELSIF NEW.status = 'cancelled' THEN
                        IF auth.uid() != OLD.requester_id AND auth.uid() != OLD.assigned_carrier_id THEN
                            RAISE EXCEPTION 'Access Denied: Only participants can cancel an accepted carry request.';
                        END IF;
                    ELSE
                        RAISE EXCEPTION 'Invalid Transition: Accepted requests can only transition to in_transit or cancelled.';
                    END IF;
                ELSIF OLD.status = 'in_transit' THEN
                    IF NEW.status = 'delivered' THEN
                        IF auth.uid() != OLD.assigned_carrier_id THEN
                            RAISE EXCEPTION 'Access Denied: Only the assigned carrier can mark package delivered.';
                        END IF;
                    ELSE
                        RAISE EXCEPTION 'Invalid Transition: In-transit packages can only transition to delivered.';
                    END IF;
                ELSIF OLD.status IN ('delivered', 'cancelled') THEN
                    RAISE EXCEPTION 'Terminal State: Cannot modify status of a delivered or cancelled carry request.';
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_carry_request_integrity ON public.carry_requests;
CREATE TRIGGER trg_protect_carry_request_integrity
BEFORE INSERT OR UPDATE ON public.carry_requests
FOR EACH ROW EXECUTE FUNCTION public.protect_carry_request_integrity();

-- 2. Create carry_offers table
CREATE TABLE IF NOT EXISTS public.carry_offers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES public.carry_requests(id) ON DELETE CASCADE,
    carrier_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status public.carry_offer_status NOT NULL DEFAULT 'pending',
    message text NULL,
    proposed_delivery_time timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Link carry_requests.accepted_offer_id circular relationship safely
DO $$ BEGIN
    ALTER TABLE public.carry_requests 
    ADD CONSTRAINT fk_carry_accepted_offer 
    FOREIGN KEY (accepted_offer_id) REFERENCES public.carry_offers(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Integrity: A carrier can only have one pending offer per carry request
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_pending_carry_offer 
    ON public.carry_offers(request_id, carrier_id) 
    WHERE status = 'pending';

-- Hard Concurrency Guard: Physical guarantee that at most ONE offer can ever be accepted per request
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_accepted_carry_offer 
    ON public.carry_offers(request_id) 
    WHERE status = 'accepted';

CREATE INDEX IF NOT EXISTS idx_carry_offers_request ON public.carry_offers(request_id, status);
CREATE INDEX IF NOT EXISTS idx_carry_offers_carrier ON public.carry_offers(carrier_id, status);

DROP TRIGGER IF EXISTS trg_carry_offers_updated_at ON public.carry_offers;
CREATE TRIGGER trg_carry_offers_updated_at
BEFORE UPDATE ON public.carry_offers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Trigger: Prevent package requesters from making offers on their own package and enforce carrier identity
CREATE OR REPLACE FUNCTION public.protect_carry_offer_submission()
RETURNS trigger AS $$
DECLARE
    v_requester_id uuid;
    v_request_status public.carry_request_status;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT requester_id, status INTO v_requester_id, v_request_status
        FROM public.carry_requests
        WHERE id = NEW.request_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid Carry Request: Referenced package request does not exist.';
        END IF;

        IF v_request_status != 'open' THEN
            RAISE EXCEPTION 'Request Closed: Offers can only be submitted against open carry requests.';
        END IF;

        -- Enforce carrier_id matches authenticated user
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
            -- Direct client updates can only withdraw own pending offer
            IF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
                IF auth.uid() != OLD.carrier_id THEN
                    RAISE EXCEPTION 'Access Denied: Only the carrier can cancel their pending offer.';
                END IF;
            ELSE
                RAISE EXCEPTION 'Invalid Transition: Direct client updates on carry offers are restricted to cancellation. Offer acceptances must be routed through accept_carry_offer().';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_carry_offer_submission ON public.carry_offers;
CREATE TRIGGER trg_protect_carry_offer_submission
BEFORE INSERT OR UPDATE ON public.carry_offers
FOR EACH ROW EXECUTE FUNCTION public.protect_carry_offer_submission();

-- 4. Atomic Carry Offer Acceptance Function
CREATE OR REPLACE FUNCTION public.accept_carry_offer(p_offer_id uuid)
RETURNS void AS $$
DECLARE
    v_request_id uuid;
    v_carrier_id uuid;
    v_requester_id uuid;
    v_item_title text;
    v_request_status public.carry_request_status;
    v_competing_offer RECORD;
BEGIN
    -- 1. Lock the target offer
    SELECT request_id, carrier_id
    INTO v_request_id, v_carrier_id
    FROM public.carry_offers
    WHERE id = p_offer_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Carry offer not found or not in pending state.';
    END IF;

    -- 2. Lock parent carry request
    SELECT requester_id, status, item_title
    INTO v_requester_id, v_request_status, v_item_title
    FROM public.carry_requests
    WHERE id = v_request_id
    FOR UPDATE;

    -- 3. Authorization check
    IF v_requester_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only the package requester can accept offers.';
    END IF;

    -- 4. Status check
    IF v_request_status != 'open' THEN
        RAISE EXCEPTION 'Cannot accept offer: Carry request is no longer open (Current status: %).', v_request_status;
    END IF;

    -- 5. Accept chosen offer (Protected by idx_single_accepted_carry_offer)
    UPDATE public.carry_offers
    SET status = 'accepted'
    WHERE id = p_offer_id;

    -- 6. Auto-reject competing pending offers and notify carriers
    FOR v_competing_offer IN
        SELECT id, carrier_id
        FROM public.carry_offers
        WHERE request_id = v_request_id
          AND id != p_offer_id
          AND status = 'pending'
        FOR UPDATE
    LOOP
        UPDATE public.carry_offers
        SET status = 'rejected'
        WHERE id = v_competing_offer.id;

        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            v_competing_offer.carrier_id,
            'carry_offer_received',
            'Carry Offer Update',
            format('Another carrier was selected for the delivery of "%s".', v_item_title),
            jsonb_build_object('request_id', v_request_id, 'offer_id', v_competing_offer.id)
        );
    END LOOP;

    -- 7. Update carry request with assigned carrier and reference
    UPDATE public.carry_requests
    SET status = 'accepted',
        assigned_carrier_id = v_carrier_id,
        accepted_offer_id = p_offer_id
    WHERE id = v_request_id;

    -- 8. Notify assigned carrier
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
        v_carrier_id,
        'carry_offer_accepted',
        'Carry Offer Accepted!',
        format('Your offer to carry "%s" was accepted! Please coordinate with the student for pickup.', v_item_title),
        jsonb_build_object('request_id', v_request_id, 'offer_id', p_offer_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.accept_carry_offer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_carry_offer(uuid) TO authenticated, service_role;
