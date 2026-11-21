-- Migration: 20261121000004_inapp_notifications_and_realtime.sql
-- Description: Ensures in-app notifications are dispatched on accepted status across Rent, Ride, and Carry,
-- adds notifications to supabase_realtime publication, and provides helper RPC.

-- 1. Enable Supabase Realtime publication on notifications table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 2. Trigger function to ensure in-app notifications are created when requests transition to 'accepted'
CREATE OR REPLACE FUNCTION public.trg_notify_inapp_on_accepted()
RETURNS trigger AS $$
DECLARE
    v_title text;
BEGIN
    -- Only act on transition to 'accepted'
    IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status::text = 'accepted' THEN

        -- Case 1: rental_requests
        IF TG_TABLE_NAME = 'rental_requests' THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.notifications
                WHERE user_id = NEW.renter_id
                  AND type = 'rental_request_accepted'
                  AND (data->>'request_id')::uuid = NEW.id
            ) THEN
                SELECT title INTO v_title FROM public.vehicles WHERE id = NEW.vehicle_id;
                INSERT INTO public.notifications (user_id, type, title, message, data)
                VALUES (
                    NEW.renter_id,
                    'rental_request_accepted',
                    'Rental Request Approved!',
                    format('Your booking for "%s" has been approved! Meet the owner at the scheduled pickup time.', coalesce(v_title, 'Vehicle')),
                    jsonb_build_object('request_id', NEW.id, 'vehicle_id', NEW.vehicle_id)
                );
            END IF;

        -- Case 2: ride_requests
        ELSIF TG_TABLE_NAME = 'ride_requests' THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.notifications
                WHERE user_id = NEW.passenger_id
                  AND type = 'ride_request_accepted'
                  AND (data->>'request_id')::uuid = NEW.id
            ) THEN
                SELECT destination_name INTO v_title FROM public.rides WHERE id = NEW.ride_id;
                INSERT INTO public.notifications (user_id, type, title, message, data)
                VALUES (
                    NEW.passenger_id,
                    'ride_request_accepted',
                    'Ride Seat Confirmed!',
                    format('Your seat request for the ride to "%s" was accepted by the driver.', coalesce(v_title, 'Destination')),
                    jsonb_build_object('ride_id', NEW.ride_id, 'request_id', NEW.id)
                );
            END IF;

        -- Case 3: carry_requests
        ELSIF TG_TABLE_NAME = 'carry_requests' THEN
            -- Notify requester that a carrier is assigned
            IF NOT EXISTS (
                SELECT 1 FROM public.notifications
                WHERE user_id = NEW.requester_id
                  AND type = 'carry_offer_accepted'
                  AND (data->>'request_id')::uuid = NEW.id
            ) THEN
                INSERT INTO public.notifications (user_id, type, title, message, data)
                VALUES (
                    NEW.requester_id,
                    'carry_offer_accepted',
                    'Carry Request Matched!',
                    format('A carrier has been assigned for your parcel "%s"! Check contact details to coordinate handoff.', NEW.item_title),
                    jsonb_build_object('request_id', NEW.id, 'carrier_id', NEW.assigned_carrier_id)
                );
            END IF;

            -- Notify assigned carrier if not already notified
            IF NEW.assigned_carrier_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM public.notifications
                WHERE user_id = NEW.assigned_carrier_id
                  AND type = 'carry_offer_accepted'
                  AND (data->>'request_id')::uuid = NEW.id
            ) THEN
                INSERT INTO public.notifications (user_id, type, title, message, data)
                VALUES (
                    NEW.assigned_carrier_id,
                    'carry_offer_accepted',
                    'Carry Offer Accepted!',
                    format('Your offer to carry "%s" was accepted! Please coordinate with the student for pickup.', NEW.item_title),
                    jsonb_build_object('request_id', NEW.id, 'offer_id', NEW.accepted_offer_id)
                );
            END IF;

        -- Case 4: carry_offers
        ELSIF TG_TABLE_NAME = 'carry_offers' THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.notifications
                WHERE user_id = NEW.carrier_id
                  AND type = 'carry_offer_accepted'
                  AND (data->>'offer_id')::uuid = NEW.id
            ) THEN
                SELECT item_title INTO v_title FROM public.carry_requests WHERE id = NEW.request_id;
                INSERT INTO public.notifications (user_id, type, title, message, data)
                VALUES (
                    NEW.carrier_id,
                    'carry_offer_accepted',
                    'Carry Offer Accepted!',
                    format('Your offer to carry "%s" was accepted! Please coordinate with the student for pickup.', coalesce(v_title, 'Parcel')),
                    jsonb_build_object('request_id', NEW.request_id, 'offer_id', NEW.id)
                );
            END IF;

        END IF;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Non-blocking: ensure main database transaction succeeds even if notification logging encounters an issue
    RAISE WARNING 'trg_notify_inapp_on_accepted error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.trg_notify_inapp_on_accepted() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trg_notify_inapp_on_accepted() TO postgres, service_role, authenticated;

-- Attach AFTER UPDATE triggers
DROP TRIGGER IF EXISTS trg_inapp_rental_request_accepted ON public.rental_requests;
CREATE TRIGGER trg_inapp_rental_request_accepted
AFTER UPDATE OF status ON public.rental_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'accepted')
EXECUTE FUNCTION public.trg_notify_inapp_on_accepted();

DROP TRIGGER IF EXISTS trg_inapp_ride_request_accepted ON public.ride_requests;
CREATE TRIGGER trg_inapp_ride_request_accepted
AFTER UPDATE OF status ON public.ride_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'accepted')
EXECUTE FUNCTION public.trg_notify_inapp_on_accepted();

DROP TRIGGER IF EXISTS trg_inapp_carry_request_accepted ON public.carry_requests;
CREATE TRIGGER trg_inapp_carry_request_accepted
AFTER UPDATE OF status ON public.carry_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'accepted')
EXECUTE FUNCTION public.trg_notify_inapp_on_accepted();

DROP TRIGGER IF EXISTS trg_inapp_carry_offer_accepted ON public.carry_offers;
CREATE TRIGGER trg_inapp_carry_offer_accepted
AFTER UPDATE OF status ON public.carry_offers
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'accepted')
EXECUTE FUNCTION public.trg_notify_inapp_on_accepted();

-- 3. Helper RPC to allow security-definer insertion of notifications if required
CREATE OR REPLACE FUNCTION public.send_inapp_notification(
    p_user_id uuid,
    p_type public.notification_type,
    p_title text,
    p_message text,
    p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (p_user_id, p_type, p_title, p_message, p_data)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.send_inapp_notification(uuid, public.notification_type, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_inapp_notification(uuid, public.notification_type, text, text, jsonb) TO authenticated, service_role;
