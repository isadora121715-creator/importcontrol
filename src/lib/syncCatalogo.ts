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

export function readCatalogo(): CatalogoItem[] {
  try {
    const raw = window.localStorage.getItem(CATALOGO_KEY);
    return raw ? (JSON.parse(raw) as CatalogoItem[]) : [];
  } catch {
    return [];
  }
}

export function writeCatalogo(items: CatalogoItem[]): void {
  window.localStorage.setItem(CATALOGO_KEY, JSON.stringify(items));
}

/** Gera uma chave estável para identificar o item no catálogo. */
function makeKey(codigo: string, descricao: string): string {
  if (codigo) return codigo.trim().toUpperCase();
  return descricao.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 60);
}

/**
 * Sincroniza um array de PedidoRow com o catálogo persistido no localStorage.
 * - Novos itens são adicionados.
 * - Itens existentes têm precoCompra, fornecedores e categorias atualizados se necessário.
 * Retorna quantos itens foram adicionados e quantos foram atualizados.
 */
export function syncCatalogo(
  rows: PedidoRow[],
  categoria: string,
): { added: number; updated: number } {
  const existing = readCatalogo();
  const byKey = new Map(existing.map((item) => [item.id, item]));
  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const row of rows) {
    const codigo    = (row.codigo    ?? "").trim();
    const descricao = (row.descricao ?? "").trim();
    const fornecedor = (row.fornecedor ?? "").trim();
    const precoCompra =
      typeof row.precoCompra === "number" ? row.precoCompra : null;

    if (!codigo && !descricao) continue;

    const key = makeKey(codigo, descricao);

    if (byKey.has(key)) {
      const item = byKey.get(key)!;
      let changed = false;

      // Atualiza preço de compra (sempre usa o mais recente)
      if (precoCompra !== null && item.precoCompra !== precoCompra) {
        item.precoCompra = precoCompra;
        changed = true;
      }
      // Adiciona fornecedor se inédito
      if (fornecedor && !item.fornecedores.includes(fornecedor)) {
        item.fornecedores.push(fornecedor);
        changed = true;
      }
      // Adiciona categoria se inédita
      if (!item.categorias.includes(categoria)) {
        item.categorias.push(categoria);
        changed = true;
      }
      // Garante que codigo seja preenchido se estava vazio
      if (!item.codigo && codigo) {
        item.codigo = codigo;
        changed = true;
      }

      if (changed) {
        item.ultimaAtualizacao = now;
        updated++;
      }
    } else {
      byKey.set(key, {
        id: key,
        codigo,
        descricao,
        precoCompra,
        fornecedores: fornecedor ? [fornecedor] : [],
        categorias: [categoria],
        ultimaAtualizacao: now,
      });
      added++;
    }
  }

  writeCatalogo(Array.from(byKey.values()));
  return { added, updated };
}
