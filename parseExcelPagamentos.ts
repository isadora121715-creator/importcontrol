import * as XLSX from "xlsx";

// ── Types ─────────────────────────────────────────────────────────────────────
// Reflects the "Planilha de Pagamentos Internacionais" format: each PO/PE line
// carries not just the payment amount, but the client billing tied to it
// (principal/secondary), a priority score and urgency, and the financial
// approval workflow — enough to drive a priority-sorted dashboard rather than
// a flat list.
export type MatRow = {
  empresa: string | null;
  po: string | null;
  pe: string | null;
  fornecedor: string | null;
  statusPO: string | null;
  termoPagamento: string | null;
  moeda: string | null;
  valorOrig: number | null;
  taxaCambio: number | null;
  reais: number | null;
  vencOriginal: string | null;
  vencAtualizado: string | null;
  modal: string | null;
  etd: string | null;
  eta: string | null;
  clientePrincipal: string | null;
  faturamentoClientePrincipal: number | null;
  prazoClientePrincipal: string | null;
  clienteSecundario: string | null;
  faturamentoClienteSecundario: number | null;
  prazoClienteSecundario: string | null;
  faturamentoTotalPO: number | null;
  diasAteVencerFornecedor: number | null;
  diasAtePrazoCliente: number | null;
  urgencia: string | null;
  scorePriorizacao: number | null;
  enviadoFinanceiro: string | null;
  retornoFinanceiro: string | null;
  status: string | null;
  bancoPagador: string | null;
  dataPagto: string | null;
  observacoes: string | null;
};

export type DesRow = {
  empresa: string | null;
  po: string | null;
  pe: string | null;
  fornecedor: string | null;
  tipoDespesa: string | null;
  modalidade: string | null;
  statusPO: string | null;
  moeda: string | null;
  valorBase: number | null;
  valorBRL: number | null;
  fator: number | null;
  valorPrevisao: number | null;
  valorRealConfirmado: number | null;
  taxaCambio: number | null;
  reais: number | null;
  vencOriginal: string | null;
  vencAtualizado: string | null;
  modal: string | null;
  clientePrincipal: string | null;
  faturamentoClientePrincipal: number | null;
  prazoClientePrincipal: string | null;
  clienteSecundario: string | null;
  faturamentoClienteSecundario: number | null;
  prazoClienteSecundario: string | null;
  faturamentoTotalPO: number | null;
  diasAteVencerFornecedor: number | null;
  diasAtePrazoCliente: number | null;
  urgencia: string | null;
  scorePriorizacao: number | null;
  enviadoFinanceiro: string | null;
  retornoFinanceiro: string | null;
  status: string | null;
  bancoPagador: string | null;
  dataPagto: string | null;
  observacoes: string | null;
};

export type CambioRow = {
  moeda: string;
  taxa: number;
  atualizadoEm: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const dd = String(v.getDate()).padStart(2, "0");
    return `${v.getFullYear()}-${mm}-${dd}`;
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const mm = String(d.m).padStart(2, "0");
    const dd = String(d.d).padStart(2, "0");
    return `${d.y}-${mm}-${dd}`;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m2) return s.slice(0, 10);
    return null;
  }
  return null;
}

function fmtNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "string" && v.trim().startsWith("#")) return null; // Excel formula errors (#VALUE!, #N/A, ...)
  const n = Number(String(v).replace(",", ".").replace(/\s/g, ""));
  return isNaN(n) ? null : Math.round(n * 10000) / 10000;
}

function fmtStr(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return fmtDate(v);
  const s = String(v).trim();
  return s === "" || s === "null" ? null : s;
}

function normStatus(v: unknown): string {
  if (v == null || String(v).trim() === "") return "PENDENTE";
  const s = String(v).trim().toUpperCase();
  if (s.includes("PAGO")) return "PAGO";
  if (s.includes("AGUARD")) return "AGUARDANDO";
  if (s.includes("CANCEL")) return "CANCELADO";
  if (s.includes("EXCLU")) return "EXCLUÍDO";
  return s;
}

function normalizeHeader(s: unknown): string {
  return String(s ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[().]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Builds a normalized-header → column-index map from a header row. */
function headerMap(row: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  row.forEach((cell, i) => {
    const key = normalizeHeader(cell);
    if (key && !map.has(key)) map.set(key, i);
  });
  return map;
}

/** Finds the column whose normalized header contains ALL given tokens.
 *  When several headers match (e.g. "MODAL" also matches "MODALIDADE"),
 *  the shortest — i.e. most exact — match wins. */
function findCol(map: Map<string, number>, ...tokens: string[]): number | undefined {
  let best: { key: string; idx: number } | undefined;
  for (const [key, idx] of map) {
    if (tokens.every((t) => key.includes(t))) {
      if (!best || key.length < best.key.length) best = { key, idx };
    }
  }
  return best?.idx;
}

/** Finds the row index (0-based) that looks like the real header row: it must
 *  contain both a "PO" column and a "FORNECEDOR"/"EXPORTADOR" column. */
function findHeaderRowIndex(raw: unknown[][]): number {
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const map = headerMap(raw[i] as unknown[]);
    if (map.has("PO") && (findCol(map, "FORNECEDOR") !== undefined || findCol(map, "EXPORTADOR") !== undefined)) {
      return i;
    }
  }
  return 4; // fallback: known layout has headers on row 5 (index 4)
}

const g = (r: unknown[], map: Map<string, number>, ...tokens: string[]) => {
  const idx = findCol(map, ...tokens);
  return idx == null ? undefined : r[idx];
};

// ── MATERIAL sheet ────────────────────────────────────────────────────────────
export function parseMaterialSheet(ws: XLSX.WorkSheet): MatRow[] {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  const headerIdx = findHeaderRowIndex(raw);
  const map = headerMap(raw[headerIdx] as unknown[]);
  const rows: MatRow[] = [];

  for (let i = headerIdx + 1; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    const po = fmtStr(g(r, map, "PO"));
    const fornecedor = fmtStr(g(r, map, "FORNECEDOR") ?? g(r, map, "EXPORTADOR"));
    if (po == null && fornecedor == null) continue;

    rows.push({
      empresa: fmtStr(g(r, map, "EMPRESA")),
      po,
      pe: fmtStr(g(r, map, "PE")),
      fornecedor,
      statusPO: fmtStr(g(r, map, "STATUS DA PO")),
      termoPagamento: fmtStr(g(r, map, "TERMO DE PAGAMENTO")),
      moeda: fmtStr(g(r, map, "MOEDA")),
      valorOrig: fmtNum(g(r, map, "VALOR", "MOEDA ORIG")),
      taxaCambio: fmtNum(g(r, map, "TAXA DE CAMBIO")),
      reais: fmtNum(g(r, map, "REAL")),
      vencOriginal: fmtDate(g(r, map, "VENCIMENTO ORIGINAL")),
      vencAtualizado: fmtDate(g(r, map, "VENCIMENTO ATUALIZADO")),
      modal: fmtStr(g(r, map, "MODAL")),
      etd: fmtDate(g(r, map, "ETD")),
      eta: fmtDate(g(r, map, "ETA")),
      clientePrincipal: fmtStr(g(r, map, "CLIENTE PRINCIPAL")),
      faturamentoClientePrincipal: fmtNum(g(r, map, "FATURAMENTO CLIENTE PRINC")),
      prazoClientePrincipal: fmtDate(g(r, map, "PRAZO CLIENTE PRINCIPAL")),
      clienteSecundario: fmtStr(g(r, map, "CLIENTE SECUNDARIO")),
      faturamentoClienteSecundario: fmtNum(g(r, map, "FATURAMENTO CLIENTE SEC")),
      prazoClienteSecundario: fmtDate(g(r, map, "PRAZO CLIENTE SECUNDARIO")),
      faturamentoTotalPO: fmtNum(g(r, map, "FATURAMENTO TOTAL DA PO")),
      diasAteVencerFornecedor: fmtNum(g(r, map, "DIAS ATE VENCER")),
      diasAtePrazoCliente: fmtNum(g(r, map, "DIAS ATE PRAZO CLIENTE")),
      urgencia: fmtStr(g(r, map, "URGENCIA")),
      scorePriorizacao: fmtNum(g(r, map, "SCORE PRIORIZACAO")),
      enviadoFinanceiro: fmtStr(g(r, map, "ENVIADO AO FINANCEIRO")),
      retornoFinanceiro: fmtStr(g(r, map, "RETORNO DO FINANCEIRO")),
      status: normStatus(g(r, map, "STATUS PAGAMENTO")),
      bancoPagador: fmtStr(g(r, map, "BANCO PAGADOR")),
      dataPagto: fmtDate(g(r, map, "DATA DE PAGAMENTO")),
      observacoes: fmtStr(g(r, map, "OBSERVACOES") ?? g(r, map, "OBSERVACAO")),
    });
  }
  return rows;
}

// ── DESEMBARAÇO sheet ─────────────────────────────────────────────────────────
export function parseDesembaracoSheet(ws: XLSX.WorkSheet): DesRow[] {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  const headerIdx = findHeaderRowIndex(raw);
  const map = headerMap(raw[headerIdx] as unknown[]);
  const rows: DesRow[] = [];

  for (let i = headerIdx + 1; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    const po = fmtStr(g(r, map, "PO"));
    const fornecedor = fmtStr(g(r, map, "FORNECEDOR") ?? g(r, map, "EXPORTADOR"));
    if (po == null && fornecedor == null) continue;

    const valorBRL = fmtNum(g(r, map, "VALOR EM BRL"));
    const valorRealConfirmado = fmtNum(g(r, map, "VALOR REAL CONFIRMADO"));
    const valorPrevisao = fmtNum(g(r, map, "VALOR DA PREVISAO"));

    rows.push({
      empresa: fmtStr(g(r, map, "EMPRESA")),
      po,
      pe: fmtStr(g(r, map, "PE")),
      fornecedor,
      tipoDespesa: fmtStr(g(r, map, "TIPO DE DESPESA")),
      modalidade: fmtStr(g(r, map, "MODALIDADE")),
      statusPO: fmtStr(g(r, map, "STATUS DA PO")),
      moeda: fmtStr(g(r, map, "MOEDA")),
      valorBase: fmtNum(g(r, map, "VALOR BASE")),
      valorBRL,
      fator: fmtNum(g(r, map, "FATOR")),
      valorPrevisao,
      valorRealConfirmado,
      taxaCambio: fmtNum(g(r, map, "TAXA DE CAMBIO")),
      // Prefer the confirmed value, then the posted BRL value, then the forecast.
      reais: valorRealConfirmado ?? valorBRL ?? valorPrevisao,
      vencOriginal: fmtDate(g(r, map, "VENCIMENTO ORIGINAL")),
      vencAtualizado: fmtDate(g(r, map, "VENCIMENTO ATUALIZADO")),
      modal: fmtStr(g(r, map, "MODAL")),
      clientePrincipal: fmtStr(g(r, map, "CLIENTE PRINCIPAL")),
      faturamentoClientePrincipal: fmtNum(g(r, map, "FATURAMENTO CLIENTE PRINC")),
      prazoClientePrincipal: fmtDate(g(r, map, "PRAZO CLIENTE PRINCIPAL")),
      clienteSecundario: fmtStr(g(r, map, "CLIENTE SECUNDARIO")),
      faturamentoClienteSecundario: fmtNum(g(r, map, "FATURAMENTO CLIENTE SEC")),
      prazoClienteSecundario: fmtDate(g(r, map, "PRAZO CLIENTE SECUNDARIO")),
      faturamentoTotalPO: fmtNum(g(r, map, "FATURAMENTO TOTAL DA PO")),
      diasAteVencerFornecedor: fmtNum(g(r, map, "DIAS ATE VENCER")),
      diasAtePrazoCliente: fmtNum(g(r, map, "DIAS ATE PRAZO CLIENTE")),
      urgencia: fmtStr(g(r, map, "URGENCIA")),
      scorePriorizacao: fmtNum(g(r, map, "SCORE PRIORIZACAO")),
      enviadoFinanceiro: fmtStr(g(r, map, "ENVIADO AO FINANCEIRO")),
      retornoFinanceiro: fmtStr(g(r, map, "RETORNO DO FINANCEIRO")),
      status: normStatus(g(r, map, "STATUS PAGAMENTO")),
      bancoPagador: fmtStr(g(r, map, "BANCO PAGADOR")),
      dataPagto: fmtDate(g(r, map, "DATA DE PAGAMENTO")),
      observacoes: fmtStr(g(r, map, "OBSERVACOES") ?? g(r, map, "OBSERVACAO")),
    });
  }
  return rows;
}

// ── CÂMBIO sheet ──────────────────────────────────────────────────────────────
export function parseCambioSheet(ws: XLSX.WorkSheet): CambioRow[] {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  const rows: CambioRow[] = [];
  for (const r of raw as unknown[][]) {
    const moeda = fmtStr(r[0]);
    const taxa = fmtNum(r[1]);
    if (!moeda || taxa == null || moeda.toUpperCase() === "MOEDA") continue;
    rows.push({ moeda: moeda.toUpperCase(), taxa, atualizadoEm: fmtDate(r[2]) });
  }
  return rows;
}

// ── Main entry — accepts the full "Pagamentos Internacionais" workbook ───────
export async function parseExcelPagamentos(
  file: File
): Promise<{ material: MatRow[]; desembaraco: DesRow[]; cambio: CambioRow[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });

  const normalize = (s: string) =>
    s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const matSheet = wb.SheetNames.find((n) => normalize(n).includes("MATERIAL"));
  const desSheet = wb.SheetNames.find((n) => normalize(n).includes("DESEMBAR"));
  const cambioSheet = wb.SheetNames.find((n) => normalize(n).includes("CAMBIO"));

  if (!matSheet) throw new Error("Aba de Material (ex: 'Pagamentos - Material') não encontrada no arquivo.");
  if (!desSheet) throw new Error("Aba de Desembaraço (ex: 'Pagamentos - Desembaraço') não encontrada no arquivo.");

  return {
    material: parseMaterialSheet(wb.Sheets[matSheet]),
    desembaraco: parseDesembaracoSheet(wb.Sheets[desSheet]),
    cambio: cambioSheet ? parseCambioSheet(wb.Sheets[cambioSheet]) : [],
  };
}
