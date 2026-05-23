-- Add missing preco_venda column to catalogo_materiais
ALTER TABLE public.catalogo_materiais
  ADD COLUMN IF NOT EXISTS preco_venda NUMERIC;
