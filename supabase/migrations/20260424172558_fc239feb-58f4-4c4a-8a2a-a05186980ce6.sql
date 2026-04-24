-- pedidos
CREATE TABLE public.pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pi INTEGER,
  cliente TEXT,
  codigo TEXT,
  codigo_compra TEXT,
  descricao TEXT,
  qty_venda NUMERIC,
  qty_compra NUMERIC,
  preco_venda NUMERIC,
  preco_compra NUMERIC,
  po TEXT,
  fornecedor TEXT,
  status_fornecedor TEXT,
  status_compra_venda TEXT,
  status_producao TEXT,
  prazo_cliente TEXT,
  dias_faltam NUMERIC,
  dias_atraso NUMERIC,
  venda_em_dias NUMERIC,
  follow_up TEXT,
  chegada_hci TEXT,
  categoria TEXT NOT NULL DEFAULT 'Conexões',
  eta TEXT,
  etd TEXT,
  item TEXT,
  embarque TEXT,
  entrega_fornecedor TEXT,
  data_compra TEXT,
  prazo_inicial_fornecedor TEXT,
  emissao_pedido_sistema TEXT,
  data_recebimento_compra TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read pedidos" ON public.pedidos FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pedidos" ON public.pedidos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete pedidos" ON public.pedidos FOR DELETE USING (true);
CREATE POLICY "Anyone can update pedidos" ON public.pedidos FOR UPDATE USING (true);

-- action_plans
CREATE TABLE public.action_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pi INTEGER,
  po TEXT,
  categoria TEXT NOT NULL DEFAULT 'Conexões',
  action_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read action_plans" ON public.action_plans FOR SELECT USING (true);
CREATE POLICY "Anyone can insert action_plans" ON public.action_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update action_plans" ON public.action_plans FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete action_plans" ON public.action_plans FOR DELETE USING (true);

-- po_documents
CREATE TABLE public.po_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Conexões',
  doc_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.po_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read po_documents" ON public.po_documents FOR SELECT USING (true);
CREATE POLICY "Anyone can insert po_documents" ON public.po_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete po_documents" ON public.po_documents FOR DELETE USING (true);

-- storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('po-documents', 'po-documents', true);
CREATE POLICY "Anyone can read po-documents" ON storage.objects FOR SELECT USING (bucket_id = 'po-documents');
CREATE POLICY "Anyone can upload po-documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'po-documents');
CREATE POLICY "Anyone can delete po-documents" ON storage.objects FOR DELETE USING (bucket_id = 'po-documents');

-- profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  cargo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();