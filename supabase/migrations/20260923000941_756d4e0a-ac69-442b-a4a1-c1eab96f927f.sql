-- 1. Roles infrastructure
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 2. Backfill: existing users keep full access
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'member'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. New signups become members
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $$;

-- Helper: approved team member (admins included)
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('member', 'admin')
  )
$$;

-- 4. pedidos
DROP POLICY IF EXISTS "Authenticated can read pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Authenticated can insert pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Authenticated can update pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Authenticated can delete pedidos" ON public.pedidos;

CREATE POLICY "Team members can read pedidos" ON public.pedidos
FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Team members can insert pedidos" ON public.pedidos
FOR INSERT TO authenticated WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "Team members can update pedidos" ON public.pedidos
FOR UPDATE TO authenticated USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "Admins can delete pedidos" ON public.pedidos
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. action_plans
DROP POLICY IF EXISTS "Authenticated can read action_plans" ON public.action_plans;
DROP POLICY IF EXISTS "Authenticated can insert action_plans" ON public.action_plans;
DROP POLICY IF EXISTS "Authenticated can update action_plans" ON public.action_plans;
DROP POLICY IF EXISTS "Authenticated can delete action_plans" ON public.action_plans;

CREATE POLICY "Team members can read action_plans" ON public.action_plans
FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Team members can insert action_plans" ON public.action_plans
FOR INSERT TO authenticated WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "Team members can update action_plans" ON public.action_plans
FOR UPDATE TO authenticated USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "Admins can delete action_plans" ON public.action_plans
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. po_documents
DROP POLICY IF EXISTS "Authenticated can read po_documents" ON public.po_documents;
DROP POLICY IF EXISTS "Authenticated can insert po_documents" ON public.po_documents;
DROP POLICY IF EXISTS "Authenticated can update po_documents" ON public.po_documents;
DROP POLICY IF EXISTS "Authenticated can delete po_documents" ON public.po_documents;

CREATE POLICY "Team members can read po_documents" ON public.po_documents
FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Team members can insert po_documents" ON public.po_documents
FOR INSERT TO authenticated WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "Team members can update po_documents" ON public.po_documents
FOR UPDATE TO authenticated USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "Team members can delete po_documents" ON public.po_documents
FOR DELETE TO authenticated USING (public.is_team_member(auth.uid()));

-- 7. profiles: own profile only, admins see all
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 8. Storage: bind file writes to their uploader
DROP POLICY IF EXISTS "Authenticated can read po-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload po-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update po-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete po-documents" ON storage.objects;

CREATE POLICY "Team members can read po-documents" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'po-documents' AND public.is_team_member(auth.uid()));

CREATE POLICY "Members upload their own po-documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'po-documents'
  AND public.is_team_member(auth.uid())
  AND owner_id = (select auth.uid()::text)
);

CREATE POLICY "Owners update their own po-documents" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'po-documents'
  AND (owner_id = (select auth.uid()::text) OR public.has_role(auth.uid(), 'admin'))
)
WITH CHECK (
  bucket_id = 'po-documents'
  AND (owner_id = (select auth.uid()::text) OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Owners delete their own po-documents" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'po-documents'
  AND (owner_id = (select auth.uid()::text) OR public.has_role(auth.uid(), 'admin'))
);