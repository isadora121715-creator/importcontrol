import * as XLSX from "xlsx";
import type { PedidoRow } from "./parseExcel";

function normalize(header: string): string {
  return header
    .toLowerCase()
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Remove diacritics
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

const VALVE_COL_MAP: Record<string, keyof PedidoRow> = {
  // PEDIDO DE VENDA section
  "pi": "pi",
  "item": "item",
  "cliente": "cliente",
  "codigo": "codigo",
  "descricao": "descricao",
  "descrio": "descricao",
  "qty": "qtyVenda",
  "preco venda": "precoVenda",
  "preco venda ": "precoVenda",
  "preco venda total": "precoVenda",
  "preco venda total ": "precoVenda",
  "prc venda": "precoVenda",
  "preo venda": "precoVenda",
  "prazo cliente": "prazoCliente",
  "recebimento do pedido cliente": "prazoCliente",
  "recebimento do pedido cliente ": "prazoCliente",
  "emissao do pedido sistema": "emissaoPedidoSistema",
  "emissao do pedido sistema ": "emissaoPedidoSistema",
  "status emissao sistema": "statusCompraVenda",
  "status emissao sistema ": "statusCompraVenda",
  "data recebimento p/ compra": "dataRecebimentoCompra",
  "data recebimento p compra": "dataRecebimentoCompra",
  "data recebimento p/ compra ": "dataRecebimentoCompra",
  "status para compra": "statusCompraVenda",
  "dias atraso": "diasAtraso",
  "status venda/compra": "statusCompraVenda",
  "status venda / compra": "statusCompraVenda",
  "venda em dias": "vendaEmDias",
  // PEDIDO DE COMPRA section
  "po": "po",
  "fornecedor": "fornecedor",
  "preco compra": "precoCompra",
  "preco compra ": "precoCompra",
  "preco compra total": "precoCompra",
  "preco compra total ": "precoCompra",
  "prc compra": "precoCompra",
  "preo compra": "precoCompra",
  "peso (kg)": "peso",
  "peso (kg) ": "peso",
  "data da compra": "dataCompra",
  "data da compra ": "dataCompra",
  "prazo inicial fornecedor": "prazoInicialFornecedor",
  "entrega fornecedor": "entregaFornecedor",
  "entrega do fornecedor": "entregaFornecedor",
  "entrega fornecedor ": "entregaFornecedor",
  "entrega do fornecedor ": "entregaFornecedor",
  "chegada hci": "chegadaHci",
  "chegada hci ": "chegadaHci",
  "dias que faltam": "diasFaltam",
  "termo de pagamento": "prazoCliente",
  "status producao": "statusProducao",
  "status producao ": "statusProducao",
  "inspecao": "statusCompraVenda",
  "inspecao ": "statusCompraVenda",
  "data da inspecao": "dataRecebimentoCompra",
  "data da inspecao ": "dataRecebimentoCompra",
  // EMBARQUE section
  "embarque": "embarque",
  "etd": "etd",
  "eta": "eta",
  "follow up": "followUp",
  "follow-up": "followUp",
  "follow up ": "followUp",
  "status fornecedor": "statusFornecedor",
  "status fornecedor ": "statusFornecedor",
  "status compra / venda": "statusCompraVenda",
  "status compra venda": "statusCompraVenda",
  "status compra / venda ": "statusCompraVenda",
  "status embarque": "statusEmbarque",
  "obs": "followUp",
  "chegou?": "statusCompraVenda",
};

const DATE_FIELDS = new Set(["prazoCliente", "chegadaHci", "eta", "etd", "embarque", "entregaFornecedor", "dataCompra", "prazoInicialFornecedor", "dataRecebimentoCompra", "emissaoPedidoSistema"]);

export function parseExcelValvulas(file: File): Promise<PedidoRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

        // Find header row containing "PI" (look in first 5 rows)
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
            let field = VALVE_COL_MAP[norm];

            // Handle duplicate/position-specific column names
            if (norm === "qty") {
              // QTY in PEDIDO DE VENDA section (column index 5) = qtyVenda
              // QTY in PEDIDO DE COMPRA section (column index 21) = qtyCompra
              field = (hdrIdx === 5 ? "qtyVenda" : hdrIdx === 21 ? "qtyCompra" : undefined) as keyof PedidoRow | undefined;
            } else if (norm === "item") {
              field = (hdrIdx === 1 ? "item" : undefined) as keyof PedidoRow | undefined;
            } else if (norm === "codigo") {
              field = (hdrIdx === 3 ? "codigo" : undefined) as keyof PedidoRow | undefined;
            }

            if (field) {
              // Don't overwrite existing values (prefer first occurrence)
              if (mapped[field] === undefined) {
                if (DATE_FIELDS.has(field as string) && typeof value === "number") {
                  mapped[field] = excelDateToString(value);
                } else if (value !== null && value !== undefined && value !== "") {
                  mapped[field] = value;
                }
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

/** Detect if file is a Válvulas spreadsheet by checking for "PI" header and 43 columns */
export function isValvulasFile(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

        // Look for "PI" in first column within first 5 rows
        for (let r = range.s.r; r <= Math.min(range.s.r + 5, range.e.r); r++) {
          const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
          if (cell && typeof cell.v === "string" && normalize(String(cell.v)) === "pi") {
            // Check if it has ~43 columns (Válvulas format)
            const hasEnoughColumns = range.e.c >= 40;
            resolve(hasEnoughColumns);
            return;
          }
        }
        resolve(false);
      } catch {
        resolve(false);
      }
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file);
  });
}
