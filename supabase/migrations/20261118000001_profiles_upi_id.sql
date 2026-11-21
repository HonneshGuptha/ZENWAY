-- Migration: 20261118000001_profiles_upi_id.sql
-- Description: Adds profiles.upi_id for peer-to-peer UPI settlement, exposes it on the
-- public_profiles view only to confirmed exchange counterparts (same disclosure rules as
-- phone_number), and grants column-level SELECT/UPDATE privileges.

-- 1. Column on profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS upi_id text NULL;

-- Validate shape when present: handle@psp (e.g. student@oksbi). Kept permissive on length
-- to avoid breaking legacy rows; CHECK only applies to non-null values.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'profiles_upi_id_format'
          AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_upi_id_format
        CHECK (upi_id IS NULL OR (length(upi_id) BETWEEN 6 AND 40 AND upi_id ~ '^[a-zA-Z0-9._-]{2,32}@[a-zA-Z]{2,15}$'));
    END IF;
END $$;

COMMENT ON COLUMN public.profiles.upi_id IS 'UPI payment handle (handle@psp) used for peer settlement in RIDE/RENT flows.';

-- 2. Rebuild public_profiles with gated upi_id disclosure
-- Mirrors the phone_number counterpart rules; upi_id is additionally visible once a
-- transaction reached 'completed' so past dues can still be settled manually.
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

        ELSE NULL
    END AS upi_id
FROM public.profiles p;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- 3. Column-level privileges on profiles (re-applied because ADD COLUMN inherits no grants)
GRANT SELECT (id, full_name, university_name, avatar_url, bio, role, verification_status, created_at, updated_at, upi_id)
    ON public.profiles TO authenticated, anon;
GRANT UPDATE (full_name, phone_number, university_name, avatar_url, bio, upi_id, updated_at)
    ON public.profiles TO authenticated;

-- Note: trg_protect_profile_sensitive_columns only guards role and verification_status,
-- so self-service UPDATE of upi_id passes without trigger changes.
