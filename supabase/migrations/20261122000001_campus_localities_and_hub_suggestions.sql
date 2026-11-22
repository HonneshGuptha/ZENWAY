-- Migration: 20261122000001_campus_localities_and_hub_suggestions.sql
-- Description: Dynamic campus hub suggestion system and administrative governance.

-- 1. Create table public.campus_localities
CREATE TABLE IF NOT EXISTS public.campus_localities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    normalized_name text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    suggestion_count integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for speedy normalized lookups and status filtering
CREATE INDEX IF NOT EXISTS idx_campus_localities_status ON public.campus_localities(status);
CREATE INDEX IF NOT EXISTS idx_campus_localities_count ON public.campus_localities(suggestion_count DESC);

-- 2. Seed default approved hubs
INSERT INTO public.campus_localities (name, normalized_name, status, suggestion_count)
VALUES
    ('Vijayanagar', 'vijayanagar', 'approved', 1),
    ('RPC Layout', 'rpc layout', 'approved', 1),
    ('Yeshwanthpur', 'yeshwanthpur', 'approved', 1),
    ('Rajajinagar', 'rajajinagar', 'approved', 1),
    ('Jalahalli', 'jalahalli', 'approved', 1),
    ('Kamakshipalya', 'kamakshipalya', 'approved', 1)
ON CONFLICT (normalized_name) DO NOTHING;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.campus_localities ENABLE ROW LEVEL SECURITY;

-- Drop prior policies if re-running
DROP POLICY IF EXISTS "Allow read campus localities" ON public.campus_localities;
DROP POLICY IF EXISTS "Allow admin manage campus localities" ON public.campus_localities;

-- Authenticated and anon can view approved hubs (or all for admin)
CREATE POLICY "Allow read campus localities"
    ON public.campus_localities
    FOR SELECT
    TO anon, authenticated
    USING (status = 'approved' OR public.is_admin());

-- Admins can update/delete/insert all rows
CREATE POLICY "Allow admin manage campus localities"
    ON public.campus_localities
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4. Atomic RPC: suggest_campus_locality
CREATE OR REPLACE FUNCTION public.suggest_campus_locality(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_trimmed text;
    v_normalized text;
    v_id uuid;
    v_status text;
    v_count integer;
BEGIN
    -- Trim and collapse consecutive whitespace
    v_trimmed := regexp_replace(trim(COALESCE(p_name, '')), '\s+', ' ', 'g');

    -- Validation: minimum 2 characters
    IF length(v_trimmed) < 2 THEN
        RAISE EXCEPTION 'Hub name must be at least 2 characters long.';
    END IF;

    -- Compute normalized key
    v_normalized := lower(v_trimmed);

    -- Check if locality already exists
    SELECT id, status, suggestion_count
    INTO v_id, v_status, v_count
    FROM public.campus_localities
    WHERE normalized_name = v_normalized;

    IF FOUND THEN
        IF v_status = 'approved' THEN
            RETURN jsonb_build_object(
                'status', 'already_approved',
                'name', v_trimmed,
                'suggestion_count', v_count
            );
        ELSIF v_status = 'pending' THEN
            UPDATE public.campus_localities
            SET suggestion_count = suggestion_count + 1,
                updated_at = now()
            WHERE id = v_id
            RETURNING suggestion_count INTO v_count;

            RETURN jsonb_build_object(
                'status', 'incremented',
                'suggestion_count', v_count,
                'name', v_trimmed
            );
        ELSIF v_status = 'rejected' THEN
            -- Resuggest: flip back to pending and increment
            UPDATE public.campus_localities
            SET status = 'pending',
                suggestion_count = suggestion_count + 1,
                updated_at = now()
            WHERE id = v_id
            RETURNING suggestion_count INTO v_count;

            RETURN jsonb_build_object(
                'status', 'resuggested',
                'suggestion_count', v_count,
                'name', v_trimmed
            );
        END IF;
    ELSE
        -- Insert new pending suggestion
        INSERT INTO public.campus_localities (name, normalized_name, status, suggestion_count)
        VALUES (v_trimmed, v_normalized, 'pending', 1)
        RETURNING suggestion_count INTO v_count;

        RETURN jsonb_build_object(
            'status', 'created',
            'suggestion_count', 1,
            'name', v_trimmed
        );
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.suggest_campus_locality(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suggest_campus_locality(text) TO anon, authenticated, service_role;
