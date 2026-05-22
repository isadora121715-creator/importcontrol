-- Restore permissive RLS policies so the app works without requiring login
-- The previous migration "Locked down tables and storage" restricted all operations
-- to authenticated users only, which broke spreadsheet upload and data loading.

-- pedidos
DROP POLICY IF EXISTS "Authenticated can read pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Authenticated can insert pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Authenticated can update pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Authenticated can delete pedidos" ON public.pedidos;

CREATE POLICY "Anyone can read pedidos"   ON public.pedidos FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pedidos" ON public.pedidos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update pedidos" ON public.pedidos FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete pedidos" ON public.pedidos FOR DELETE USING (true);

-- action_plans
DROP POLICY IF EXISTS "Authenticated can read action_plans" ON public.action_plans;
DROP POLICY IF EXISTS "Authenticated can insert action_plans" ON public.action_plans;
DROP POLICY IF EXISTS "Authenticated can update action_plans" ON public.action_plans;
DROP POLICY IF EXISTS "Authenticated can delete action_plans" ON public.action_plans;

CREATE POLICY "Anyone can read action_plans"   ON public.action_plans FOR SELECT USING (true);
CREATE POLICY "Anyone can insert action_plans" ON public.action_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update action_plans" ON public.action_plans FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete action_plans" ON public.action_plans FOR DELETE USING (true);

-- po_documents
DROP POLICY IF EXISTS "Authenticated can read po_documents" ON public.po_documents;
DROP POLICY IF EXISTS "Authenticated can insert po_documents" ON public.po_documents;
DROP POLICY IF EXISTS "Authenticated can update po_documents" ON public.po_documents;
DROP POLICY IF EXISTS "Authenticated can delete po_documents" ON public.po_documents;

CREATE POLICY "Anyone can read po_documents"   ON public.po_documents FOR SELECT USING (true);
CREATE POLICY "Anyone can insert po_documents" ON public.po_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete po_documents" ON public.po_documents FOR DELETE USING (true);

-- storage.objects for po-documents bucket
DROP POLICY IF EXISTS "Authenticated can read po-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload po-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update po-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete po-documents" ON storage.objects;

CREATE POLICY "Anyone can read po-documents"   ON storage.objects FOR SELECT USING (bucket_id = 'po-documents');
CREATE POLICY "Anyone can upload po-documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'po-documents');
CREATE POLICY "Anyone can delete po-documents" ON storage.objects FOR DELETE USING (bucket_id = 'po-documents');
