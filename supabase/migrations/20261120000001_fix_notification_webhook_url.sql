CREATE OR REPLACE FUNCTION public.notify_exchange_on_insert()
RETURNS trigger AS $$
DECLARE
    v_payload jsonb;
    v_headers jsonb;
    v_driver_id uuid;
    v_service_key text;
BEGIN
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

    -- Asynchronously execute HTTP POST to the live notify-exchange Edge Function
    PERFORM net.http_post(
        url := 'https://laqkpxmxwtjqjcmucygt.supabase.co/functions/v1/notify-exchange',
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
