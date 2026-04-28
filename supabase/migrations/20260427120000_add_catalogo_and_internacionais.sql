-- ── catalogo_materiais ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catalogo_materiais (
  id               TEXT        NOT NULL PRIMARY KEY,
  codigo           TEXT        NOT NULL DEFAULT '',
  descricao        TEXT        NOT NULL DEFAULT '',
  preco_compra     NUMERIC,
  fornecedores     TEXT[]      NOT NULL DEFAULT '{}',
  categorias       TEXT[]      NOT NULL DEFAULT '{}',
  ultima_atualizacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.catalogo_materiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read catalogo"    ON public.catalogo_materiais FOR SELECT USING (true);
CREATE POLICY "Anyone can insert catalogo"  ON public.catalogo_materiais FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update catalogo"  ON public.catalogo_materiais FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete catalogo"  ON public.catalogo_materiais FOR DELETE USING (true);

-- ── fretes_internacionais ─────────────────────────────────────────────────────
-- Guarda o snapshot completo da planilha de fretes internacionais num único
-- registro (id = 1). Sempre sobrescrito no upload.
CREATE TABLE IF NOT EXISTS public.fretes_internacionais (
  id          INTEGER     NOT NULL PRIMARY KEY DEFAULT 1,
  rows        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  columns     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  sub_headers JSONB       NOT NULL DEFAULT '[]'::jsonb,
  file_name   TEXT        NOT NULL DEFAULT '',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  totals      JSONB       NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.fretes_internacionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read fretes_internacionais"   ON public.fretes_internacionais FOR SELECT USING (true);
CREATE POLICY "Anyone can insert fretes_internacionais" ON public.fretes_internacionais FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update fretes_internacionais" ON public.fretes_internacionais FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete fretes_internacionais" ON public.fretes_internacionais FOR DELETE USING (true);
