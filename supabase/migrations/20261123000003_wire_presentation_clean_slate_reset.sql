-- Migration: 20261123000003_wire_presentation_clean_slate_reset.sql
-- Description: Allow 'RESET' confirmation token on execute_presentation_clean_slate_reset and link clean_slate_demo_reset

CREATE OR REPLACE FUNCTION public.execute_presentation_clean_slate_reset(p_confirmation_token text)
RETURNS jsonb AS $$
DECLARE
    v_actor_id uuid;
    v_reviews_del int := 0;
    v_disputes_del int := 0;
    v_carry_offers_del int := 0;
    v_ride_requests_del int := 0;
    v_rental_requests_del int := 0;
    v_vehicle_images_del int := 0;
    v_notifications_del int := 0;
    v_carry_requests_del int := 0;
    v_rides_del int := 0;
    v_vehicles_del int := 0;
    
    v_profiles_preserved int := 0;
    v_verifications_preserved int := 0;
    v_audit_logs_preserved int := 0;
    v_localities_preserved int := 0;
    v_admin_sessions_preserved int := 0;
BEGIN
    -- Accept either RESET or PRESENTATION_CLEAN_SLATE_CONFIRMED
    IF p_confirmation_token IS DISTINCT FROM 'RESET' AND p_confirmation_token IS DISTINCT FROM 'PRESENTATION_CLEAN_SLATE_CONFIRMED' THEN
        RAISE EXCEPTION 'Access Denied: You must supply the exact confirmation token RESET.';
    END IF;

    -- Security Guard: Admin role verification
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Administrator standing required to execute presentation clean-slate reset.';
    END IF;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        SELECT id INTO v_actor_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
        IF v_actor_id IS NULL THEN
            SELECT id INTO v_actor_id FROM public.profiles LIMIT 1;
        END IF;
    END IF;

    -- Strictly verify record counts of preserved tables before reset
    SELECT count(*) INTO v_profiles_preserved FROM public.profiles;
    SELECT count(*) INTO v_verifications_preserved FROM public.student_verifications;
    SELECT count(*) INTO v_localities_preserved FROM public.campus_localities;
    SELECT count(*) INTO v_admin_sessions_preserved FROM public.admin_sessions;

    -- Level 1: Child / Dependent tables (Respecting foreign keys and requiring WHERE clause)
    WITH d AS (DELETE FROM public.reviews WHERE id IS NOT NULL RETURNING id) SELECT count(*) INTO v_reviews_del FROM d;
    WITH d AS (DELETE FROM public.disputes WHERE id IS NOT NULL RETURNING id) SELECT count(*) INTO v_disputes_del FROM d;
    WITH d AS (DELETE FROM public.carry_offers WHERE id IS NOT NULL RETURNING id) SELECT count(*) INTO v_carry_offers_del FROM d;
    WITH d AS (DELETE FROM public.ride_requests WHERE id IS NOT NULL RETURNING id) SELECT count(*) INTO v_ride_requests_del FROM d;
    WITH d AS (DELETE FROM public.rental_requests WHERE id IS NOT NULL RETURNING id) SELECT count(*) INTO v_rental_requests_del FROM d;
    WITH d AS (DELETE FROM public.vehicle_images WHERE id IS NOT NULL RETURNING id) SELECT count(*) INTO v_vehicle_images_del FROM d;
    WITH d AS (DELETE FROM public.notifications WHERE id IS NOT NULL RETURNING id) SELECT count(*) INTO v_notifications_del FROM d;

    -- Level 2: Parent tables
    WITH d AS (DELETE FROM public.carry_requests WHERE id IS NOT NULL RETURNING id) SELECT count(*) INTO v_carry_requests_del FROM d;
    WITH d AS (DELETE FROM public.rides WHERE id IS NOT NULL RETURNING id) SELECT count(*) INTO v_rides_del FROM d;
    WITH d AS (DELETE FROM public.vehicles WHERE id IS NOT NULL RETURNING id) SELECT count(*) INTO v_vehicles_del FROM d;

    -- Append audit log entry for the reset
    INSERT INTO public.audit_logs (
        actor_id,
        action,
        target_entity,
        target_id,
        details,
        created_at
    ) VALUES (
        COALESCE(v_actor_id, '00000000-0000-0000-0000-000000000000'::uuid),
        'PRESENTATION_CLEAN_SLATE_RESET',
        'system',
        COALESCE(v_actor_id, '00000000-0000-0000-0000-000000000000'::uuid),
        jsonb_build_object(
            'reviews_deleted', v_reviews_del,
            'disputes_deleted', v_disputes_del,
            'carry_offers_deleted', v_carry_offers_del,
            'ride_requests_deleted', v_ride_requests_del,
            'rental_requests_deleted', v_rental_requests_del,
            'vehicle_images_deleted', v_vehicle_images_del,
            'notifications_deleted', v_notifications_del,
            'carry_requests_deleted', v_carry_requests_del,
            'rides_deleted', v_rides_del,
            'vehicles_deleted', v_vehicles_del,
            'profiles_preserved', v_profiles_preserved,
            'student_verifications_preserved', v_verifications_preserved
        ),
        now()
    );

    SELECT count(*) INTO v_audit_logs_preserved FROM public.audit_logs;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_counts', jsonb_build_object(
            'reviews', v_reviews_del,
            'disputes', v_disputes_del,
            'carry_offers', v_carry_offers_del,
            'ride_requests', v_ride_requests_del,
            'rental_requests', v_rental_requests_del,
            'vehicle_images', v_vehicle_images_del,
            'notifications', v_notifications_del,
            'carry_requests', v_carry_requests_del,
            'rides', v_rides_del,
            'vehicles', v_vehicles_del,
            'total_deleted', (v_reviews_del + v_disputes_del + v_carry_offers_del + v_ride_requests_del + v_rental_requests_del + v_vehicle_images_del + v_notifications_del + v_carry_requests_del + v_rides_del + v_vehicles_del)
        ),
        'preserved_counts', jsonb_build_object(
            'profiles', v_profiles_preserved,
            'student_verifications', v_verifications_preserved,
            'audit_logs', v_audit_logs_preserved,
            'campus_localities', v_localities_preserved,
            'admin_sessions', v_admin_sessions_preserved
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.execute_presentation_clean_slate_reset(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_presentation_clean_slate_reset(text) TO authenticated, service_role;

-- Re-wire legacy clean_slate_demo_reset to call execute_presentation_clean_slate_reset
CREATE OR REPLACE FUNCTION public.clean_slate_demo_reset(p_confirmation_token text)
RETURNS jsonb AS $$
BEGIN
    RETURN public.execute_presentation_clean_slate_reset(p_confirmation_token);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.clean_slate_demo_reset(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clean_slate_demo_reset(text) TO authenticated, service_role;
