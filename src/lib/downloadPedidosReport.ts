import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { PedidoRow } from "./parseExcel";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtUSD = (v: number) =>
  `$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtQty = (v: number | null) =>
  v != null ? v.toLocaleString("pt-BR") : "—";

const BLUE: [number, number, number] = [30, 64, 175];
const BLUE_LIGHT: [number, number, number] = [239, 246, 255];

// ── KPI helper ────────────────────────────────────────────────────────────────
function calcKpis(rows: PedidoRow[]) {
  const pos = new Set<string>();
  const fornecedores = new Set<string>();
  const clientes = new Set<string>();
  const statusCount: Record<string, number> = {};
  let valorCompra = 0;
  let valorVenda = 0;

  rows.forEach((r) => {
    if (r.po) pos.add(r.po);
    if (r.fornecedor) fornecedores.add(r.fornecedor);
    if (r.cliente) clientes.add(r.cliente);
    const s = (r.statusCompraVenda ?? r.statusFornecedor ?? "Outro").trim() || "Outro";
    statusCount[s] = (statusCount[s] ?? 0) + 1;
    const qc = typeof r.qtyCompra === "number" && r.qtyCompra > 0 ? r.qtyCompra : 1;
    const qv = typeof r.qtyVenda === "number" ? r.qtyVenda : 0;
    if (typeof r.precoCompra === "number") valorCompra += r.precoCompra * qc;
    if (typeof r.precoVenda === "number") valorVenda += r.precoVenda * qv;
  });

  const statusRows = Object.entries(statusCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return { pos: pos.size, fornecedores: fornecedores.size, clientes: clientes.size, valorCompra, valorVenda, statusRows };
}

// ── Group-by helpers ──────────────────────────────────────────────────────────
function groupBy(rows: PedidoRow[], keyFn: (r: PedidoRow) => string | null) {
  const map = new Map<string, { count: number; valorCompra: number; valorVenda: number; pos: Set<string> }>();
  rows.forEach((r) => {
    const k = keyFn(r) ?? "(sem valor)";
    if (!map.has(k)) map.set(k, { count: 0, valorCompra: 0, valorVenda: 0, pos: new Set() });
    const acc = map.get(k)!;
    acc.count += 1;
    if (r.po) acc.pos.add(r.po);
    const qc = typeof r.qtyCompra === "number" && r.qtyCompra > 0 ? r.qtyCompra : 1;
    const qv = typeof r.qtyVenda === "number" ? r.qtyVenda : 0;
    if (typeof r.precoCompra === "number") acc.valorCompra += r.precoCompra * qc;
    if (typeof r.precoVenda === "number") acc.valorVenda += r.precoVenda * qv;
  });
  return Array.from(map.entries())
    .map(([k, v]) => ({ chave: k, count: v.count, pos: v.pos.size, valorCompra: v.valorCompra, valorVenda: v.valorVenda }))
    .sort((a, b) => b.count - a.count);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXCEL
// ═══════════════════════════════════════════════════════════════════════════════
export function downloadPedidosXLSX(rows: PedidoRow[], categoria: string) {
  if (rows.length === 0) return false;
  const wb = XLSX.utils.book_new();
  const today = new Date().toLocaleDateString("pt-BR");
  const kpis = calcKpis(rows);

  // ── Sheet 1: KPIs ──────────────────────────────────────────────────────────
  const kpiData: unknown[][] = [
    [`HCI — Relatório ${categoria}`, "", today],
    [],
    ["Indicador", "Valor"],
    ["Total de Itens", rows.length],
    ["POs Únicas", kpis.pos],
    ["Fornecedores Únicos", kpis.fornecedores],
    ["Clientes Únicos", kpis.clientes],
    ["Valor Total de Compra (USD)", kpis.valorCompra],
    ["Valor Total de Venda (R$)", kpis.valorVenda],
    [],
    ["Status", "Quantidade"],
    ...kpis.statusRows.map(([s, n]) => [s, n]),
  ];
  const wsKpi = XLSX.utils.aoa_to_sheet(kpiData);
  wsKpi["!cols"] = [{ wch: 30 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsKpi, "KPIs");

  // ── Sheet 2: Pedidos (tabela completa) ────────────────────────────────────
  const pedidosData = rows.map((r) => ({
    "PI": r.pi ?? "",
    "Item": r.item ?? "",
    "Cliente": r.cliente ?? "",
    "Código": r.codigo ?? "",
    "Código Compra": r.codigoCompra ?? "",
    "Descrição": r.descricao ?? "",
    "Qty Venda": r.qtyVenda ?? "",
    "Qty Compra": r.qtyCompra ?? "",
    "Preço Venda (R$)": r.precoVenda ?? "",
    "Preço Compra (USD)": r.precoCompra ?? "",
    "PO": r.po ?? "",
    "Fornecedor": r.fornecedor ?? "",
    "Status Fornecedor": r.statusFornecedor ?? "",
    "Status Compra/Venda": r.statusCompraVenda ?? "",
    "Prazo Cliente": r.prazoCliente ?? "",
    "Entrega Fornecedor": r.entregaFornecedor ?? "",
    "Data Compra": r.dataCompra ?? "",
    "Prazo Inicial Forn.": r.prazoInicialFornecedor ?? "",
    "Dias Faltam": r.diasFaltam ?? "",
    "Dias Atraso": r.diasAtraso ?? "",
    "ETD": r.etd ?? "",
    "ETA": r.eta ?? "",
    "Chegada HCI": r.chegadaHci ?? "",
    "Embarque": r.embarque ?? "",
    "Follow Up": r.followUp ?? "",
  }));
  const wsPedidos = XLSX.utils.json_to_sheet(pedidosData);
  wsPedidos["!cols"] = [
    { wch: 8 }, { wch: 8 }, { wch: 22 }, { wch: 18 }, { wch: 18 },
    { wch: 32 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 16 },
    { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
    { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPedidos, "Pedidos");

  // ── Sheet 3: Por Fornecedor ───────────────────────────────────────────────
  const byForn = groupBy(rows, (r) => r.fornecedor);
  const wsForn = XLSX.utils.aoa_to_sheet([
    ["Fornecedor", "Itens", "POs Únicas", "Valor Compra (USD)", "Valor Venda (R$)"],
    ...byForn.map((v) => [v.chave, v.count, v.pos, v.valorCompra, v.valorVenda]),
  ]);
  wsForn["!cols"] = [{ wch: 28 }, { wch: 8 }, { wch: 12 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsForn, "Por Fornecedor");

  // ── Sheet 4: Por Status ───────────────────────────────────────────────────
  const byStatus = groupBy(rows, (r) => r.statusCompraVenda ?? r.statusFornecedor);
  const wsStatus = XLSX.utils.aoa_to_sheet([
    ["Status", "Itens", "POs Únicas", "Valor Compra (USD)", "Valor Venda (R$)"],
    ...byStatus.map((v) => [v.chave, v.count, v.pos, v.valorCompra, v.valorVenda]),
  ]);
  wsStatus["!cols"] = [{ wch: 24 }, { wch: 8 }, { wch: 12 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsStatus, "Por Status");

  // ── Sheet 5: Por Cliente ──────────────────────────────────────────────────
  const byCliente = groupBy(rows, (r) => r.cliente);
  const wsCliente = XLSX.utils.aoa_to_sheet([
    ["Cliente", "Itens", "POs Únicas", "Valor Compra (USD)", "Valor Venda (R$)"],
    ...byCliente.map((v) => [v.chave, v.count, v.pos, v.valorCompra, v.valorVenda]),
  ]);
  wsCliente["!cols"] = [{ wch: 24 }, { wch: 8 }, { wch: 12 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsCliente, "Por Cliente");

  XLSX.writeFile(wb, `Relatorio_${categoria}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PDF
// ═══════════════════════════════════════════════════════════════════════════════
export function downloadPedidosPDF(rows: PedidoRow[], categoria: string) {
  if (rows.length === 0) return false;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString("pt-BR");
  const kpis = calcKpis(rows);

  // ── Desenha cabeçalho reutilizável ────────────────────────────────────────
  const drawHeader = (subtitle: string) => {
    // Barra azul
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, pageW, 20, "F");
    // HCI em destaque
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("HCI", 10, 13);
    // Linha separadora vertical
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.4);
    doc.line(24, 4, 24, 16);
    // Subtítulo
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(subtitle, 27, 13);
    // Data
    doc.setFontSize(8);
    doc.text(`Gerado em: ${today}`, pageW - 10, 13, { align: "right" });
  };

  // ═════════════════════════════════════════════════════════════════════
  // Página 1: KPIs
  // ═════════════════════════════════════════════════════════════════════
  drawHeader(`Relatório ${categoria} — Visão Geral`);

  // Bloco de KPIs em cards (2 colunas)
  const kpiItems = [
    { label: "Total de Itens", value: rows.length.toLocaleString("pt-BR") },
    { label: "POs Únicas", value: kpis.pos.toLocaleString("pt-BR") },
    { label: "Fornecedores", value: kpis.fornecedores.toLocaleString("pt-BR") },
    { label: "Clientes", value: kpis.clientes.toLocaleString("pt-BR") },
    { label: "Valor Total de Compra", value: fmtUSD(kpis.valorCompra) },
    { label: "Valor Total de Venda", value: fmtBRL(kpis.valorVenda) },
  ];

  const cardW = (pageW - 20) / 3;
  const cardH = 18;
  const startX = 10;
  let startY = 26;

  kpiItems.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = startX + col * (cardW + 2);
    const y = startY + row * (cardH + 3);
    // Card background
    doc.setFillColor(...BLUE_LIGHT);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "F");
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "S");
    // Label
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(item.label.toUpperCase(), x + 4, y + 6);
    // Value
    doc.setTextColor(...BLUE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(item.value, x + 4, y + 14);
  });

  // Tabela de status
  startY = startY + 2 * (cardH + 3) + 6;
  doc.setTextColor(...BLUE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Distribuição por Status", 10, startY);

  autoTable(doc, {
    startY: startY + 2,
    head: [["Status", "Qtde", "%"]],
    body: kpis.statusRows.map(([s, n]) => [
      s,
      n.toLocaleString("pt-BR"),
      `${((n / rows.length) * 100).toFixed(1)}%`,
    ]),
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: BLUE_LIGHT },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    margin: { left: 10, right: pageW / 2 + 5 },
  });

  // Tabela por fornecedor ao lado
  const byForn = groupBy(rows, (r) => r.fornecedor).slice(0, 12);
  autoTable(doc, {
    startY: startY + 2,
    head: [["Fornecedor", "Itens", "Valor Compra (USD)"]],
    body: byForn.map((v) => [v.chave, v.count.toLocaleString("pt-BR"), fmtUSD(v.valorCompra)]),
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: BLUE_LIGHT },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    margin: { left: pageW / 2 + 5, right: 10 },
  });

  // ═════════════════════════════════════════════════════════════════════
  // Página 2: Tabela de pedidos
  // ═════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawHeader(`Relatório ${categoria} — Listagem de Pedidos`);

  const tableRows = rows.map((r) => [
    r.pi != null ? String(r.pi) : "—",
    r.item ?? "—",
    r.cliente ?? "—",
    r.descricao ? (r.descricao.length > 34 ? r.descricao.slice(0, 33) + "…" : r.descricao) : "—",
    r.po ?? "—",
    r.fornecedor ? (r.fornecedor.length > 20 ? r.fornecedor.slice(0, 19) + "…" : r.fornecedor) : "—",
    fmtQty(r.qtyCompra),
    r.precoCompra != null ? fmtUSD(r.precoCompra) : "—",
    r.precoVenda != null ? fmtBRL(r.precoVenda) : "—",
    r.statusCompraVenda ?? r.statusFornecedor ?? "—",
    r.prazoCliente ?? "—",
    r.eta ?? "—",
  ]);

  autoTable(doc, {
    startY: 24,
    head: [["PI", "Item", "Cliente", "Descrição", "PO", "Fornecedor", "Qty", "Preço Compra", "Preço Venda", "Status", "Prazo", "ETA"]],
    body: tableRows,
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", fontSize: 7 },
    bodyStyles: { fontSize: 6.5 },
    alternateRowStyles: { fillColor: BLUE_LIGHT },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 10 },
      2: { cellWidth: 22 },
      3: { cellWidth: 42 },
      4: { cellWidth: 18 },
      5: { cellWidth: 26 },
      6: { cellWidth: 10, halign: "right" },
      7: { cellWidth: 22, halign: "right" },
      8: { cellWidth: 22, halign: "right" },
      9: { cellWidth: 22 },
      10: { cellWidth: 18 },
      11: { cellWidth: 16 },
    },
    margin: { left: 8, right: 8 },
    didDrawPage: (data) => {
      // Re-draw header on every new page
      if (data.pageNumber > 1) {
        drawHeader(`Relatório ${categoria} — Listagem de Pedidos`);
      }
      // Footer
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Pág. ${data.pageNumber} — HCI Importcontrol — ${today}`,
        pageW / 2,
        doc.internal.pageSize.getHeight() - 4,
        { align: "center" },
      );
    },
  });

  doc.save(`Relatorio_${categoria}_${new Date().toISOString().slice(0, 10)}.pdf`);
  return true;
}
