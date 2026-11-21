-- Migration: 20261121000006_phase2_notifications_and_audit_hardening.sql
-- Description: Phase 2 Notification Reliability & Admin Audit Hardening:
--   1. Dynamic Edge Function URL resolution for exchange notification webhooks with resilient fallback.
--   2. Enforce active administrator session validation on admin_moderate_listing and admin_resolve_dispute.

-- ============================================================================
-- 1. NOTIFICATION RELIABILITY & WEBHOOK PIPELINE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_exchange_on_insert()
RETURNS trigger AS $$
DECLARE
    v_payload jsonb;
    v_headers jsonb;
    v_driver_id uuid;
    v_service_key text;
    v_function_url text;
BEGIN
    v_service_key := coalesce(
        current_setting('app.settings.service_role_key', true),
        ''
    );

    v_function_url := coalesce(
        nullif(current_setting('app.settings.edge_function_url', true), ''),
        'https://laqkpxmxwtjqjcmucygt.supabase.co/functions/v1/notify-exchange'
    );

    -- Build standard Supabase Database Webhook payload
    IF TG_TABLE_NAME = 'ride_requests' THEN
        SELECT driver_id INTO v_driver_id
        FROM public.rides
        WHERE id = NEW.ride_id;

        v_payload := jsonb_build_object(
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA,
            'record', to_jsonb(NEW) || jsonb_build_object('driver_id', v_driver_id),
            'old_record', NULL
        );
    ELSE
        v_payload := jsonb_build_object(
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA,
            'record', to_jsonb(NEW),
            'old_record', NULL
        );
    END IF;

    -- Prepare request headers
    v_headers := jsonb_build_object(
        'Content-Type', 'application/json'
    );
    IF v_service_key <> '' THEN
        v_headers := v_headers || jsonb_build_object(
            'Authorization', 'Bearer ' || v_service_key,
            'apikey', v_service_key
        );
    END IF;

    -- Asynchronously execute HTTP POST to the notify-exchange Edge Function
    PERFORM net.http_post(
        url := v_function_url,
        body := v_payload,
        headers := v_headers
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Non-blocking: ensure database transaction succeeds even if webhook delivery encounters an issue
    RAISE WARNING 'notify_exchange_on_insert error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, extensions, pg_temp;

REVOKE EXECUTE ON FUNCTION public.notify_exchange_on_insert() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_exchange_on_insert() TO postgres, service_role, authenticated;


CREATE OR REPLACE FUNCTION public.notify_exchange_on_update()
RETURNS trigger AS $$
DECLARE
    v_payload jsonb;
    v_headers jsonb;
    v_service_key text;
    v_function_url text;
BEGIN
    -- Only dispatch when status transitions to 'accepted'
    IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status::text = 'accepted' THEN
        v_service_key := coalesce(
            current_setting('app.settings.service_role_key', true),
            ''
        );

        v_function_url := coalesce(
            nullif(current_setting('app.settings.edge_function_url', true), ''),
            'https://laqkpxmxwtjqjcmucygt.supabase.co/functions/v1/notify-exchange'
        );

        -- Build standard Supabase UPDATE Webhook payload
        v_payload := jsonb_build_object(
            'type', 'UPDATE',
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA,
            'record', to_jsonb(NEW),
            'old_record', to_jsonb(OLD)
        );

        -- Prepare request headers
        v_headers := jsonb_build_object(
            'Content-Type', 'application/json'
        );
        IF v_service_key <> '' THEN
            v_headers := v_headers || jsonb_build_object(
                'Authorization', 'Bearer ' || v_service_key,
                'apikey', v_service_key
            );
        END IF;

        -- Dispatch asynchronous HTTP POST to the notify-exchange Edge Function
        PERFORM net.http_post(
            url := v_function_url,
            body := v_payload,
            headers := v_headers
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Non-blocking: ensure database update succeeds even if webhook delivery encounters an issue
    RAISE WARNING 'notify_exchange_on_update error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, extensions, pg_temp;

REVOKE EXECUTE ON FUNCTION public.notify_exchange_on_update() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_exchange_on_update() TO postgres, service_role, authenticated;


-- ============================================================================
-- 2. ADMIN AUDIT TRAIL & PRIVILEGED ACTION HARDENING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_moderate_listing(
    p_entity_type text,
    p_entity_id uuid,
    p_action text,
    p_reason text DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
    IF NOT public.is_admin() OR NOT public.has_active_admin_session() THEN
        RAISE EXCEPTION 'Access Denied: Valid verified administrator session required.';
    END IF;

    IF p_entity_type = 'vehicle' THEN
        UPDATE public.vehicles
        SET status = CASE WHEN p_action = 'archive' THEN 'archived'::public.listing_status ELSE 'paused'::public.listing_status END,
            updated_at = now()
        WHERE id = p_entity_id;

    ELSIF p_entity_type = 'ride' THEN
        UPDATE public.rides
        SET status = 'cancelled',
            updated_at = now()
        WHERE id = p_entity_id;

    ELSIF p_entity_type = 'carry' THEN
        UPDATE public.carry_requests
        SET status = 'cancelled',
            updated_at = now()
        WHERE id = p_entity_id;

    ELSE
        RAISE EXCEPTION 'Invalid entity type for moderation: %', p_entity_type;
    END IF;

    PERFORM public.create_audit_log(
        auth.uid(),
        'LISTING_MODERATED',
        p_entity_type,
        p_entity_id,
        jsonb_build_object('action', p_action, 'reason', p_reason)
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE EXECUTE ON FUNCTION public.admin_moderate_listing(text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_listing(text, uuid, text, text) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
    p_dispute_id uuid,
    p_resolution text,
    p_notes text
)
RETURNS boolean AS $$
BEGIN
    IF NOT public.is_admin() OR NOT public.has_active_admin_session() THEN
        RAISE EXCEPTION 'Access Denied: Valid verified administrator session required.';
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
    IF NOT public.is_admin() OR NOT public.has_active_admin_session() THEN
        RAISE EXCEPTION 'Access Denied: Valid verified administrator session required.';
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
