import * as XLSX from "xlsx";
import type { PedidoRow } from "./parseExcel";

function normalize(header: string): string {
  return header
    .toLowerCase()
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ç/g, "c")
    .replace(/ã/g, "a")
    .replace(/õ/g, "o")
    .replace(/á/g, "a")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u")
    .replace(/â/g, "a")
    .replace(/ê/g, "e")
    .replace(/ô/g, "o");
}

function excelDateToString(serial: number): string {
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400000);
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

const TUBOS_COL_MAP: Record<string, keyof PedidoRow> = {
  // PEDIDO DE VENDA section
  "pi": "pi",
  "item": "item",
  "cliente": "cliente",
  "codigo": "codigo",
  "descricao": "descricao",
  "descri cao": "descricao",
  "qty": "qtyVenda",
  "preco venda": "precoVenda",
  "preco venda total": "precoVendaTotal",
  "prazo cliente": "prazoCliente",
  "recebimento do pedido cliente": "recebimentoPedido",
  "emissao do pedido sistema": "emissaoPedidoSistema",
  "status emissao sistema": "statusEmissao",
  "data recebimento p/ compra": "dataRecebimentoCompra",
  "status para compra": "statusParaCompra",
  "dias atraso": "diasAtraso",
  "status venda/compra": "statusVendaCompra",
  "status venda / compra": "statusVendaCompra",
  "venda em dias": "vendaEmDias",
  // PEDIDO DE COMPRA section
  "po": "po",
  "fornecedor": "fornecedor",
  "preco compra": "precoCompra",
  "preco compra total": "precoCompraTotal",
  "peso (kg)": "peso",
  "data da compra": "dataCompra",
  "prazo inicial fornecedor": "prazoInicialFornecedor",
  "entrega fornecedor": "entregaFornecedor",
  "entrega do fornecedor": "entregaFornecedor",
  "chegada hci": "chegadaHci",
  "dias que faltam": "diasFaltam",
  "termo de pagamento": "termoPagamento",
  "status producao": "statusProducao",
  "inspecao": "inspecao",
  "data da inspecao": "dataInspecao",
  // EMBARQUE section
  "embarque": "embarque",
  "etd": "etd",
  "eta": "eta",
  "follow up": "followUp",
  "follow-up": "followUp",
  "follow up ": "followUp",
  "status fornecedor": "statusFornecedor",
  "status compra / venda": "statusCompraVenda",
  "status embarque": "statusEmbarque",
  "obs": "obs",
  "chegou?": "chegou",
};

const DATE_FIELDS = new Set(["prazoCliente", "chegadaHci", "eta", "etd", "embarque", "entregaFornecedor", "dataCompra", "prazoInicialFornecedor", "emissaoPedidoSistema", "dataRecebimentoCompra", "dataInspecao", "recebimentoPedido"]);

export function parseExcelTubos(file: File): Promise<PedidoRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

        // Find header row containing "PI"
        let headerRowIndex = 0;
        for (let r = range.s.r; r <= Math.min(range.s.r + 5, range.e.r); r++) {
          const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
          if (cell && typeof cell.v === "string" && normalize(String(cell.v)) === "pi") {
            headerRowIndex = r;
            break;
          }
        }

        const maxCol = Math.min(range.e.c, 42);
        const headers: string[] = [];
        for (let c = range.s.c; c <= maxCol; c++) {
          const cell = sheet[XLSX.utils.encode_cell({ r: headerRowIndex, c })];
          headers.push(cell ? String(cell.v).trim() : `__col_${c}`);
        }

        const rows: PedidoRow[] = [];
        let lastPI: unknown = null;

        for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
          const mapped: Record<string, unknown> = {};
          let hasAnyValue = false;

          for (let c = range.s.c; c <= maxCol; c++) {
            const cell = sheet[XLSX.utils.encode_cell({ r, c })];
            const value = cell ? cell.v : null;
            if (value !== null && value !== undefined && value !== "") hasAnyValue = true;

            const hdrIdx = c - range.s.c;
            if (hdrIdx >= headers.length) continue;

            const norm = normalize(headers[hdrIdx]);
            const field = TUBOS_COL_MAP[norm];
            if (field) {
              if (DATE_FIELDS.has(field as string) && typeof value === "number") {
                mapped[field] = excelDateToString(value);
              } else if (value !== null && value !== undefined && value !== "") {
                mapped[field] = value;
              }
            }
          }

          // Forward-fill PI value if empty, and only add rows with meaningful data
          if (hasAnyValue) {
            if (mapped["pi"]) {
              lastPI = mapped["pi"];
            } else if (lastPI !== null) {
              mapped["pi"] = lastPI;
            }

            // Add row if it has PI (either original or forward-filled)
            if (mapped["pi"]) {
              rows.push(mapped as PedidoRow);
            }
          }
        }

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsArrayBuffer(file);
  });
}
