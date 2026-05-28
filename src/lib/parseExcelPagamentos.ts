import * as XLSX from "xlsx";

export type MatRow = {
  pgto: string | null;
  banco: string | null;
  tipo: string | null;
  payment: string | null;
  company: string | null;
  exporter: string | null;
  po: string | null;
  pe: string | null;
  moeda: string | null;
  valor: number | null;
  reais: number | null;
  primeiroVencimento: string | null;
  vencAlterado: string | null;
  cliente: string | null;
  dataPagto: string | null;
  status: string | null;
};

export type DesRow = {
  pagto: string | null;
  tipo: string | null;
  modalidade: string | null;
  empresa: string | null;
  exportador: string | null;
  po: string | null;
  pe: string | null;
  moeda: string | null;
  valor: number | null;
  reais: number | null;
  vencimento: string | null;
  vencAlterado: string | null;
  cliente: string | null;
  dataPagto: string | null;
  status: string | null;
};

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const mm = String(d.m).padStart(2, "0");
    const dd = String(d.d).padStart(2, "0");
    return `${d.y}-${mm}-${dd}`;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    // dd/mm/yyyy
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m1) return `${m1[3]}-${m1[2].padStart(2,"0")}-${m1[1].padStart(2,"0")}`;
    // yyyy-mm-dd already
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m2) return s.slice(0, 10);
    return null;
  }
  return null;
}

function fmtNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", ".").replace(/\s/g, ""));
  return isNaN(n) ? null : Math.round(n * 10000) / 10000;
}

function fmtStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" || s === "null" ? null : s;
}

function normStatusMat(v: unknown): string {
  if (v == null || String(v).trim() === "") return "PENDENTE";
  const s = String(v).trim().toUpperCase();
  if (s.includes("PAGO")) return "PAGO";
  if (s.includes("CANCEL")) return "CANCELADO";
  if (s.includes("EXCLU")) return "EXCLUÍDO";
  return s;
}

function normStatusDes(v: unknown): string {
  if (v == null || String(v).trim() === "") return "PENDENTE";
  const s = String(v).trim().toUpperCase();
  if (s.includes("PAGO")) return "PAGO";
  if (s.includes("AGUARD")) return "AGUARDANDO";
  if (s.includes("CANCEL")) return "CANCELADO";
  return s;
}

// ── MATERIAL sheet ────────────────────────────────────────────────────────────
// Col indices (0-based): A=0 PGTO · D=3 BANCO · E=4 TIPO · F=5 PAYMENT
// G=6 COMPANY · H=7 EXPORTER · I=8 PO · J=9 PE · K=10 MOEDA · L=11 VALOR
// M=12 LANÇ.SISTEMA · N=13 REAIS · O=14 1ºVENC · Q=16 VENC.ALT · R=17 CLIENTE
// T=19 DATA PAGTO · X=23 STATUS
export function parseMaterialSheet(ws: XLSX.WorkSheet): MatRow[] {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const rows: MatRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    if (r[8] == null && r[7] == null) continue; // no PO and no exporter → skip
    rows.push({
      pgto:               normStatusMat(r[0]),
      banco:              fmtStr(r[3]),
      tipo:               fmtStr(r[4]),
      payment:            fmtStr(r[5]),
      company:            fmtStr(r[6]),
      exporter:           fmtStr(r[7]),
      po:                 fmtStr(r[8]),
      pe:                 fmtStr(r[9]),
      moeda:              fmtStr(r[10]),
      valor:              fmtNum(r[11]),
      reais:              fmtNum(r[13]),
      primeiroVencimento: fmtDate(r[14]),
      vencAlterado:       fmtDate(r[16]),
      cliente:            fmtStr(r[17]),
      dataPagto:          fmtDate(r[19]),
      status:             fmtStr(r[23]),
    });
  }
  return rows;
}

// ── DESEMBARAÇO sheet ─────────────────────────────────────────────────────────
// Col indices: A=0 PAGTO · B=1 TIPO · G=6 MODALIDADE · H=7 EMPRESA
// I=8 EXPORTADOR · J=9 PO · K=10 PE · L=11 MOEDA · M=12 VALOR
// O=14 LANÇ.SISTEMA · P=15 REAIS · Q=16 VENCIMENTO · R=17 VENC.ALT
// T=19 CLIENTE · U=20 DATA PAGTO · V=21 STATUS
export function parseDesembaracoSheet(ws: XLSX.WorkSheet): DesRow[] {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const rows: DesRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    if (r[9] == null && r[8] == null) continue; // no PO and no exporter → skip
    rows.push({
      pagto:      normStatusDes(r[0]),
      tipo:       fmtStr(r[1]),
      modalidade: fmtStr(r[6]),
      empresa:    fmtStr(r[7]),
      exportador: fmtStr(r[8]),
      po:         fmtStr(r[9]),
      pe:         fmtStr(r[10]),
      moeda:      fmtStr(r[11]),
      valor:      fmtNum(r[12]),
      reais:      fmtNum(r[15]),
      vencimento: fmtDate(r[16]),
      vencAlterado: fmtDate(r[17]),
      cliente:    fmtStr(r[19]),
      dataPagto:  fmtDate(r[20]),
      status:     fmtStr(r[21]),
    });
  }
  return rows;
}

// ── Main entry — accepts .xlsx with MATERIAL + DESEMBARAÇO sheets ─────────────
export async function parseExcelPagamentos(
  file: File
): Promise<{ material: MatRow[]; desembaraco: DesRow[] }> {
  const buf = await file.arrayBuffer();
  const wb  = XLSX.read(buf, { type: "array", cellDates: false });

  // Find sheets by name (case-insensitive, accent-tolerant)
  const normalize = (s: string) =>
    s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const matSheet = wb.SheetNames.find((n) => normalize(n).startsWith("MATERIAL"));
  const desSheet = wb.SheetNames.find((n) =>
    normalize(n).includes("DESEMBAR") || normalize(n).includes("DESEMBARA")
  );

  if (!matSheet)
    throw new Error("Aba 'MATERIAL' não encontrada no arquivo.");
  if (!desSheet)
    throw new Error("Aba 'DESEMBARAÇO' não encontrada no arquivo.");

  return {
    material:    parseMaterialSheet(wb.Sheets[matSheet]),
    desembaraco: parseDesembaracoSheet(wb.Sheets[desSheet]),
  };
}
