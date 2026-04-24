import * as XLSX from "xlsx";

interface OrderData {
  pi: number | null;
  cliente: string | null;
  codigo: string | null;
  codigoCompra: string | null;
  descricao: string | null;
  precoVenda: number | null;
  precoCompra: number | null;
  qtyVenda: number | null;
  qtyCompra: number | null;
  po: string | null;
  fornecedor: string | null;
  statusFornecedor: string | null;
  statusCompraVenda: string | null;
  prazoCliente: string | null;
  diasFaltam: number | null;
  diasAtraso: number | null;
  followUp: string | null;
  chegadaHci: string | null;
  eta: string | null;
  etd: string | null;
  item: string | null;
  embarque: string | null;
  entregaFornecedor: string | null;
  [key: string]: unknown;
}

export function downloadDashboard(data: OrderData[], categoria: string) {
  if (data.length === 0) return false;

  const rows = data.map((d) => ({
    PI: d.pi ?? "",
    Item: d.item ?? "",
    Cliente: d.cliente ?? "",
    Código: d.codigo ?? "",
    "Código Compra": d.codigoCompra ?? "",
    Descrição: d.descricao ?? "",
    "Qty Venda": d.qtyVenda ?? "",
    "Qty Compra": d.qtyCompra ?? "",
    "Preço Venda": d.precoVenda ?? "",
    "Preço Compra": d.precoCompra ?? "",
    PO: d.po ?? "",
    Fornecedor: d.fornecedor ?? "",
    "Status Fornecedor": d.statusFornecedor ?? "",
    "Status Compra/Venda": d.statusCompraVenda ?? "",
    "Prazo Cliente": d.prazoCliente ?? "",
    "Entrega Fornecedor": d.entregaFornecedor ?? "",
    "Dias Faltam": d.diasFaltam ?? "",
    "Dias Atraso": d.diasAtraso ?? "",
    ETD: d.etd ?? "",
    ETA: d.eta ?? "",
    Embarque: d.embarque ?? "",
    "Chegada HCI": d.chegadaHci ?? "",
    "Follow Up": d.followUp ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 18 }, { wch: 18 },
    { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 14 }, { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, categoria);

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Dashboard_${categoria}_${today}.xlsx`);
  return true;
}
