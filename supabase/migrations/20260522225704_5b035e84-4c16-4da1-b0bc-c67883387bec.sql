-- pedidos
DROP POLICY IF EXISTS "Anyone can read pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Anyone can insert pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Anyone can update pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Anyone can delete pedidos" ON public.pedidos;

CREATE POLICY "Authenticated can read pedidos" ON public.pedidos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert pedidos" ON public.pedidos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update pedidos" ON public.pedidos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete pedidos" ON public.pedidos
  FOR DELETE TO authenticated USING (true);

-- action_plans
DROP POLICY IF EXISTS "Anyone can read action_plans" ON public.action_plans;
DROP POLICY IF EXISTS "Anyone can insert action_plans" ON public.action_plans;
DROP POLICY IF EXISTS "Anyone can update action_plans" ON public.action_plans;
DROP POLICY IF EXISTS "Anyone can delete action_plans" ON public.action_plans;

CREATE POLICY "Authenticated can read action_plans" ON public.action_plans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert action_plans" ON public.action_plans
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update action_plans" ON public.action_plans
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete action_plans" ON public.action_plans
  FOR DELETE TO authenticated USING (true);

-- po_documents table
DROP POLICY IF EXISTS "Anyone can read po_documents" ON public.po_documents;
DROP POLICY IF EXISTS "Anyone can insert po_documents" ON public.po_documents;
DROP POLICY IF EXISTS "Anyone can delete po_documents" ON public.po_documents;

CREATE POLICY "Authenticated can read po_documents" ON public.po_documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert po_documents" ON public.po_documents
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update po_documents" ON public.po_documents
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete po_documents" ON public.po_documents
  FOR DELETE TO authenticated USING (true);

-- storage.objects for po-documents bucket
DROP POLICY IF EXISTS "Anyone can read po-documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload po-documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete po-documents" ON storage.objects;

CREATE POLICY "Authenticated can read po-documents" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'po-documents');
CREATE POLICY "Authenticated can upload po-documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'po-documents');
CREATE POLICY "Authenticated can update po-documents" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'po-documents') WITH CHECK (bucket_id = 'po-documents');
CREATE POLICY "Authenticated can delete po-documents" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'po-documents');