-- ====================================================================
-- VORTEX SOCIAL NETWORK — STORAGE BUCKETS AND POLICIES
-- Migration: 20261118000003_vortex_storage_buckets.sql
-- Idempotent version: safe to run more than once.
-- Note: Existing policies with these exact names are replaced.
-- ====================================================================

-- 1. Create or update Storage Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('covers', 'covers', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('post_media', 'post_media', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']),
    ('community_media', 'community_media', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('attachments', 'attachments', false, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'])
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Remove existing policies with the same names.
-- This prevents ERROR 42710 when this migration is run again.
DROP POLICY IF EXISTS "Public read for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

DROP POLICY IF EXISTS "Public read for covers" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own cover" ON storage.objects;

DROP POLICY IF EXISTS "Public read for post media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload post media" ON storage.objects;
DROP POLICY IF EXISTS "Post author can delete their post media" ON storage.objects;

DROP POLICY IF EXISTS "Public read for community media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload community media" ON storage.objects;

-- 3. AVATARS
CREATE POLICY "Public read for avatars"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'avatars'
        AND auth.uid()::TEXT = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update their own avatar"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'avatars'
        AND auth.uid()::TEXT = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own avatar"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'avatars'
        AND auth.uid()::TEXT = (storage.foldername(name))[1]
    );

-- 4. COVERS
CREATE POLICY "Public read for covers"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'covers');

CREATE POLICY "Users can upload their own cover"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'covers'
        AND auth.uid()::TEXT = (storage.foldername(name))[1]
    );

-- 5. POST MEDIA
CREATE POLICY "Public read for post media"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'post_media');

CREATE POLICY "Authenticated users can upload post media"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'post_media'
        AND auth.role() = 'authenticated'
        AND auth.uid()::TEXT = (storage.foldername(name))[1]
    );

CREATE POLICY "Post author can delete their post media"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'post_media'
        AND (
            auth.uid()::TEXT = (storage.foldername(name))[1]
            OR public.is_moderator()
        )
    );

-- 6. COMMUNITY MEDIA
CREATE POLICY "Public read for community media"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'community_media');

CREATE POLICY "Authenticated users can upload community media"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'community_media'
        AND auth.role() = 'authenticated'
    );

-- End of migration.
