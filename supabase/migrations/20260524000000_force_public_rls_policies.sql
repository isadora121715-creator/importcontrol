-- Force-reset all RLS policies to allow public access (no auth required)
-- This undoes the "Locked down" migration from Lovable and any partial applies.

-- ============================================================
-- pedidos: drop ALL existing policies then recreate as public
-- ============================================================
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pedidos'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.pedidos', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "public_select_pedidos" ON public.pedidos FOR SELECT USING (true);
CREATE POLICY "public_insert_pedidos" ON public.pedidos FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_pedidos" ON public.pedidos FOR UPDATE USING (true);
CREATE POLICY "public_delete_pedidos" ON public.pedidos FOR DELETE USING (true);

-- ============================================================
-- action_plans
-- ============================================================
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'action_plans'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.action_plans', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "public_select_action_plans" ON public.action_plans FOR SELECT USING (true);
CREATE POLICY "public_insert_action_plans" ON public.action_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_action_plans" ON public.action_plans FOR UPDATE USING (true);
CREATE POLICY "public_delete_action_plans" ON public.action_plans FOR DELETE USING (true);

-- ============================================================
-- po_documents
-- ============================================================
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'po_documents'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.po_documents', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "public_select_po_documents" ON public.po_documents FOR SELECT USING (true);
CREATE POLICY "public_insert_po_documents" ON public.po_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_po_documents" ON public.po_documents FOR UPDATE USING (true);
CREATE POLICY "public_delete_po_documents" ON public.po_documents FOR DELETE USING (true);

-- ============================================================
-- storage.objects (po-documents bucket)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can read po-documents"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload po-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update po-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete po-documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read po-documents"          ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload po-documents"        ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete po-documents"        ON storage.objects;

CREATE POLICY "public_read_po_documents"   ON storage.objects FOR SELECT USING (bucket_id = 'po-documents');
CREATE POLICY "public_upload_po_documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'po-documents');
CREATE POLICY "public_update_po_documents" ON storage.objects FOR UPDATE USING (bucket_id = 'po-documents');
CREATE POLICY "public_delete_po_documents" ON storage.objects FOR DELETE USING (bucket_id = 'po-documents');
