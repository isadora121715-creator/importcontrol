import * as XLSX from "xlsx";

export interface PedidoRow {
  id?: string;
  pi: number | null;
  cliente: string | null;
  codigo: string | null;
  codigoCompra: string | null;
  descricao: string | null;
  qtyVenda: number | null;
  qtyCompra: number | null;
  precoVenda: number | null;
  precoCompra: number | null;
  po: string | null;
  fornecedor: string | null;
  statusFornecedor: string | null;
  statusCompraVenda: string | null;
  statusProducao: string | null;
  prazoCliente: string | null;
  diasFaltam: number | null;
  diasAtraso: number | null;
  vendaEmDias: number | null;
  followUp: string | null;
  chegadaHci: string | null;
  eta: string | null;
  etd: string | null;
  item: string | null;
  embarque: string | null;
  entregaFornecedor: string | null;
  dataCompra: string | null;
  prazoInicialFornecedor: string | null;
  emissaoPedidoSistema: string | null;
  dataRecebimentoCompra: string | null;
  [key: string]: unknown;
}

const COL_MAP: Record<string, keyof PedidoRow> = {
  "pi": "pi",
  "cliente": "cliente",
  "código": "codigo",
  "codigo": "codigo",
  "código compra": "codigoCompra",
  "codigo compra": "codigoCompra",
  "descrição": "descricao",
  "descricao": "descricao",
  "qty venda": "qtyVenda",
  "qty compra": "qtyCompra",
  "preço venda": "precoVenda",
  "preco venda": "precoVenda",
  "preço compra": "precoCompra",
  "preco compra": "precoCompra",
  "po": "po",
  "fornecedor": "fornecedor",
  "forncedor": "fornecedor",
  "fornecedor nome": "fornecedor",
  "nome fornecedor": "fornecedor",
  "supplier": "fornecedor",
  "vendor": "fornecedor",
  "fabricante": "fornecedor",
  "status fornecedor": "statusFornecedor",
  "status do fornecedor": "statusFornecedor",
  "status compra / venda": "statusCompraVenda",
  "status compra/venda": "statusCompraVenda",
  "status produção": "statusProducao",
  "status producao": "statusProducao",
  "prazo cliente": "prazoCliente",
  "dias faltam": "diasFaltam",
  "dias que faltam": "diasFaltam",
  "dias de atraso": "diasAtraso",
  "dias atraso": "diasAtraso",
  "venda em dias": "vendaEmDias",
  "follow up": "followUp",
  "chegada hci": "chegadaHci",
  "eta": "eta",
  "etd": "etd",
  "item": "item",
  "embarque": "embarque",
  "entrega fornecedor": "entregaFornecedor",
  "entrega do fornecedor": "entregaFornecedor",
  "prazo fornecedor": "entregaFornecedor",
  "prazo inicial fornecedor": "entregaFornecedor",
  "data compra": "dataCompra",
  "data da compra": "dataCompra",
  "data de compra": "dataCompra",
  // Single-word duplicates from multi-section headers
  "qty": "qtyVenda",
  "descrição_compra": "descricao",
};

// Keyword fallback map for fuzzy column detection
const KEYWORD_FALLBACK: { keywords: string[]; field: keyof PedidoRow }[] = [
  { keywords: ["fornecedor", "supplier", "vendor", "fabricante"], field: "fornecedor" },
  { keywords: ["status fornecedor", "status do fornecedor"], field: "statusFornecedor" },
  { keywords: ["status compra", "status venda"], field: "statusCompraVenda" },
];

function normalize(header: string): string {
  return header.toLowerCase().replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}

/** Try exact COL_MAP match first, then keyword fallback */
function resolveField(norm: string): keyof PedidoRow | undefined {
  if (COL_MAP[norm]) return COL_MAP[norm];
  for (const fb of KEYWORD_FALLBACK) {
    if (fb.keywords.some((kw) => norm.includes(kw))) return fb.field;
  }
  return undefined;
}

/** Convert Excel serial number to dd/MM/yyyy string */
function excelDateToString(serial: number): string {
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400000);
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

const DATE_FIELDS: Set<string> = new Set<string>(["chegadaHci", "prazoCliente", "eta", "etd", "embarque", "entregaFornecedor", "dataCompra"]);

export function parseExcelFile(file: File): Promise<PedidoRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // Detect header row: find the row containing "PI" as a cell value
        const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
        let headerRowIndex = 0;
        for (let r = range.s.r; r <= Math.min(range.s.r + 5, range.e.r); r++) {
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = sheet[XLSX.utils.encode_cell({ r, c })];
            if (cell && typeof cell.v === "string" && cell.v.trim().toUpperCase() === "PI") {
              headerRowIndex = r;
              break;
            }
          }
          if (headerRowIndex > 0) break;
        }

        // Build headers from the detected header row
        const headers: string[] = [];
        const vendaQtyFound = { found: false };
        const vendaCodigoFound = { found: false };
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = sheet[XLSX.utils.encode_cell({ r: headerRowIndex, c })];
          let hdr = cell ? String(cell.v).trim() : `__col_${c}`;
          const norm = normalize(hdr);

          // Handle duplicate column names between VENDA and COMPRA sections
          if (norm === "qty") {
            if (!vendaQtyFound.found) {
              vendaQtyFound.found = true;
              hdr = "QTY VENDA";
            } else {
              hdr = "QTY COMPRA";
            }
          }
          if (norm === "codigo" || norm === "código") {
            if (!vendaCodigoFound.found) {
              vendaCodigoFound.found = true;
              // keep as is (maps to codigo)
            } else {
              hdr = "CODIGO COMPRA";
            }
          }
          headers.push(hdr);
        }

        // Read data rows starting after header
        const rows: PedidoRow[] = [];
        for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
          const mapped: Record<string, unknown> = {};
          let hasAnyValue = false;
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = sheet[XLSX.utils.encode_cell({ r, c })];
            const value = cell ? cell.v : null;
            if (value !== null && value !== undefined && value !== "") hasAnyValue = true;
            const hdrIdx = c - range.s.c;
            if (hdrIdx < headers.length) {
              const norm = normalize(headers[hdrIdx]);
              const field = resolveField(norm);
              if (field) {
                // Convert Excel serial dates to dd/MM/yyyy
                if (DATE_FIELDS.has(field as string) && typeof value === "number") {
                  mapped[field] = excelDateToString(value);
                } else {
                  mapped[field] = value;
                }
              }
            }
          }
          if (hasAnyValue) {
            rows.push(mapped as PedidoRow);
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
