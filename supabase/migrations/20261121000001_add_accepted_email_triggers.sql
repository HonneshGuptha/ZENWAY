-- Migration: 20261121000001_add_accepted_email_triggers.sql
-- Description: Adds AFTER UPDATE triggers on rental_requests and ride_requests to notify
-- renters/passengers via notify-exchange edge function when their request is accepted.

CREATE OR REPLACE FUNCTION public.notify_exchange_on_update()
RETURNS trigger AS $$
DECLARE
    v_payload jsonb;
    v_headers jsonb;
    v_service_key text;
BEGIN
    -- Only dispatch when status transitions to 'accepted'
    IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status::text = 'accepted' THEN
        v_service_key := coalesce(
            current_setting('app.settings.service_role_key', true),
            ''
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

        -- Dispatch asynchronous HTTP POST to the live notify-exchange Edge Function
        PERFORM net.http_post(
            url := 'https://laqkpxmxwtjqjcmucygt.supabase.co/functions/v1/notify-exchange',
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

REVOKE EXECUTE ON FUNCTION public.notify_exchange_on_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_exchange_on_update() TO postgres, service_role, authenticated;

-- Attach AFTER UPDATE triggers
DROP TRIGGER IF EXISTS trg_notify_rental_request_update ON public.rental_requests;
CREATE TRIGGER trg_notify_rental_request_update
AFTER UPDATE ON public.rental_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'accepted')
EXECUTE FUNCTION public.notify_exchange_on_update();

DROP TRIGGER IF EXISTS trg_notify_ride_request_update ON public.ride_requests;
CREATE TRIGGER trg_notify_ride_request_update
AFTER UPDATE ON public.ride_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'accepted')
EXECUTE FUNCTION public.notify_exchange_on_update();
