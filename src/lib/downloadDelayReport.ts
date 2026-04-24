import * as XLSX from "xlsx";
import { getActionTexts } from "./getActionPlan";
import { supabase } from "@/integrations/supabase/client";

interface OrderData {
  pi: number | null;
  cliente: string | null;
  codigo: string | null;
  descricao: string | null;
  precoVenda: number | null;
  precoCompra: number | null;
  qtyVenda: number | null;
  qtyCompra: number | null;
  fornecedor: string | null;
  statusCompraVenda: string | null;
  statusFornecedor: string | null;
  diasFaltam: number | null;
  diasAtraso: number | null;
  po: string | null;
  chegadaHci: string | null;
  prazoCliente: string | null;
  item?: string | null;
  entregaFornecedor?: string | null;
  [key: string]: unknown;
}

export async function downloadDelayReport(data: OrderData[], categoria: string = "Conexões") {
  const delayed = data.filter(
    (d) =>
      d.statusCompraVenda === "Crítico" ||
      d.statusCompraVenda === "Atrasado" ||
      d.statusCompraVenda === "Verificar aéreo" ||
      (d.statusFornecedor === "Atrasado" && d.statusCompraVenda !== "Chegou" && d.statusCompraVenda !== "Estoque")
  );

  if (delayed.length === 0) {
    return false;
  }

  // Fetch all saved actions for this categoria
  const { data: savedActions } = await supabase
    .from("action_plans")
    .select("pi, po, action_text")
    .eq("categoria", categoria);

  const savedMap: Record<string, string[]> = {};
  (savedActions || []).forEach((a: { pi: number | null; po: string | null; action_text: string }) => {
    const key = `${a.pi ?? ""}|${a.po ?? ""}`;
    if (!savedMap[key]) savedMap[key] = [];
    savedMap[key].push(a.action_text);
  });

  // === Aba 1: Pedidos em Atraso ===
  const rows = delayed.map((order) => {
    const actions = getActionTexts(order);
    const suggestedActions = actions.map((a) => `[${a.priority === "alta" ? "ALTA" : a.priority === "média" ? "MÉDIA" : "BAIXA"}] ${a.text}`).join("\n");
    const key = `${order.pi ?? ""}|${order.po ?? ""}`;
    const saved = savedMap[key];
    const savedText = saved ? saved.map((t) => `[SALVA] ${t}`).join("\n") : "";
    const allActions = [suggestedActions, savedText].filter(Boolean).join("\n");

    return {
      PI: order.pi ?? "",
      Item: order.item ?? "",
      Cliente: order.cliente ?? "",
      QTY: order.qtyCompra ?? order.qtyVenda ?? "",
      PO: order.po ?? "",
      Fornecedor: order.fornecedor ?? "",
      Código: order.codigo ?? "",
      "Prazo Fornecedor": order.entregaFornecedor ?? "",
      "Prazo Cliente": order.prazoCliente ?? "",
      Status: order.statusCompraVenda ?? "",
      "Plano de Ação COMEX": allActions,
      "Plano de Ação Marcos": "",
    };
  });

  const ws1 = XLSX.utils.json_to_sheet(rows);
  ws1["!cols"] = [
    { wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 8 }, { wch: 14 },
    { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
    { wch: 60 }, { wch: 40 },
  ];

  // === Aba 2: Cálculo Margem Aérea ===
  const nacFactor = 8;
  const margemRows = delayed.map((order) => {
    const precoForn = order.precoCompra ?? 0;
    const precoCliente = order.precoVenda ?? 0;
    const nacionalizado = precoForn * nacFactor;
    const margem = nacionalizado > 0 ? precoCliente / nacionalizado : 0;
    const fator = precoForn > 0 ? precoCliente / precoForn : 0;

    return {
      PI: order.pi ?? "",
      Item: order.item ?? "",
      Cliente: order.cliente ?? "",
      QTY: order.qtyCompra ?? order.qtyVenda ?? "",
      PO: order.po ?? "",
      Fornecedor: order.fornecedor ?? "",
      "Item Código": order.codigo ?? "",
      "Prazo Fornecedor": order.entregaFornecedor ?? "",
      "Prazo Cliente": order.prazoCliente ?? "",
      Status: order.statusCompraVenda ?? "",
      "Plano de Ação COMEX": "",
      "Plano de Ação Marcos": "",
      "Preço Unit Fornecedor": precoForn,
      "Preço Unit Cliente": precoCliente,
      "Nacionalizado x8": nacionalizado,
      "Margem/Markup": margem,
      Fator: fator,
      "Peso USD/KG": "",
      "USD/KG": "",
      "Item+Frete": "",
      "Nacionalizado x8 (Aéreo)": "",
      "Nova Margem": "",
      "Novo Fator": "",
    };
  });

  const ws2 = XLSX.utils.json_to_sheet(margemRows);

  const colLetters = {
    precoForn: "M",
    precoCliente: "N",
    peso: "R",
    usdKg: "S",
    itemFrete: "T",
    nacAereo: "U",
    novaMargem: "V",
    novoFator: "W",
  };

  for (let i = 0; i < delayed.length; i++) {
    const r = i + 2;
    ws2[`${colLetters.itemFrete}${r}`] = { t: "n", f: `${colLetters.precoForn}${r}+(${colLetters.peso}${r}*${colLetters.usdKg}${r})` };
    ws2[`${colLetters.nacAereo}${r}`] = { t: "n", f: `${colLetters.itemFrete}${r}*8` };
    ws2[`${colLetters.novaMargem}${r}`] = { t: "n", f: `IF(${colLetters.nacAereo}${r}=0,"",${colLetters.precoCliente}${r}/${colLetters.nacAereo}${r})` };
    ws2[`${colLetters.novoFator}${r}`] = { t: "n", f: `IF(${colLetters.itemFrete}${r}=0,"",${colLetters.precoCliente}${r}/${colLetters.itemFrete}${r})` };
  }

  const range = XLSX.utils.decode_range(ws2["!ref"] || "A1");
  if (range.e.c < 22) range.e.c = 22;
  ws2["!ref"] = XLSX.utils.encode_range(range);

  ws2["!cols"] = [
    { wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 8 }, { wch: 14 },
    { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
    { wch: 40 }, { wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 14 },
    { wch: 18 }, { wch: 14 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Pedidos em Atraso");
  XLSX.utils.book_append_sheet(wb, ws2, "Cálculo Margem Aérea");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Relatorio_Atrasos_PlanoAcao_${today}.xlsx`);
  return true;
}
