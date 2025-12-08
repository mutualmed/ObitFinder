-- =============================================================================
-- ObitFinder CRM - Pipeline Schema Migration
-- =============================================================================
-- This migration adds the pipeline workflow columns and storage policies.
-- Run this in your Supabase SQL Editor before using the Pipeline CRM.
-- =============================================================================

-- 1. Add status column to contatos table for pipeline stages
-- Status values: 'New', 'Attempted', 'In Progress', 'Won', 'Lost'
ALTER TABLE contatos
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'New';

-- 2. Add notes column if it doesn't exist (for call logging)
ALTER TABLE contatos
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Add contacted column if it doesn't exist (legacy support)
ALTER TABLE contatos
ADD COLUMN IF NOT EXISTS contacted BOOLEAN DEFAULT FALSE;

-- 4. Add timestamp columns for tracking
ALTER TABLE contatos
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 5. Create an index on status for faster pipeline queries
CREATE INDEX IF NOT EXISTS idx_contatos_status ON contatos(status);

-- 6. Create the storage bucket for case files (if not exists)
-- Note: This needs to be run via Supabase Dashboard or with service role
INSERT INTO storage.buckets (id, name, public)
VALUES ('case_files', 'case_files', false)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage policies for the case_files bucket
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'case_files');

-- Allow authenticated users to read files
CREATE POLICY "Allow authenticated reads" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'case_files');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'case_files');

-- =============================================================================
-- OPTIONAL: Update existing records to have 'New' status if NULL
-- =============================================================================
UPDATE contatos SET status = 'New' WHERE status IS NULL;

-- =============================================================================
-- VERIFICATION QUERIES (Run these to confirm migration success)
-- =============================================================================
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'contatos';
--
-- SELECT * FROM storage.buckets WHERE id = 'case_files';
