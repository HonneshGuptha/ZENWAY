-- Migration: 20261110000010_rls_policies_all_tables.sql
-- Description: Enables Row Level Security (RLS) on all 12 tables and deploys comprehensive actor-specific policies

-- ============================================================================
-- 1. PROFILES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public" ON public.profiles
    FOR SELECT TO authenticated, anon
    USING (true);

-- Direct client profile creation is prohibited; handled by handle_new_user auth trigger
DROP POLICY IF EXISTS "profiles_insert_system" ON public.profiles;
CREATE POLICY "profiles_insert_system" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (false);

DROP POLICY IF EXISTS "profiles_update_owner" ON public.profiles;
CREATE POLICY "profiles_update_owner" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- ============================================================================
-- 2. STUDENT_VERIFICATIONS
-- ============================================================================
ALTER TABLE public.student_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_verifications_select" ON public.student_verifications;
CREATE POLICY "student_verifications_select" ON public.student_verifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "student_verifications_insert" ON public.student_verifications;
CREATE POLICY "student_verifications_insert" ON public.student_verifications
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "student_verifications_update_admin" ON public.student_verifications;
CREATE POLICY "student_verifications_update_admin" ON public.student_verifications
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "student_verifications_delete_admin" ON public.student_verifications;
CREATE POLICY "student_verifications_delete_admin" ON public.student_verifications
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- ============================================================================
-- 3. VEHICLES
-- ============================================================================
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicles_select_browse" ON public.vehicles;
CREATE POLICY "vehicles_select_browse" ON public.vehicles
    FOR SELECT TO authenticated, anon
    USING (
        status = 'available' 
        OR (auth.uid() IS NOT NULL AND (owner_id = auth.uid() OR public.is_admin()))
    );

DROP POLICY IF EXISTS "vehicles_insert_verified" ON public.vehicles;
CREATE POLICY "vehicles_insert_verified" ON public.vehicles
    FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid() AND public.is_verified_student());

DROP POLICY IF EXISTS "vehicles_update_owner" ON public.vehicles;
CREATE POLICY "vehicles_update_owner" ON public.vehicles
    FOR UPDATE TO authenticated
    USING (owner_id = auth.uid() OR public.is_admin())
    WITH CHECK (owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "vehicles_delete_owner" ON public.vehicles;
CREATE POLICY "vehicles_delete_owner" ON public.vehicles
    FOR DELETE TO authenticated
    USING (owner_id = auth.uid() OR public.is_admin());

-- ============================================================================
-- 4. VEHICLE_IMAGES
-- ============================================================================
ALTER TABLE public.vehicle_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_images_select" ON public.vehicle_images;
CREATE POLICY "vehicle_images_select" ON public.vehicle_images
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "vehicle_images_insert_owner" ON public.vehicle_images;
CREATE POLICY "vehicle_images_insert_owner" ON public.vehicle_images
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.vehicles 
            WHERE vehicles.id = vehicle_images.vehicle_id 
              AND (vehicles.owner_id = auth.uid() OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS "vehicle_images_update_owner" ON public.vehicle_images;
CREATE POLICY "vehicle_images_update_owner" ON public.vehicle_images
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.vehicles 
            WHERE vehicles.id = vehicle_images.vehicle_id 
              AND (vehicles.owner_id = auth.uid() OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS "vehicle_images_delete_owner" ON public.vehicle_images;
CREATE POLICY "vehicle_images_delete_owner" ON public.vehicle_images
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.vehicles 
            WHERE vehicles.id = vehicle_images.vehicle_id 
              AND (vehicles.owner_id = auth.uid() OR public.is_admin())
        )
    );

-- ============================================================================
-- 5. RENTAL_REQUESTS
-- ============================================================================
ALTER TABLE public.rental_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rental_requests_select_parties" ON public.rental_requests;
CREATE POLICY "rental_requests_select_parties" ON public.rental_requests
    FOR SELECT TO authenticated
    USING (renter_id = auth.uid() OR owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "rental_requests_insert_verified" ON public.rental_requests;
CREATE POLICY "rental_requests_insert_verified" ON public.rental_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        renter_id = auth.uid() 
        AND public.is_verified_student()
        AND renter_id != owner_id
        AND status = 'pending'
    );

-- Status lifecycle updates:
-- Acceptance is routed via accept_rental_request().
-- Direct updates allow cancellation (renter/owner) or activation/completion (owner/admin).
DROP POLICY IF EXISTS "rental_requests_update_lifecycle" ON public.rental_requests;
CREATE POLICY "rental_requests_update_lifecycle" ON public.rental_requests
    FOR UPDATE TO authenticated
    USING (renter_id = auth.uid() OR owner_id = auth.uid() OR public.is_admin())
    WITH CHECK (
        (status IN ('cancelled', 'rejected') AND (renter_id = auth.uid() OR owner_id = auth.uid()))
        OR (status IN ('active', 'completed') AND (owner_id = auth.uid() OR public.is_admin()))
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "rental_requests_delete_admin" ON public.rental_requests;
CREATE POLICY "rental_requests_delete_admin" ON public.rental_requests
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- ============================================================================
-- 6. RIDES
-- ============================================================================
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rides_select_feed" ON public.rides;
CREATE POLICY "rides_select_feed" ON public.rides
    FOR SELECT TO authenticated, anon
    USING (
        status = 'scheduled' 
        OR (auth.uid() IS NOT NULL AND (driver_id = auth.uid() OR public.is_admin()))
    );

DROP POLICY IF EXISTS "rides_insert_driver" ON public.rides;
CREATE POLICY "rides_insert_driver" ON public.rides
    FOR INSERT TO authenticated
    WITH CHECK (driver_id = auth.uid() AND public.is_verified_student());

DROP POLICY IF EXISTS "rides_update_driver" ON public.rides;
CREATE POLICY "rides_update_driver" ON public.rides
    FOR UPDATE TO authenticated
    USING (driver_id = auth.uid() OR public.is_admin())
    WITH CHECK (driver_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "rides_delete_driver" ON public.rides;
CREATE POLICY "rides_delete_driver" ON public.rides
    FOR DELETE TO authenticated
    USING (driver_id = auth.uid() OR public.is_admin());

-- ============================================================================
-- 7. RIDE_REQUESTS
-- ============================================================================
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ride_requests_select_parties" ON public.ride_requests;
CREATE POLICY "ride_requests_select_parties" ON public.ride_requests
    FOR SELECT TO authenticated
    USING (
        passenger_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.rides 
            WHERE rides.id = ride_requests.ride_id 
              AND rides.driver_id = auth.uid()
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "ride_requests_insert_passenger" ON public.ride_requests;
CREATE POLICY "ride_requests_insert_passenger" ON public.ride_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        passenger_id = auth.uid() 
        AND public.is_verified_student()
        AND status = 'pending'
    );

-- Direct client updates allow passengers to cancel their seat
-- Acceptance is routed via accept_ride_request()
DROP POLICY IF EXISTS "ride_requests_update_passenger_cancel" ON public.ride_requests;
CREATE POLICY "ride_requests_update_passenger_cancel" ON public.ride_requests
    FOR UPDATE TO authenticated
    USING (passenger_id = auth.uid() OR public.is_admin())
    WITH CHECK (status = 'cancelled' OR public.is_admin());

DROP POLICY IF EXISTS "ride_requests_delete_admin" ON public.ride_requests;
CREATE POLICY "ride_requests_delete_admin" ON public.ride_requests
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- ============================================================================
-- 8. CARRY_REQUESTS
-- ============================================================================
ALTER TABLE public.carry_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carry_requests_select_feed" ON public.carry_requests;
CREATE POLICY "carry_requests_select_feed" ON public.carry_requests
    FOR SELECT TO authenticated, anon
    USING (
        status = 'open' 
        OR (auth.uid() IS NOT NULL AND (requester_id = auth.uid() OR assigned_carrier_id = auth.uid() OR public.is_admin()))
    );

DROP POLICY IF EXISTS "carry_requests_insert_requester" ON public.carry_requests;
CREATE POLICY "carry_requests_insert_requester" ON public.carry_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        requester_id = auth.uid() 
        AND public.is_verified_student()
        AND status = 'open'
    );

DROP POLICY IF EXISTS "carry_requests_update_parties" ON public.carry_requests;
CREATE POLICY "carry_requests_update_parties" ON public.carry_requests
    FOR UPDATE TO authenticated
    USING (requester_id = auth.uid() OR assigned_carrier_id = auth.uid() OR public.is_admin())
    WITH CHECK (
        (requester_id = auth.uid() AND status IN ('open', 'cancelled'))
        OR (assigned_carrier_id = auth.uid() AND status IN ('in_transit', 'delivered', 'cancelled'))
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "carry_requests_delete_admin" ON public.carry_requests;
CREATE POLICY "carry_requests_delete_admin" ON public.carry_requests
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- ============================================================================
-- 9. CARRY_OFFERS
-- ============================================================================
ALTER TABLE public.carry_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carry_offers_select_parties" ON public.carry_offers;
CREATE POLICY "carry_offers_select_parties" ON public.carry_offers
    FOR SELECT TO authenticated
    USING (
        carrier_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.carry_requests 
            WHERE carry_requests.id = carry_offers.request_id 
              AND carry_requests.requester_id = auth.uid()
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "carry_offers_insert_carrier" ON public.carry_offers;
CREATE POLICY "carry_offers_insert_carrier" ON public.carry_offers
    FOR INSERT TO authenticated
    WITH CHECK (
        carrier_id = auth.uid() 
        AND public.is_verified_student()
        AND status = 'pending'
    );

DROP POLICY IF EXISTS "carry_offers_update_carrier" ON public.carry_offers;
CREATE POLICY "carry_offers_update_carrier" ON public.carry_offers
    FOR UPDATE TO authenticated
    USING (carrier_id = auth.uid() OR public.is_admin())
    WITH CHECK (status = 'cancelled' OR public.is_admin());

DROP POLICY IF EXISTS "carry_offers_delete_admin" ON public.carry_offers;
CREATE POLICY "carry_offers_delete_admin" ON public.carry_offers
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- ============================================================================
-- 10. REVIEWS
-- ============================================================================
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_public" ON public.reviews;
CREATE POLICY "reviews_select_public" ON public.reviews
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "reviews_insert_verified" ON public.reviews;
CREATE POLICY "reviews_insert_verified" ON public.reviews
    FOR INSERT TO authenticated
    WITH CHECK (reviewer_id = auth.uid() AND public.is_verified_student());

DROP POLICY IF EXISTS "reviews_update_forbidden" ON public.reviews;
CREATE POLICY "reviews_update_forbidden" ON public.reviews
    FOR UPDATE TO authenticated
    USING (false);

DROP POLICY IF EXISTS "reviews_delete_admin" ON public.reviews;
CREATE POLICY "reviews_delete_admin" ON public.reviews
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- ============================================================================
-- 11. NOTIFICATIONS
-- ============================================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_recipient" ON public.notifications;
CREATE POLICY "notifications_select_recipient" ON public.notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_system" ON public.notifications;
CREATE POLICY "notifications_insert_system" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (false); -- Inserted exclusively by SECURITY DEFINER triggers and functions

DROP POLICY IF EXISTS "notifications_update_recipient" ON public.notifications;
CREATE POLICY "notifications_update_recipient" ON public.notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_recipient" ON public.notifications;
CREATE POLICY "notifications_delete_recipient" ON public.notifications
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================================
-- 12. AUDIT_LOGS
-- ============================================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "audit_logs_insert_system" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_system" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (false);

DROP POLICY IF EXISTS "audit_logs_update_forbidden" ON public.audit_logs;
CREATE POLICY "audit_logs_update_forbidden" ON public.audit_logs
    FOR UPDATE TO authenticated
    USING (false);

DROP POLICY IF EXISTS "audit_logs_delete_forbidden" ON public.audit_logs;
CREATE POLICY "audit_logs_delete_forbidden" ON public.audit_logs
    FOR DELETE TO authenticated
    USING (false);
