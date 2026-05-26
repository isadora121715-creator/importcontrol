-- ============================================================
-- Configuração única: bucket Supabase Storage para sync entre usuários
--
-- Execute este script UMA VEZ no painel Supabase:
-- https://supabase.com/dashboard/project/hsyohvptriadxflghrlb/sql/new
-- ============================================================

-- 1. Cria o bucket público "pedidos-json"
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pedidos-json',
  'pedidos-json',
  true,
  10485760,                         -- 10 MB por arquivo
  ARRAY['application/json']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Permite que qualquer pessoa (inclusive sem login) LEIA os arquivos
DROP POLICY IF EXISTS "pedidos_json_public_select" ON storage.objects;
CREATE POLICY "pedidos_json_public_select"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'pedidos-json');

-- 3. Permite que qualquer pessoa ENVIE / ATUALIZE arquivos JSON
DROP POLICY IF EXISTS "pedidos_json_public_insert" ON storage.objects;
CREATE POLICY "pedidos_json_public_insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'pedidos-json');

DROP POLICY IF EXISTS "pedidos_json_public_update" ON storage.objects;
CREATE POLICY "pedidos_json_public_update"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING  (bucket_id = 'pedidos-json')
  WITH CHECK (bucket_id = 'pedidos-json');
