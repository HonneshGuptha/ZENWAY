-- Migration: 20261110000004_student_verifications.sql
-- Description: Creates student_verifications table with anti-tampering triggers, notifications, and audit logging

CREATE TABLE IF NOT EXISTS public.student_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id_number text NOT NULL CHECK (length(trim(student_id_number)) >= 3),
    id_document_path text NOT NULL,
    document_type public.document_type NOT NULL DEFAULT 'student_id_card',
    status public.verification_submission_status NOT NULL DEFAULT 'pending',
    rejection_reason text NULL,
    reviewed_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Integrity: A student can only have one active 'pending' review at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_pending_verification 
    ON public.student_verifications(user_id) 
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_verifications_queue 
    ON public.student_verifications(status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_verifications_user 
    ON public.student_verifications(user_id);

-- Attach updated_at trigger
DROP TRIGGER IF EXISTS trg_student_verifications_updated_at ON public.student_verifications;
CREATE TRIGGER trg_student_verifications_updated_at
BEFORE UPDATE ON public.student_verifications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Anti-tampering and administrative review orchestration trigger
CREATE OR REPLACE FUNCTION public.protect_verification_submission()
RETURNS trigger AS $$
BEGIN
    -- On INSERT: Students submit as 'pending'; wipe any forged review metadata
    IF TG_OP = 'INSERT' THEN
        IF NOT public.is_admin() THEN
            NEW.status := 'pending';
            NEW.reviewed_by := NULL;
            NEW.reviewed_at := NULL;
            NEW.rejection_reason := NULL;
        END IF;

        -- Update user profile standing to pending
        UPDATE public.profiles
        SET verification_status = 'pending'
        WHERE id = NEW.user_id AND verification_status != 'verified';

        -- Create notification confirming submission
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            NEW.user_id,
            'verification_submitted',
            'Verification Submitted',
            'Your student credentials have been received and are pending campus administrator review.',
            jsonb_build_object('verification_id', NEW.id)
        );
    END IF;

    -- On UPDATE: Only administrators can alter status, review timestamps, or rejection reasons
    IF TG_OP = 'UPDATE' THEN
        IF (NEW.status IS DISTINCT FROM OLD.status) OR
           (NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by) OR
           (NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at) OR
           (NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason) THEN
            IF NOT public.is_admin() THEN
                RAISE EXCEPTION 'Access Denied: Only administrators can review or update verification submissions.';
            END IF;
        END IF;

        -- If status transitioned to approved
        IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
            NEW.reviewed_by := auth.uid();
            NEW.reviewed_at := now();
            
            UPDATE public.profiles 
            SET verification_status = 'verified'
            WHERE id = NEW.user_id;

            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (
                NEW.user_id,
                'verification_approved',
                'Student Verification Approved!',
                'Your student ID has been approved. You now have full access to RENT, RIDE, and CARRY on ZENWAY.',
                jsonb_build_object('verification_id', NEW.id)
            );

            PERFORM public.create_audit_log(
                auth.uid(),
                'VERIFICATION_APPROVED',
                'student_verifications',
                NEW.id,
                jsonb_build_object('user_id', NEW.user_id, 'student_id_number', NEW.student_id_number)
            );

        -- If status transitioned to rejected
        ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
            NEW.reviewed_by := auth.uid();
            NEW.reviewed_at := now();

            UPDATE public.profiles 
            SET verification_status = 'unverified'
            WHERE id = NEW.user_id;

            INSERT INTO public.notifications (user_id, type, title, message, data)
            VALUES (
                NEW.user_id,
                'verification_rejected',
                'Verification Needs Attention',
                COALESCE(NEW.rejection_reason, 'Your verification could not be approved. Please review requirements and resubmit.'),
                jsonb_build_object('verification_id', NEW.id, 'reason', NEW.rejection_reason)
            );

            PERFORM public.create_audit_log(
                auth.uid(),
                'VERIFICATION_REJECTED',
                'student_verifications',
                NEW.id,
                jsonb_build_object('user_id', NEW.user_id, 'reason', NEW.rejection_reason)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_verification_submission ON public.student_verifications;
CREATE TRIGGER trg_protect_verification_submission
BEFORE INSERT OR UPDATE ON public.student_verifications
FOR EACH ROW EXECUTE FUNCTION public.protect_verification_submission();
