-- Migration: 20261121000002_add_carry_items_email_triggers.sql
-- Description: Dispatch Carry Items insert and accepted-status notifications
-- through the existing notify-exchange Edge Function.

DROP TRIGGER IF EXISTS trg_notify_carry_request_insert ON public.carry_requests;
CREATE TRIGGER trg_notify_carry_request_insert
AFTER INSERT ON public.carry_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_exchange_on_insert();

DROP TRIGGER IF EXISTS trg_notify_carry_request_update ON public.carry_requests;
CREATE TRIGGER trg_notify_carry_request_update
AFTER UPDATE ON public.carry_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'accepted')
EXECUTE FUNCTION public.notify_exchange_on_update();
