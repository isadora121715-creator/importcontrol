import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { rows, categoria } = await req.json();

    if (!rows || !categoria) {
      return new Response(
        JSON.stringify({ error: "rows e categoria são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Service role key bypasses RLS entirely
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Delete existing rows for this categoria
    const { error: delError } = await supabase
      .from("pedidos")
      .delete()
      .eq("categoria", categoria);

    if (delError) {
      return new Response(
        JSON.stringify({ error: `Erro ao limpar dados: ${delError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert in batches of 200
    const BATCH = 200;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error: insError } = await supabase.from("pedidos").insert(batch);
      if (insError) {
        return new Response(
          JSON.stringify({
            error: `Erro ao inserir lote ${Math.floor(i / BATCH) + 1}: ${insError.message}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      inserted += batch.length;
    }

    return new Response(JSON.stringify({ ok: true, inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
