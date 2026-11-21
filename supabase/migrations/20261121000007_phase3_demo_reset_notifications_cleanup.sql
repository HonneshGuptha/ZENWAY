-- Migration: 20261121000007_phase3_demo_reset_notifications_cleanup.sql
-- Description: Phase 3 Demo-Day Hardening:
--   1. Update public.clean_slate_demo_reset to clear lingering notifications for admin and demo accounts.
--   2. Broaden demo account identification (university_name, email, or full_name containing 'demo'/'test'/'example.com').
--   3. Strictly preserve real student profiles, real student_verifications, and audit_logs.

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
    v_notifications_deleted integer := 0;
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
           OR reporter_id IN (
               SELECT id FROM public.profiles
               WHERE university_name ILIKE '%demo%'
                  OR university_name ILIKE '%test%'
                  OR email ILIKE '%demo%'
                  OR email ILIKE '%test%'
                  OR email ILIKE '%example.com%'
                  OR full_name ILIKE '%demo%'
           )
           OR respondent_id IN (
               SELECT id FROM public.profiles
               WHERE university_name ILIKE '%demo%'
                  OR university_name ILIKE '%test%'
                  OR email ILIKE '%demo%'
                  OR email ILIKE '%test%'
                  OR email ILIKE '%example.com%'
                  OR full_name ILIKE '%demo%'
           )
        RETURNING id
    )
    SELECT count(*) INTO v_disputes_deleted FROM del_disputes;

    -- B. Reviews created by or for demo users / admin
    WITH del_reviews AS (
        DELETE FROM public.reviews
        WHERE reviewer_id = v_admin_id OR reviewee_id = v_admin_id
           OR reviewer_id IN (
               SELECT id FROM public.profiles
               WHERE university_name ILIKE '%demo%'
                  OR university_name ILIKE '%test%'
                  OR email ILIKE '%demo%'
                  OR email ILIKE '%test%'
                  OR email ILIKE '%example.com%'
                  OR full_name ILIKE '%demo%'
           )
           OR reviewee_id IN (
               SELECT id FROM public.profiles
               WHERE university_name ILIKE '%demo%'
                  OR university_name ILIKE '%test%'
                  OR email ILIKE '%demo%'
                  OR email ILIKE '%test%'
                  OR email ILIKE '%example.com%'
                  OR full_name ILIKE '%demo%'
           )
        RETURNING id
    )
    SELECT count(*) INTO v_reviews_deleted FROM del_reviews;

    -- C. Carry offers and requests by demo users / admin
    DELETE FROM public.carry_offers
    WHERE carrier_id = v_admin_id
       OR carrier_id IN (
           SELECT id FROM public.profiles
           WHERE university_name ILIKE '%demo%'
              OR university_name ILIKE '%test%'
              OR email ILIKE '%demo%'
              OR email ILIKE '%test%'
              OR email ILIKE '%example.com%'
              OR full_name ILIKE '%demo%'
       )
       OR request_id IN (
           SELECT id FROM public.carry_requests
           WHERE requester_id = v_admin_id
              OR requester_id IN (
                  SELECT id FROM public.profiles
                  WHERE university_name ILIKE '%demo%'
                     OR university_name ILIKE '%test%'
                     OR email ILIKE '%demo%'
                     OR email ILIKE '%test%'
                     OR email ILIKE '%example.com%'
                     OR full_name ILIKE '%demo%'
              )
       );

    WITH del_carry AS (
        DELETE FROM public.carry_requests
        WHERE requester_id = v_admin_id
           OR requester_id IN (
               SELECT id FROM public.profiles
               WHERE university_name ILIKE '%demo%'
                  OR university_name ILIKE '%test%'
                  OR email ILIKE '%demo%'
                  OR email ILIKE '%test%'
                  OR email ILIKE '%example.com%'
                  OR full_name ILIKE '%demo%'
           )
        RETURNING id
    )
    SELECT count(*) INTO v_carry_deleted FROM del_carry;

    -- D. Ride requests and rides by demo users / admin
    DELETE FROM public.ride_requests
    WHERE passenger_id = v_admin_id
       OR passenger_id IN (
           SELECT id FROM public.profiles
           WHERE university_name ILIKE '%demo%'
              OR university_name ILIKE '%test%'
              OR email ILIKE '%demo%'
              OR email ILIKE '%test%'
              OR email ILIKE '%example.com%'
              OR full_name ILIKE '%demo%'
       )
       OR ride_id IN (
           SELECT id FROM public.rides
           WHERE driver_id = v_admin_id
              OR driver_id IN (
                  SELECT id FROM public.profiles
                  WHERE university_name ILIKE '%demo%'
                     OR university_name ILIKE '%test%'
                     OR email ILIKE '%demo%'
                     OR email ILIKE '%test%'
                     OR email ILIKE '%example.com%'
                     OR full_name ILIKE '%demo%'
              )
       );

    WITH del_rides AS (
        DELETE FROM public.rides
        WHERE driver_id = v_admin_id
           OR driver_id IN (
               SELECT id FROM public.profiles
               WHERE university_name ILIKE '%demo%'
                  OR university_name ILIKE '%test%'
                  OR email ILIKE '%demo%'
                  OR email ILIKE '%test%'
                  OR email ILIKE '%example.com%'
                  OR full_name ILIKE '%demo%'
           )
        RETURNING id
    )
    SELECT count(*) INTO v_rides_deleted FROM del_rides;

    -- E. Rental requests and vehicles by demo users / admin
    DELETE FROM public.rental_requests
    WHERE renter_id = v_admin_id OR owner_id = v_admin_id
       OR renter_id IN (
           SELECT id FROM public.profiles
           WHERE university_name ILIKE '%demo%'
              OR university_name ILIKE '%test%'
              OR email ILIKE '%demo%'
              OR email ILIKE '%test%'
              OR email ILIKE '%example.com%'
              OR full_name ILIKE '%demo%'
       )
       OR owner_id IN (
           SELECT id FROM public.profiles
           WHERE university_name ILIKE '%demo%'
              OR university_name ILIKE '%test%'
              OR email ILIKE '%demo%'
              OR email ILIKE '%test%'
              OR email ILIKE '%example.com%'
              OR full_name ILIKE '%demo%'
       )
       OR vehicle_id IN (
           SELECT id FROM public.vehicles
           WHERE owner_id = v_admin_id
              OR owner_id IN (
                  SELECT id FROM public.profiles
                  WHERE university_name ILIKE '%demo%'
                     OR university_name ILIKE '%test%'
                     OR email ILIKE '%demo%'
                     OR email ILIKE '%test%'
                     OR email ILIKE '%example.com%'
                     OR full_name ILIKE '%demo%'
              )
       );

    DELETE FROM public.vehicle_images
    WHERE vehicle_id IN (
        SELECT id FROM public.vehicles
        WHERE owner_id = v_admin_id
           OR owner_id IN (
               SELECT id FROM public.profiles
               WHERE university_name ILIKE '%demo%'
                  OR university_name ILIKE '%test%'
                  OR email ILIKE '%demo%'
                  OR email ILIKE '%test%'
                  OR email ILIKE '%example.com%'
                  OR full_name ILIKE '%demo%'
           )
    );

    WITH del_vehicles AS (
        DELETE FROM public.vehicles
        WHERE owner_id = v_admin_id
           OR owner_id IN (
               SELECT id FROM public.profiles
               WHERE university_name ILIKE '%demo%'
                  OR university_name ILIKE '%test%'
                  OR email ILIKE '%demo%'
                  OR email ILIKE '%test%'
                  OR email ILIKE '%example.com%'
                  OR full_name ILIKE '%demo%'
           )
        RETURNING id
    )
    SELECT count(*) INTO v_vehicles_deleted FROM del_vehicles;

    -- F. Clear lingering notifications for admin and demo users
    WITH del_notifications AS (
        DELETE FROM public.notifications
        WHERE user_id = v_admin_id
           OR user_id IN (
               SELECT id FROM public.profiles
               WHERE university_name ILIKE '%demo%'
                  OR university_name ILIKE '%test%'
                  OR email ILIKE '%demo%'
                  OR email ILIKE '%test%'
                  OR email ILIKE '%example.com%'
                  OR full_name ILIKE '%demo%'
           )
        RETURNING id
    )
    SELECT count(*) INTO v_notifications_deleted FROM del_notifications;

    -- G. Audit log the clean slate reset
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
            'disputes_deleted', v_disputes_deleted,
            'notifications_deleted', v_notifications_deleted
        )
    );

    v_deleted_counts := jsonb_build_object(
        'success', true,
        'vehicles_deleted', v_vehicles_deleted,
        'rides_deleted', v_rides_deleted,
        'carry_deleted', v_carry_deleted,
        'reviews_deleted', v_reviews_deleted,
        'disputes_deleted', v_disputes_deleted,
        'notifications_deleted', v_notifications_deleted
    );

    RETURN v_deleted_counts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.clean_slate_demo_reset(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clean_slate_demo_reset(text) TO authenticated, service_role;
