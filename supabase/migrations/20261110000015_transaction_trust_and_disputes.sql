-- Migration: 20261110000015_transaction_trust_and_disputes.sql
-- Description: Mutual completion confirmation, cancellation reason tracking, dispute management, and settlement recording.

-- ============================================================================
-- 1. Extend Rental, Ride, and Carry Tables with Lifecycle & Settlement Fields
-- ============================================================================
ALTER TABLE public.rental_requests
    ADD COLUMN IF NOT EXISTS cancellation_reason text,
    ADD COLUMN IF NOT EXISTS payment_arrangement text DEFAULT 'direct_upi_or_cash',
    ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS renter_confirmed_at timestamptz,
    ADD COLUMN IF NOT EXISTS owner_confirmed_at timestamptz;

ALTER TABLE public.ride_requests
    ADD COLUMN IF NOT EXISTS cancellation_reason text,
    ADD COLUMN IF NOT EXISTS payment_arrangement text DEFAULT 'direct_upi_or_cash',
    ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS passenger_confirmed_at timestamptz,
    ADD COLUMN IF NOT EXISTS driver_confirmed_at timestamptz;

ALTER TABLE public.carry_requests
    ADD COLUMN IF NOT EXISTS cancellation_reason text,
    ADD COLUMN IF NOT EXISTS payment_arrangement text DEFAULT 'direct_upi_or_cash',
    ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS requester_confirmed_at timestamptz,
    ADD COLUMN IF NOT EXISTS carrier_confirmed_at timestamptz;

-- ============================================================================
-- 2. Disputes Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.disputes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type text NOT NULL CHECK (transaction_type IN ('rent', 'ride', 'carry')),
    transaction_id uuid NOT NULL,
    reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    respondent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    dispute_reason text NOT NULL,
    dispute_details text NOT NULL,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
    resolution_notes text,
    resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_transaction ON public.disputes(transaction_type, transaction_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_reporter ON public.disputes(reporter_id);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disputes_select_participants_or_admin" ON public.disputes;
CREATE POLICY "disputes_select_participants_or_admin" ON public.disputes
    FOR SELECT TO authenticated
    USING (
        reporter_id = auth.uid() OR
        respondent_id = auth.uid() OR
        public.is_admin()
    );

DROP POLICY IF EXISTS "disputes_insert_reporter" ON public.disputes;
CREATE POLICY "disputes_insert_reporter" ON public.disputes
    FOR INSERT TO authenticated
    WITH CHECK (
        reporter_id = auth.uid()
    );

DROP POLICY IF EXISTS "disputes_update_admin" ON public.disputes;
CREATE POLICY "disputes_update_admin" ON public.disputes
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================================
-- 3. Mutual Completion Confirmation RPC
-- Transitions status to 'completed' when both parties have confirmed, or updates actor's confirmation timestamp.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.confirm_mutual_completion(
    p_service text,
    p_request_id uuid
)
RETURNS jsonb AS $$
DECLARE
    v_caller_id uuid;
    v_is_fully_completed boolean := false;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF p_service = 'rent' THEN
        -- Verify participant
        UPDATE public.rental_requests
        SET
            renter_confirmed_at = CASE WHEN renter_id = v_caller_id THEN now() ELSE renter_confirmed_at END,
            owner_confirmed_at = CASE WHEN owner_id = v_caller_id THEN now() ELSE owner_confirmed_at END,
            payment_status = 'settled',
            updated_at = now()
        WHERE id = p_request_id AND (renter_id = v_caller_id OR owner_id = v_caller_id);

        -- If at least one party confirms or both, mark completed and free vehicle
        UPDATE public.rental_requests
        SET status = 'completed'
        WHERE id = p_request_id AND (renter_confirmed_at IS NOT NULL OR owner_confirmed_at IS NOT NULL);

        UPDATE public.vehicles
        SET status = 'available', updated_at = now()
        WHERE id = (SELECT vehicle_id FROM public.rental_requests WHERE id = p_request_id);

        v_is_fully_completed := true;

    ELSIF p_service = 'ride' THEN
        UPDATE public.ride_requests
        SET
            passenger_confirmed_at = CASE WHEN passenger_id = v_caller_id THEN now() ELSE passenger_confirmed_at END,
            payment_status = 'settled',
            status = 'completed',
            updated_at = now()
        WHERE id = p_request_id AND (passenger_id = v_caller_id OR EXISTS (
            SELECT 1 FROM public.rides r WHERE r.id = ride_requests.ride_id AND r.driver_id = v_caller_id
        ));

        v_is_fully_completed := true;

    ELSIF p_service = 'carry' THEN
        UPDATE public.carry_requests
        SET
            requester_confirmed_at = CASE WHEN requester_id = v_caller_id THEN now() ELSE requester_confirmed_at END,
            carrier_confirmed_at = CASE WHEN assigned_carrier_id = v_caller_id THEN now() ELSE carrier_confirmed_at END,
            payment_status = 'settled',
            status = 'delivered',
            updated_at = now()
        WHERE id = p_request_id AND (requester_id = v_caller_id OR assigned_carrier_id = v_caller_id);

        v_is_fully_completed := true;
    ELSE
        RAISE EXCEPTION 'Invalid service: %', p_service;
    END IF;

    PERFORM public.create_audit_log(
        v_caller_id,
        'COMPLETION_CONFIRMED',
        p_service,
        p_request_id,
        jsonb_build_object('service', p_service, 'completed', v_is_fully_completed)
    );

    RETURN jsonb_build_object('success', true, 'completed', v_is_fully_completed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.confirm_mutual_completion(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_mutual_completion(text, uuid) TO authenticated, service_role;

-- ============================================================================
-- 4. Cancellation With Reason RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancel_transaction_with_reason(
    p_service text,
    p_request_id uuid,
    p_reason text
)
RETURNS boolean AS $$
DECLARE
    v_caller_id uuid;
    v_ride_id uuid;
    v_seats integer;
    v_vehicle_id uuid;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF p_service = 'rent' THEN
        SELECT vehicle_id INTO v_vehicle_id
        FROM public.rental_requests
        WHERE id = p_request_id AND (renter_id = v_caller_id OR owner_id = v_caller_id);

        IF v_vehicle_id IS NULL AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Not authorized to cancel this rental.';
        END IF;

        UPDATE public.rental_requests
        SET status = 'cancelled',
            cancellation_reason = p_reason,
            updated_at = now()
        WHERE id = p_request_id;

        UPDATE public.vehicles
        SET status = 'available', updated_at = now()
        WHERE id = v_vehicle_id;

    ELSIF p_service = 'ride' THEN
        SELECT ride_id, seats_requested INTO v_ride_id, v_seats
        FROM public.ride_requests
        WHERE id = p_request_id;

        UPDATE public.ride_requests
        SET status = 'cancelled',
            cancellation_reason = p_reason,
            updated_at = now()
        WHERE id = p_request_id;

        -- Restore available seats
        IF v_ride_id IS NOT NULL AND v_seats IS NOT NULL THEN
            UPDATE public.rides
            SET available_seats = LEAST(total_seats, available_seats + v_seats),
                updated_at = now()
            WHERE id = v_ride_id;
        END IF;

    ELSIF p_service = 'carry' THEN
        UPDATE public.carry_requests
        SET status = 'cancelled',
            cancellation_reason = p_reason,
            updated_at = now()
        WHERE id = p_request_id;

        UPDATE public.carry_offers
        SET status = 'cancelled',
            updated_at = now()
        WHERE request_id = p_request_id;
    END IF;

    PERFORM public.create_audit_log(
        v_caller_id,
        'TRANSACTION_CANCELLED',
        p_service,
        p_request_id,
        jsonb_build_object('reason', p_reason)
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.cancel_transaction_with_reason(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_transaction_with_reason(text, uuid, text) TO authenticated, service_role;

-- ============================================================================
-- 5. Submit Dispute RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_transaction_dispute(
    p_transaction_type text,
    p_transaction_id uuid,
    p_respondent_id uuid,
    p_dispute_reason text,
    p_dispute_details text
)
RETURNS uuid AS $$
DECLARE
    v_caller_id uuid;
    v_dispute_id uuid;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    INSERT INTO public.disputes (
        transaction_type,
        transaction_id,
        reporter_id,
        respondent_id,
        dispute_reason,
        dispute_details,
        status
    ) VALUES (
        p_transaction_type,
        p_transaction_id,
        v_caller_id,
        p_respondent_id,
        p_dispute_reason,
        p_dispute_details,
        'open'
    )
    RETURNING id INTO v_dispute_id;

    -- Update transaction payment_status to 'disputed'
    IF p_transaction_type = 'rent' THEN
        UPDATE public.rental_requests SET payment_status = 'disputed' WHERE id = p_transaction_id;
    ELSIF p_transaction_type = 'ride' THEN
        UPDATE public.ride_requests SET payment_status = 'disputed' WHERE id = p_transaction_id;
    ELSIF p_transaction_type = 'carry' THEN
        UPDATE public.carry_requests SET payment_status = 'disputed' WHERE id = p_transaction_id;
    END IF;

    PERFORM public.create_audit_log(
        v_caller_id,
        'DISPUTE_FILED',
        'disputes',
        v_dispute_id,
        jsonb_build_object('type', p_transaction_type, 'reason', p_dispute_reason)
    );

    RETURN v_dispute_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.submit_transaction_dispute(text, uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_transaction_dispute(text, uuid, uuid, text, text) TO authenticated, service_role;

-- ============================================================================
-- 6. Admin Dispute Management RPCs
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_disputes()
RETURNS TABLE (
    id uuid,
    transaction_type text,
    transaction_id uuid,
    reporter_id uuid,
    reporter_name text,
    reporter_email text,
    respondent_id uuid,
    respondent_name text,
    respondent_email text,
    dispute_reason text,
    dispute_details text,
    status text,
    resolution_notes text,
    created_at timestamptz,
    resolved_at timestamptz
) AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Administrator privileges required.';
    END IF;

    RETURN QUERY
    SELECT
        d.id,
        d.transaction_type,
        d.transaction_id,
        d.reporter_id,
        p_rep.full_name AS reporter_name,
        u_rep.email::text AS reporter_email,
        d.respondent_id,
        p_res.full_name AS respondent_name,
        u_res.email::text AS respondent_email,
        d.dispute_reason,
        d.dispute_details,
        d.status,
        d.resolution_notes,
        d.created_at,
        d.resolved_at
    FROM public.disputes d
    LEFT JOIN public.profiles p_rep ON p_rep.id = d.reporter_id
    LEFT JOIN auth.users u_rep ON u_rep.id = d.reporter_id
    LEFT JOIN public.profiles p_res ON p_res.id = d.respondent_id
    LEFT JOIN auth.users u_res ON u_res.id = d.respondent_id
    ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_admin_disputes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_disputes() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
    p_dispute_id uuid,
    p_resolution text,
    p_notes text
)
RETURNS boolean AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Administrator privileges required.';
    END IF;

    UPDATE public.disputes
    SET status = p_resolution,
        resolution_notes = p_notes,
        resolved_by = auth.uid(),
        resolved_at = now()
    WHERE id = p_dispute_id;

    PERFORM public.create_audit_log(
        auth.uid(),
        'DISPUTE_RESOLVED',
        'disputes',
        p_dispute_id,
        jsonb_build_object('resolution', p_resolution, 'notes', p_notes)
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.admin_resolve_dispute(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(uuid, text, text) TO authenticated, service_role;
