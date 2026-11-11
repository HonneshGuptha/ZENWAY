-- Migration: 20261110000008_reviews_and_validation.sql
-- Description: Creates reviews table with referential integrity constraints and eligibility validation trigger

CREATE TABLE IF NOT EXISTS public.reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_type public.exchange_service NOT NULL,
    rental_request_id uuid NULL REFERENCES public.rental_requests(id) ON DELETE CASCADE,
    ride_request_id uuid NULL REFERENCES public.ride_requests(id) ON DELETE CASCADE,
    carry_request_id uuid NULL REFERENCES public.carry_requests(id) ON DELETE CASCADE,
    reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reviewee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment text NULL CHECK (comment IS NULL OR length(comment) <= 1000),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_review_not_self CHECK (reviewer_id != reviewee_id),
    CONSTRAINT chk_review_single_fk CHECK (
        (exchange_type = 'rent'  AND rental_request_id IS NOT NULL AND ride_request_id IS NULL AND carry_request_id IS NULL) OR
        (exchange_type = 'ride'  AND ride_request_id IS NOT NULL AND rental_request_id IS NULL AND carry_request_id IS NULL) OR
        (exchange_type = 'carry' AND carry_request_id IS NOT NULL AND rental_request_id IS NULL AND ride_request_id IS NULL)
    )
);

-- Integrity: Exactly one review per author per completed booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_rental_review 
    ON public.reviews(rental_request_id, reviewer_id) 
    WHERE rental_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_ride_review 
    ON public.reviews(ride_request_id, reviewer_id) 
    WHERE ride_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_carry_review 
    ON public.reviews(carry_request_id, reviewer_id) 
    WHERE carry_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews(reviewee_id);

-- Review Eligibility and Verification Trigger (Resolves identified review defects)
CREATE OR REPLACE FUNCTION public.validate_review_eligibility()
RETURNS trigger AS $$
DECLARE
    v_rent RECORD;
    v_ride RECORD;
    v_carry RECORD;
BEGIN
    -- Prohibit self-reviewing
    IF NEW.reviewer_id = NEW.reviewee_id THEN
        RAISE EXCEPTION 'Invalid Review: Reviewer and reviewee cannot be the same user.';
    END IF;

    -- Enforce that the reviewer is currently a verified student or admin
    IF NOT public.is_verified_student() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only verified students can submit reviews.';
    END IF;

    -- 1. RENT Exchange Validation
    IF NEW.exchange_type = 'rent' THEN
        SELECT renter_id, owner_id, status
        INTO v_rent
        FROM public.rental_requests
        WHERE id = NEW.rental_request_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid Review: Referenced rental booking does not exist.';
        END IF;

        IF v_rent.status != 'completed' THEN
            RAISE EXCEPTION 'Invalid Review: Reviews can only be submitted for completed rentals (Current status: %).', v_rent.status;
        END IF;

        IF NEW.reviewer_id = v_rent.renter_id THEN
            IF NEW.reviewee_id != v_rent.owner_id THEN
                RAISE EXCEPTION 'Invalid Review: Renter can only review the vehicle owner.';
            END IF;
        ELSIF NEW.reviewer_id = v_rent.owner_id THEN
            IF NEW.reviewee_id != v_rent.renter_id THEN
                RAISE EXCEPTION 'Invalid Review: Vehicle owner can only review the renter.';
            END IF;
        ELSE
            RAISE EXCEPTION 'Invalid Review: Reviewer was not a participant in this rental exchange.';
        END IF;

    -- 2. RIDE Exchange Validation (Corrected logic: Ride MUST be completed AND seat request accepted)
    ELSIF NEW.exchange_type = 'ride' THEN
        SELECT rr.passenger_id, rr.status AS request_status, r.driver_id, r.status AS ride_status
        INTO v_ride
        FROM public.ride_requests rr
        JOIN public.rides r ON r.id = rr.ride_id
        WHERE rr.id = NEW.ride_request_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid Review: Referenced ride request does not exist.';
        END IF;

        IF v_ride.ride_status != 'completed' OR v_ride.request_status != 'accepted' THEN
            RAISE EXCEPTION 'Invalid Review: Reviews can only be submitted when the ride is completed and seat booking was accepted (Ride: %, Request: %).',
                v_ride.ride_status, v_ride.request_status;
        END IF;

        IF NEW.reviewer_id = v_ride.passenger_id THEN
            IF NEW.reviewee_id != v_ride.driver_id THEN
                RAISE EXCEPTION 'Invalid Review: Passenger can only review the ride driver.';
            END IF;
        ELSIF NEW.reviewer_id = v_ride.driver_id THEN
            IF NEW.reviewee_id != v_ride.passenger_id THEN
                RAISE EXCEPTION 'Invalid Review: Driver can only review the confirmed passenger.';
            END IF;
        ELSE
            RAISE EXCEPTION 'Invalid Review: Reviewer was not a participant in this ride exchange.';
        END IF;

    -- 3. CARRY Exchange Validation
    ELSIF NEW.exchange_type = 'carry' THEN
        SELECT requester_id, assigned_carrier_id, status
        INTO v_carry
        FROM public.carry_requests
        WHERE id = NEW.carry_request_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid Review: Referenced carry request does not exist.';
        END IF;

        IF v_carry.status != 'delivered' THEN
            RAISE EXCEPTION 'Invalid Review: Reviews can only be submitted after the item is confirmed delivered (Current status: %).', v_carry.status;
        END IF;

        IF NEW.reviewer_id = v_carry.requester_id THEN
            IF NEW.reviewee_id != v_carry.assigned_carrier_id THEN
                RAISE EXCEPTION 'Invalid Review: Requester can only review the assigned carrier.';
            END IF;
        ELSIF NEW.reviewer_id = v_carry.assigned_carrier_id THEN
            IF NEW.reviewee_id != v_carry.requester_id THEN
                RAISE EXCEPTION 'Invalid Review: Carrier can only review the package requester.';
            END IF;
        ELSE
            RAISE EXCEPTION 'Invalid Review: Reviewer was not a participant in this carry exchange.';
        END IF;
    END IF;

    -- Notify reviewee
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
        NEW.reviewee_id,
        'review_received',
        'New Peer Review Received',
        format('You received a %s-star rating for a recent %s exchange.', NEW.rating, NEW.exchange_type),
        jsonb_build_object('review_id', NEW.id, 'exchange_type', NEW.exchange_type)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_review_eligibility ON public.reviews;
CREATE TRIGGER trg_validate_review_eligibility
BEFORE INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_review_eligibility();
