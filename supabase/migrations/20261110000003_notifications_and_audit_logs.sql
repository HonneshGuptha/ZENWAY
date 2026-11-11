-- Migration: 20261110000003_notifications_and_audit_logs.sql
-- Description: Creates notifications and audit_logs tables with helper logging functions

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type public.notification_type NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
    ON public.notifications(user_id, created_at DESC) 
    WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_all 
    ON public.notifications(user_id, created_at DESC);

-- 2. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    action text NOT NULL,
    target_entity text NOT NULL,
    target_id uuid NOT NULL,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    ip_address text NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs(target_entity, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 3. Audit logging helper function (strictly internal / trusted service execution)
CREATE OR REPLACE FUNCTION public.create_audit_log(
    p_actor_id uuid,
    p_action text,
    p_target_entity text,
    p_target_id uuid,
    p_details jsonb DEFAULT '{}'::jsonb,
    p_ip_address text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_log_id uuid;
BEGIN
    INSERT INTO public.audit_logs (
        actor_id,
        action,
        target_entity,
        target_id,
        details,
        ip_address
    ) VALUES (
        p_actor_id,
        p_action,
        p_target_entity,
        p_target_id,
        p_details,
        p_ip_address
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Prevent arbitrary clients from forging audit logs:
-- Execution revoked from PUBLIC and authenticated; only trusted service-role or internal SECURITY DEFINER functions can invoke.
REVOKE EXECUTE ON FUNCTION public.create_audit_log(uuid, text, text, uuid, jsonb, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.create_audit_log(uuid, text, text, uuid, jsonb, text) TO service_role;
