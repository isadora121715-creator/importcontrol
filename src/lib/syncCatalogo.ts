import { supabase } from "@/integrations/supabase/client";
import type { PedidoRow } from "./parseExcel";
import { readPedidosCache } from "./pedidosPerformance";

export const CATALOGO_KEY = "importcontrol.catalogo.v1";

export interface CatalogoItem {
  id: string;               // codigo (normalizado) ou hash da descrição
  codigo: string;
  descricao: string;
  precoCompra: number | null;
  precoVenda:  number | null;
  fornecedores: string[];   // lista de fornecedores únicos
  categorias: string[];     // Tubos | Válvulas | Conexões
  ultimaAtualizacao: string; // ISO date
  // Display-only: todos os preços únicos encontrados nos pedidos (não persistidos no banco)
  precosCompra?: number[];
  precosVenda?: number[];
}

// ── conversão banco ↔ domínio ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToItem(row: any): CatalogoItem {
  return {
    id:                row.id as string,
    codigo:           (row.codigo         as string) ?? "",
    descricao:        (row.descricao      as string) ?? "",
    precoCompra:       row.preco_compra != null ? Number(row.preco_compra) : null,
    precoVenda:        row.preco_venda  != null ? Number(row.preco_venda)  : null,
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
    preco_venda:        i.precoVenda,
    fornecedores:       i.fornecedores,
    categorias:         i.categorias,
    ultima_atualizacao: i.ultimaAtualizacao,
  };
}

// ── leitura paginada de catalogo_materiais ────────────────────────────────────
export async function readCatalogo(): Promise<CatalogoItem[]> {
  const PAGE = 1000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = [];

  for (let from = 0; ; from += PAGE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("catalogo_materiais")
      .select("*")
      .order("ultima_atualizacao", { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("readCatalogo error:", error);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (all as any[]).map(rowToItem);
}

// ── leitura paginada de pedidos (para catálogo ao vivo) ───────────────────────
async function fetchPedidosForCatalog(): Promise<
  Array<{
    codigo:       string | null;
    descricao:    string | null;
    preco_compra: number | null;
    preco_venda:  number | null;
    fornecedor:   string | null;
    categoria:    string;
  }>
> {
  const PAGE = 500;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = [];

  for (let from = 0; ; from += PAGE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("pedidos")
      .select("codigo,descricao,preco_compra,preco_venda,fornecedor,categoria")
      .in("categoria", ["Conexões", "Tubos", "Válvulas"])
      .range(from, from + PAGE - 1);

    if (error) { console.error("fetchPedidosForCatalog error:", error); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }

  // If Supabase returned nothing (empty DB or RLS), fall back to localStorage caches
  if (all.length === 0) {
    for (const cat of ["Conexões", "Tubos", "Válvulas"] as const) {
      const cache = readPedidosCache(cat);
      if (!cache?.rows?.length) continue;
      for (const row of cache.rows) {
        all.push({
          codigo:       row.codigo       ?? null,
          descricao:    row.descricao    ?? null,
          preco_compra: row.precoCompra  ?? null,
          preco_venda:  row.precoVenda   ?? null,
          fornecedor:   row.fornecedor   ?? null,
          categoria:    cat,
        });
      }
    }
  }

  return all;
}

/**
 * Constrói o catálogo ao vivo:
 * 1. Lê todos os pedidos (Conexões/Tubos/Válvulas) e agrega por chave.
 * 2. Mescla com itens manuais de catalogo_materiais (preço manual tem prioridade).
 * Isso garante que TODOS os itens dos pedidos apareçam no catálogo, mesmo que
 * syncCatalogo não tenha sido chamado ainda.
 */
export async function readCatalogoComPedidos(): Promise<CatalogoItem[]> {
  const [pedidosRows, manualItems] = await Promise.all([
    fetchPedidosForCatalog(),
    readCatalogo(),
  ]);

  const now = new Date().toISOString();
  const byKey = new Map<string, CatalogoItem>();

  /** Adiciona um valor único a um array de números, ignorando 0 e NaN. */
  const pushUnique = (arr: number[], val: number) => {
    if (val > 0 && !arr.includes(val)) arr.push(val);
  };

  // Primeira passagem: agrupa pedidos por chave + coleta TODOS os preços únicos
  for (const row of pedidosRows) {
    const codigo    = (row.codigo    ?? "").trim();
    const descricao = (row.descricao ?? "").trim();
    if (!codigo && !descricao) continue;

    const key        = makeKey(codigo, descricao);
    const fornecedor = (row.fornecedor ?? "").trim();
    const categoria  = (row.categoria  ?? "");
    const precoCompra: number | null = row.preco_compra != null ? Number(row.preco_compra) : null;
    const precoVenda:  number | null = row.preco_venda  != null ? Number(row.preco_venda)  : null;

    if (byKey.has(key)) {
      const item = byKey.get(key)!;
      if (fornecedor && !item.fornecedores.includes(fornecedor)) item.fornecedores.push(fornecedor);
      if (categoria  && !item.categorias.includes(categoria))   item.categorias.push(categoria);
      if (precoCompra !== null) {
        if (item.precoCompra === null) item.precoCompra = precoCompra;
        if (!item.precosCompra) item.precosCompra = [];
        pushUnique(item.precosCompra, precoCompra);
      }
      if (precoVenda !== null) {
        if (item.precoVenda === null) item.precoVenda = precoVenda;
        if (!item.precosVenda) item.precosVenda = [];
        pushUnique(item.precosVenda, precoVenda);
      }
    } else {
      byKey.set(key, {
        id:                key,
        codigo,
        descricao,
        precoCompra,
        precoVenda,
        precosCompra:      precoCompra !== null && precoCompra > 0 ? [precoCompra] : [],
        precosVenda:       precoVenda  !== null && precoVenda  > 0 ? [precoVenda]  : [],
        fornecedores:      fornecedor ? [fornecedor] : [],
        categorias:        categoria  ? [categoria]  : [],
        ultimaAtualizacao: now,
      });
    }
  }

  // Segunda passagem: mescla itens manuais de catalogo_materiais
  // O preço manual tem prioridade como valor primário mas os preços dos pedidos são mantidos
  for (const item of manualItems) {
    if (byKey.has(item.id)) {
      const existing = byKey.get(item.id)!;
      // Preços manuais sobrescrevem o primário
      if (item.precoCompra !== null) {
        existing.precoCompra = item.precoCompra;
        // Garante que o preço manual apareça no array (sem duplicar)
        if (!existing.precosCompra) existing.precosCompra = [];
        pushUnique(existing.precosCompra, item.precoCompra);
      }
      if (item.precoVenda !== null) {
        existing.precoVenda = item.precoVenda;
        if (!existing.precosVenda) existing.precosVenda = [];
        pushUnique(existing.precosVenda, item.precoVenda);
      }
      for (const f of item.fornecedores) {
        if (!existing.fornecedores.includes(f)) existing.fornecedores.push(f);
      }
      for (const c of item.categorias) {
        if (!existing.categorias.includes(c)) existing.categorias.push(c);
      }
      existing.ultimaAtualizacao = item.ultimaAtualizacao;
    } else {
      // Item adicionado manualmente (não vem de pedidos)
      const manualWithArrays = {
        ...item,
        precosCompra: item.precoCompra !== null && item.precoCompra > 0 ? [item.precoCompra] : [],
        precosVenda:  item.precoVenda  !== null && item.precoVenda  > 0 ? [item.precoVenda]  : [],
      };
      byKey.set(item.id, manualWithArrays);
    }
  }

  // Ordena os arrays de preços em ordem crescente para exibição consistente
  for (const item of byKey.values()) {
    item.precosCompra?.sort((a, b) => a - b);
    item.precosVenda?.sort((a, b) => a - b);
  }

  return Array.from(byKey.values());
}

// ── upsert (adicionar ou atualizar itens) ─────────────────────────────────────
export async function upsertCatalogoItems(items: CatalogoItem[]): Promise<void> {
  if (items.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("catalogo_materiais")
    .upsert(items.map(itemToRow), { onConflict: "id" });
  if (error) {
    // Log but don't throw — column may not exist yet or RLS may block.
    // Catalog data will still be available from localStorage pedidos cache.
    console.warn("upsertCatalogoItems (non-fatal):", error.message ?? error);
  }
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
    const precoCompra: number | null =
      typeof row.precoCompra === "number" && row.precoCompra > 0 ? row.precoCompra : null;
    const precoVenda: number | null =
      typeof row.precoVenda === "number" && row.precoVenda > 0 ? row.precoVenda : null;

    if (!codigo && !descricao) continue;

    const key = makeKey(codigo, descricao);

    if (byKey.has(key)) {
      const item = byKey.get(key)!;
      let changed = false;

      if (precoCompra !== null && (item.precoCompra === null || item.precoCompra !== precoCompra)) {
        item.precoCompra = precoCompra; changed = true;
      }
      if (precoVenda !== null && (item.precoVenda === null || item.precoVenda !== precoVenda)) {
        item.precoVenda = precoVenda; changed = true;
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
        precoVenda,
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
