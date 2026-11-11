-- Migration: 20261110000011_storage_buckets_and_policies.sql
-- Description: Provisions the 4 discrete storage buckets and configures strict folder-isolated storage RLS policies

-- 1. Provision Storage Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('student-ids', 'student-ids', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    ('carry-photos', 'carry-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('vehicle-images', 'vehicle-images', true, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 2. Storage Objects RLS Policies
-- ============================================================================

-- A. student-ids Bucket (Private)
-- Path convention: {user_id}/{filename}
DROP POLICY IF EXISTS "student_ids_upload_owner" ON storage.objects;
CREATE POLICY "student_ids_upload_owner" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'student-ids' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "student_ids_update_owner" ON storage.objects;
CREATE POLICY "student_ids_update_owner" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'student-ids' 
        AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
    )
    WITH CHECK (
        bucket_id = 'student-ids' 
        AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
    );

DROP POLICY IF EXISTS "student_ids_select_owner_admin" ON storage.objects;
CREATE POLICY "student_ids_select_owner_admin" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'student-ids' 
        AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
    );

DROP POLICY IF EXISTS "student_ids_delete_admin" ON storage.objects;
CREATE POLICY "student_ids_delete_admin" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'student-ids' 
        AND public.is_admin()
    );

-- B. carry-photos Bucket (Private)
-- Path convention: {carry_id}/{filename}
DROP POLICY IF EXISTS "carry_photos_upload_parties" ON storage.objects;
CREATE POLICY "carry_photos_upload_parties" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'carry-photos'
        AND EXISTS (
            SELECT 1 FROM public.carry_requests cr
            WHERE cr.id::text = (storage.foldername(name))[1]
              AND (cr.requester_id = auth.uid() OR cr.assigned_carrier_id = auth.uid() OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS "carry_photos_update_parties" ON storage.objects;
CREATE POLICY "carry_photos_update_parties" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'carry-photos'
        AND EXISTS (
            SELECT 1 FROM public.carry_requests cr
            WHERE cr.id::text = (storage.foldername(name))[1]
              AND (cr.requester_id = auth.uid() OR cr.assigned_carrier_id = auth.uid() OR public.is_admin())
        )
    )
    WITH CHECK (
        bucket_id = 'carry-photos'
        AND EXISTS (
            SELECT 1 FROM public.carry_requests cr
            WHERE cr.id::text = (storage.foldername(name))[1]
              AND (cr.requester_id = auth.uid() OR cr.assigned_carrier_id = auth.uid() OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS "carry_photos_select_parties" ON storage.objects;
CREATE POLICY "carry_photos_select_parties" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'carry-photos'
        AND EXISTS (
            SELECT 1 FROM public.carry_requests cr
            WHERE cr.id::text = (storage.foldername(name))[1]
              AND (cr.requester_id = auth.uid() OR cr.assigned_carrier_id = auth.uid() OR public.is_admin())
        )
    );

-- C. vehicle-images Bucket (Public)
-- Path convention: {vehicle_id}/{filename}
DROP POLICY IF EXISTS "vehicle_images_public_read" ON storage.objects;
CREATE POLICY "vehicle_images_public_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'vehicle-images');

DROP POLICY IF EXISTS "vehicle_images_upload_owner" ON storage.objects;
CREATE POLICY "vehicle_images_upload_owner" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'vehicle-images'
        AND EXISTS (
            SELECT 1 FROM public.vehicles v
            WHERE v.id::text = (storage.foldername(name))[1]
              AND (v.owner_id = auth.uid() OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS "vehicle_images_update_owner" ON storage.objects;
CREATE POLICY "vehicle_images_update_owner" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'vehicle-images'
        AND EXISTS (
            SELECT 1 FROM public.vehicles v
            WHERE v.id::text = (storage.foldername(name))[1]
              AND (v.owner_id = auth.uid() OR public.is_admin())
        )
    )
    WITH CHECK (
        bucket_id = 'vehicle-images'
        AND EXISTS (
            SELECT 1 FROM public.vehicles v
            WHERE v.id::text = (storage.foldername(name))[1]
              AND (v.owner_id = auth.uid() OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS "vehicle_images_delete_owner" ON storage.objects;
CREATE POLICY "vehicle_images_delete_owner" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'vehicle-images'
        AND EXISTS (
            SELECT 1 FROM public.vehicles v
            WHERE v.id::text = (storage.foldername(name))[1]
              AND (v.owner_id = auth.uid() OR public.is_admin())
        )
    );

-- D. avatars Bucket (Public)
-- Path convention: {user_id}/{filename}
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_upload_owner" ON storage.objects;
CREATE POLICY "avatars_upload_owner" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "avatars_update_owner" ON storage.objects;
CREATE POLICY "avatars_update_owner" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'avatars' 
        AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
    )
    WITH CHECK (
        bucket_id = 'avatars' 
        AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
    );

DROP POLICY IF EXISTS "avatars_delete_owner" ON storage.objects;
CREATE POLICY "avatars_delete_owner" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'avatars' 
        AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
    );
