-- Migration: 20261121000003_contact_reveal_rpc.sql
-- Description: Implements secure Post-Acceptance Contact Reveal RPC for Rentals, Carpool, and Carry Items.

-- 1. Ensure phone column exists on profiles (alongside phone_number)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone text NULL;

-- Backfill phone from phone_number if available
UPDATE public.profiles
SET phone = phone_number
WHERE phone IS NULL AND phone_number IS NOT NULL;

-- Grant column-level update privilege so users can update their phone/phone_number
GRANT UPDATE (phone) ON public.profiles TO authenticated;

-- Sync trigger to keep phone and phone_number aligned
CREATE OR REPLACE FUNCTION public.sync_profile_phone_fields()
RETURNS trigger AS $$
BEGIN
    IF NEW.phone IS DISTINCT FROM OLD.phone AND NEW.phone IS NOT NULL THEN
        NEW.phone_number := NEW.phone;
    ELSIF NEW.phone_number IS DISTINCT FROM OLD.phone_number AND NEW.phone_number IS NOT NULL THEN
        NEW.phone := NEW.phone_number;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_sync_profile_phone_fields ON public.profiles;
CREATE TRIGGER trg_sync_profile_phone_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_phone_fields();

-- 2. Secure Post-Acceptance Contact Reveal RPC
-- Returns contact details of the counterpart ONLY if the caller is an authorized party
-- AND the request status is confirmed/accepted.
CREATE OR REPLACE FUNCTION public.get_accepted_contact(
    p_service text,
    p_request_id uuid
)
RETURNS TABLE (
    full_name text,
    phone text,
    email text
) AS $$
DECLARE
    v_caller_id uuid;
    v_other_party_id uuid;
    v_status text;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN;
    END IF;

    -- Rentals
    IF lower(p_service) IN ('rental', 'rent', 'rental_requests') THEN
        SELECT 
            status::text,
            CASE 
                WHEN renter_id = v_caller_id THEN owner_id
                WHEN owner_id = v_caller_id THEN renter_id
                ELSE NULL
            END
        INTO v_status, v_other_party_id
        FROM public.rental_requests
        WHERE id = p_request_id;

        IF v_status NOT IN ('accepted', 'active', 'completed') OR v_other_party_id IS NULL THEN
            RETURN;
        END IF;

    -- Carpool / Rides
    ELSIF lower(p_service) IN ('ride', 'rides', 'carpool', 'ride_requests') THEN
        SELECT 
            rq.status::text,
            CASE 
                WHEN rq.passenger_id = v_caller_id THEN r.driver_id
                WHEN r.driver_id = v_caller_id THEN rq.passenger_id
                ELSE NULL
            END
        INTO v_status, v_other_party_id
        FROM public.ride_requests rq
        JOIN public.rides r ON r.id = rq.ride_id
        WHERE rq.id = p_request_id;

        IF v_status NOT IN ('accepted', 'completed') OR v_other_party_id IS NULL THEN
            RETURN;
        END IF;

    -- Carry Items
    ELSIF lower(p_service) IN ('carry', 'carry_requests', 'carry_item', 'carry_items') THEN
        SELECT 
            status::text,
            CASE 
                WHEN requester_id = v_caller_id THEN assigned_carrier_id
                WHEN assigned_carrier_id = v_caller_id THEN requester_id
                ELSE NULL
            END
        INTO v_status, v_other_party_id
        FROM public.carry_requests
        WHERE id = p_request_id;

        IF v_status NOT IN ('accepted', 'in_transit', 'delivered', 'completed') OR v_other_party_id IS NULL THEN
            RETURN;
        END IF;

    ELSE
        RETURN;
    END IF;

    -- Return the counterpart's verified contact information
    RETURN QUERY
    SELECT 
        p.full_name::text,
        COALESCE(NULLIF(p.phone, ''), NULLIF(p.phone_number, ''))::text AS phone,
        COALESCE(NULLIF(p.email, ''), NULLIF(u.email::text, ''))::text AS email
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.id = v_other_party_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_accepted_contact(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_accepted_contact(text, uuid) TO authenticated, service_role;
