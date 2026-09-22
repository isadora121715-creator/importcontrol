import { supabase } from "@/integrations/supabase/client";

// ── Cross-user JSON sync via Supabase Storage ────────────────────────────────
// Replaces the old GitHub Gist sync (which required an access token embedded
// in client-side code — a serious security exposure, since anyone could read
// it from the browser's dev tools and use it to write to the account's
// gists, or anything else that token was scoped to).
//
// The "pedidos-json" bucket is a PUBLIC bucket with RLS policies that allow
// anon SELECT/INSERT/UPDATE (see supabase/migrations/20260526000000_create_pedidos_json_storage.sql).
// That means any file placed here is world-readable and world-writable —
// same trust model the app already relied on with public Gists, but without
// shipping a credential to the browser. No token, key, or secret is needed
// for either read or write: the bucket's own policies are the auth boundary.
const BUCKET = "pedidos-json";

/** Upload/replace a JSON file in the shared public bucket. */
export async function uploadJson(filename: string, data: unknown): Promise<void> {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const { error } = await supabase.storage.from(BUCKET).upload(filename, blob, {
    upsert: true,
    contentType: "application/json",
    cacheControl: "0",
  });
  if (error) throw new Error(`Falha ao sincronizar (${filename}): ${error.message}`);
}

/** Fetch a JSON file from the shared public bucket (cache-busted). */
export async function fetchJson<T>(filename: string): Promise<T | null> {
  try {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    const resp = await fetch(`${data.publicUrl}?_=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}
