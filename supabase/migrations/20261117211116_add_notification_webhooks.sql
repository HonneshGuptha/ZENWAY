-- Migration: 20261117211116_add_notification_webhooks.sql
-- Description: Enables pg_net extension, adds profiles.email fallback synchronization, 
-- and configures AFTER INSERT triggers on rental_requests and ride_requests to dispatch
-- HTTP webhook notifications to the notify-exchange edge function via net.http_post.

-- 1. Enable pg_net extension for asynchronous outbound HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Ensure public.profiles table contains an email column for direct notification queries
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text NULL;

-- Backfill profile email addresses from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- Keep column level privileges consistent
GRANT SELECT (email) ON public.profiles TO authenticated, anon, service_role;

-- Update handle_new_user() trigger to automatically mirror email on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_full_name text;
BEGIN
    v_full_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(trim(split_part(NEW.email, '@', 1)), ''),
        'Student'
    );

    IF length(v_full_name) < 2 THEN
        v_full_name := v_full_name || ' Student';
    END IF;

    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        role,
        verification_status
    ) VALUES (
        NEW.id,
        v_full_name,
        NEW.email,
        'student',
        'unverified'
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email
    WHERE profiles.email IS NULL;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. Webhook Trigger Function using pg_net
CREATE OR REPLACE FUNCTION public.notify_exchange_on_insert()
RETURNS trigger AS $$
DECLARE
    v_url text;
    v_payload jsonb;
    v_headers jsonb;
    v_driver_id uuid;
    v_service_key text;
BEGIN
    -- Determine edge function endpoint: checks app settings or defaults to local/standard supabase endpoint
    v_url := coalesce(
        current_setting('app.settings.edge_function_url', true),
        (NULLIF(current_setting('app.settings.supabase_url', true), '') || '/functions/v1/notify-exchange'),
        'http://127.0.0.1:54321/functions/v1/notify-exchange'
    );

    v_service_key := coalesce(
        current_setting('app.settings.service_role_key', true),
        ''
    );

    -- Build standard Supabase Database Webhook payload
    IF TG_TABLE_NAME = 'ride_requests' THEN
        -- Query driver_id from parent rides table to guarantee recipient resolution
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

    -- Asynchronously execute HTTP POST to notify-exchange edge function
    PERFORM net.http_post(
        url := v_url,
        body := v_payload,
        headers := v_headers
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Non-blocking: ensure database transaction succeeds even if network/webhook delivery encounters an issue
    RAISE WARNING 'notify_exchange_on_insert error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, extensions, pg_temp;

REVOKE EXECUTE ON FUNCTION public.notify_exchange_on_insert() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_exchange_on_insert() TO postgres, service_role, authenticated;

-- 4. AFTER INSERT triggers on rental_requests and ride_requests
DROP TRIGGER IF EXISTS trg_notify_rental_request_insert ON public.rental_requests;
CREATE TRIGGER trg_notify_rental_request_insert
AFTER INSERT ON public.rental_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_exchange_on_insert();

DROP TRIGGER IF EXISTS trg_notify_ride_request_insert ON public.ride_requests;
CREATE TRIGGER trg_notify_ride_request_insert
AFTER INSERT ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_exchange_on_insert();
