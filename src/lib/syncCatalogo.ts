import { supabase } from "@/integrations/supabase/client";
import type { PedidoRow } from "./parseExcel";

export const CATALOGO_KEY = "importcontrol.catalogo.v1";

export interface CatalogoItem {
  id: string;               // codigo (normalizado) ou hash da descrição
  codigo: string;
  descricao: string;
  precoCompra: number | null;
  fornecedores: string[];   // lista de fornecedores únicos
  categorias: string[];     // Tubos | Válvulas | Conexões
  ultimaAtualizacao: string; // ISO date
}

// ── conversão banco ↔ domínio ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToItem(row: any): CatalogoItem {
  return {
    id:                row.id as string,
    codigo:           (row.codigo         as string) ?? "",
    descricao:        (row.descricao      as string) ?? "",
    precoCompra:       row.preco_compra != null ? Number(row.preco_compra) : null,
    fornecedores:     (row.fornecedores   as string[]) ?? [],
    categorias:       (row.categorias     as string[]) ?? [],
    ultimaAtualizacao:(row.ultima_atualizacao as string) ?? new Date().toISOString(),
  };
}

function itemToRow(i: CatalogoItem) {
  return {
    id:                 i.id,
    codigo:             i.codigo,
    descricao:          i.descricao,
    preco_compra:       i.precoCompra,
    fornecedores:       i.fornecedores,
    categorias:         i.categorias,
    ultima_atualizacao: i.ultimaAtualizacao,
  };
}

// ── leitura ───────────────────────────────────────────────────────────────────
export async function readCatalogo(): Promise<CatalogoItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("catalogo_materiais")
    .select("*")
    .order("ultima_atualizacao", { ascending: false });

  if (error) {
    console.error("readCatalogo error:", error);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToItem);
}

// ── upsert (adicionar ou atualizar itens) ─────────────────────────────────────
export async function upsertCatalogoItems(items: CatalogoItem[]): Promise<void> {
  if (items.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("catalogo_materiais")
    .upsert(items.map(itemToRow), { onConflict: "id" });
  if (error) console.error("upsertCatalogoItems error:", error);
}

// ── exclusão ──────────────────────────────────────────────────────────────────
export async function deleteCatalogoItem(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("catalogo_materiais")
    .delete()
    .eq("id", id);
  if (error) console.error("deleteCatalogoItem error:", error);
}

/** Gera uma chave estável para identificar o item no catálogo. */
function makeKey(codigo: string, descricao: string): string {
  if (codigo) return codigo.trim().toUpperCase();
  return descricao.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 60);
}

/**
 * Sincroniza um array de PedidoRow com o catálogo no Supabase.
 * - Novos itens são inseridos.
 * - Itens existentes têm precoCompra, fornecedores e categorias atualizados.
 * Retorna quantos itens foram adicionados e quantos foram atualizados.
 */
export async function syncCatalogo(
  rows: PedidoRow[],
  categoria: string,
): Promise<{ added: number; updated: number }> {
  const existing = await readCatalogo();
  const byKey = new Map(existing.map((item) => [item.id, item]));
  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();
  const toUpsert: CatalogoItem[] = [];

  for (const row of rows) {
    const codigo     = (row.codigo     ?? "").trim();
    const descricao  = (row.descricao  ?? "").trim();
    const fornecedor = (row.fornecedor ?? "").trim();
    const precoCompra =
      typeof row.precoCompra === "number" ? row.precoCompra : null;

    if (!codigo && !descricao) continue;

    const key = makeKey(codigo, descricao);

    if (byKey.has(key)) {
      const item = byKey.get(key)!;
      let changed = false;

      if (precoCompra !== null && item.precoCompra !== precoCompra) {
        item.precoCompra = precoCompra; changed = true;
      }
      if (fornecedor && !item.fornecedores.includes(fornecedor)) {
        item.fornecedores.push(fornecedor); changed = true;
      }
      if (!item.categorias.includes(categoria)) {
        item.categorias.push(categoria); changed = true;
      }
      if (!item.codigo && codigo) {
        item.codigo = codigo; changed = true;
      }
      if (changed) {
        item.ultimaAtualizacao = now;
        updated++;
        toUpsert.push(item);
      }
    } else {
      const newItem: CatalogoItem = {
        id: key,
        codigo,
        descricao,
        precoCompra,
        fornecedores: fornecedor ? [fornecedor] : [],
        categorias:   [categoria],
        ultimaAtualizacao: now,
      };
      byKey.set(key, newItem);
      toUpsert.push(newItem);
      added++;
    }
  }

  if (toUpsert.length > 0) await upsertCatalogoItems(toUpsert);
  return { added, updated };
}

/** Alias para compatibilidade — faz upsert dos itens fornecidos. */
export async function writeCatalogo(items: CatalogoItem[]): Promise<void> {
  await upsertCatalogoItems(items);
}
