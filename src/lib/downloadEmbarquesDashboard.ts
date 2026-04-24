import * as XLSX from "xlsx";

interface OrderData {
  pi: number | null;
  item: string | null;
  cliente: string | null;
  codigo: string | null;
  descricao: string | null;
  precoVenda: number | null;
  precoCompra: number | null;
  qtyVenda: number | null;
  qtyCompra: number | null;
  po: string | null;
  fornecedor: string | null;
  statusCompraVenda: string | null;
  prazoCliente: string | null;
  diasFaltam: number | null;
  diasAtraso: number | null;
  followUp: string | null;
  chegadaHci: string | null;
  eta: string | null;
  etd: string | null;
  entregaFornecedor: string | null;
  dataCompra: string | null;
  prazoInicialFornecedor: string | null;
  embarque: string | null;
  peso: number | null;
  [key: string]: unknown;
}

export function downloadEmbarquesDashboard(data: OrderData[], categoria: string) {
  if (data.length === 0) return false;

  const rows = data.map((d) => ({
    "PI Interno": d.pi ?? "",
    "Item PI": d.item ?? "",
    "Prazo Cliente": d.prazoCliente ?? "",
    "Cliente": d.cliente ?? "",
    "Código": d.codigo ?? "",
    "Descrição": d.descricao ?? "",
    "QTY Venda": d.qtyVenda ?? "",
    "Preço de Venda Unit": d.precoVenda ?? "",
    "QTY Compra": d.qtyCompra ?? "",
    "Preço Unit (USD)": d.precoCompra ?? "",
    "Fornecedor": d.fornecedor ?? "",
    "PO": d.po ?? "",
    "Data Compra": d.dataCompra ?? "",
    "Prazo Inicial Fornecedor": d.prazoInicialFornecedor ?? "",
    "Entrega do Fornecedor": d.entregaFornecedor ?? "",
    "Peso (kg)": d.peso ?? "",
    "Dias Restantes de Produção": d.diasFaltam ?? "",
    "Tempo de Atraso": d.diasAtraso ?? "",
    "ETD": d.etd ?? "",
    "ETA": d.eta ?? "",
    "Chegada na HCI": d.chegadaHci ?? "",
    "Embarque": d.embarque ?? "",
    "Status Geral": d.statusCompraVenda ?? "",
    "Follow Up": d.followUp ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 18 },
    { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 16 },
    { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 20 },
    { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
    { wch: 16 }, { wch: 12 }, { wch: 20 }, { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, categoria);

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Planilha_Atualizada_${categoria}_${today}.xlsx`);
  return true;
}
