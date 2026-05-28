import * as XLSX from "xlsx";

export type CotacaoFornecedor = {
  nome: string;
  preco: number | null;
  data: string | null;
};

export type CotacaoRow = {
  sheet: string;
  rfq: string | null;
  cliente: string | null;
  pi: string | null;
  op: string | null;
  dataCotacao: string | null;
  tipoMaterial: string | null;
  codigo: string | null;
  product: string | null;
  classe: string | null;
  sch: string | null;
  dn: string | null;
  material: string | null;
  qty: number | null;
  fornecedores: CotacaoFornecedor[];
  menorPreco: number | null;
  fornecedorMenorPreco: string | null;
  obs: string | null;
};

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof v === "string") {
    const s = v.trim();
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m2) return s.slice(0, 10);
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
  const s = String(v).replace(/\t/g, "").replace(/\xa0/g, " ").trim();
  return s === "" || s === "null" || s === "*" ? null : s;
}

function getForn(r: unknown[], start: number, count: number): CotacaoFornecedor[] {
  const result: CotacaoFornecedor[] = [];
  for (let i = 0; i < count; i++) {
    const b = start + i * 3;
    const nome = fmtStr(r[b]);
    if (!nome) continue;
    result.push({
      nome,
      preco: fmtNum(r[b + 1]),
      data: fmtDate(r[b + 2]),
    });
  }
  return result;
}

function parseGeneric(
  ws: XLSX.WorkSheet,
  sheetLabel: string,
  cfg: {
    rfq: number; cliente: number; pi: number | null; op: number | null;
    dataCotacao: number; tipoMaterial: number | null;
    codigo: number; product: number;
    classe: number | null; sch: number | null; dn: number | null; material: number | null;
    qty: number;
    fornStart: number; fornCount: number;
    menorPreco: number | null; fornMenor: number | null; obs: number | null;
    skipCheck: [number, number];
    dataStartRow?: number;
  }
): CotacaoRow[] {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const rows: CotacaoRow[] = [];
  const start = cfg.dataStartRow ?? 4;
  for (let i = start; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    const [a, b] = cfg.skipCheck;
    if (fmtStr(r[a]) == null && fmtStr(r[b]) == null) continue;
    rows.push({
      sheet: sheetLabel,
      rfq:      fmtStr(r[cfg.rfq]),
      cliente:  fmtStr(r[cfg.cliente]),
      pi:       cfg.pi != null ? fmtStr(r[cfg.pi]) : null,
      op:       cfg.op != null ? fmtStr(r[cfg.op]) : null,
      dataCotacao: fmtDate(r[cfg.dataCotacao]),
      tipoMaterial: cfg.tipoMaterial != null ? fmtStr(r[cfg.tipoMaterial]) : null,
      codigo:   fmtStr(r[cfg.codigo]),
      product:  fmtStr(r[cfg.product]),
      classe:   cfg.classe != null ? fmtStr(r[cfg.classe]) : null,
      sch:      cfg.sch != null ? fmtStr(r[cfg.sch]) : null,
      dn:       cfg.dn != null ? fmtStr(r[cfg.dn]) : null,
      material: cfg.material != null ? fmtStr(r[cfg.material]) : null,
      qty:      fmtNum(r[cfg.qty]),
      fornecedores: getForn(r, cfg.fornStart, cfg.fornCount),
      menorPreco:          cfg.menorPreco != null ? fmtNum(r[cfg.menorPreco]) : null,
      fornecedorMenorPreco: cfg.fornMenor != null ? fmtStr(r[cfg.fornMenor]) : null,
      obs:      cfg.obs != null ? fmtStr(r[cfg.obs]) : null,
    });
  }
  return rows;
}

// ── Sheet configs ─────────────────────────────────────────────────────────────
const normalize = (s: string) =>
  s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function parseCotacoesExcel(
  file: File
): Promise<CotacaoRow[]> {
  return file.arrayBuffer().then((buf) => {
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    const find = (startsWith: string) =>
      wb.SheetNames.find((n) => normalize(n).includes(startsWith));

    const result: CotacaoRow[] = [];

    // FLANGES
    const flangesSheet = find("FLANGES");
    if (flangesSheet) result.push(...parseGeneric(wb.Sheets[flangesSheet], "FLANGES", {
      rfq:0, cliente:1, pi:2, op:3, dataCotacao:4, tipoMaterial:5,
      codigo:6, product:7, classe:8, sch:10, dn:11, material:12, qty:15,
      fornStart:17, fornCount:4, menorPreco:30, fornMenor:31, obs:29,
      skipCheck:[7,6],
    }));

    // TUBULARES
    const tubSheet = find("TUBULAR");
    if (tubSheet) result.push(...parseGeneric(wb.Sheets[tubSheet], "TUBULARES", {
      rfq:0, cliente:1, pi:2, op:3, dataCotacao:4, tipoMaterial:5,
      codigo:6, product:7, classe:8, sch:10, dn:11, material:12, qty:14,
      fornStart:16, fornCount:6, menorPreco:35, fornMenor:36, obs:34,
      skipCheck:[7,6],
    }));

    // FORJADINHOS
    const forjSheet = find("FORJAD");
    if (forjSheet) result.push(...parseGeneric(wb.Sheets[forjSheet], "FORJADINHOS", {
      rfq:0, cliente:1, pi:2, op:3, dataCotacao:4, tipoMaterial:5,
      codigo:6, product:7, classe:8, sch:10, dn:11, material:12, qty:14,
      fornStart:16, fornCount:4, menorPreco:null, fornMenor:null, obs:31,
      skipCheck:[7,6],
    }));

    // JUNTA ANEL
    const jAnel = find("JUNTA ANEL");
    if (jAnel) result.push(...parseGeneric(wb.Sheets[jAnel], "JUNTA ANEL", {
      rfq:0, cliente:1, pi:2, op:3, dataCotacao:4, tipoMaterial:5,
      codigo:6, product:7, classe:11, sch:null, dn:8, material:9, qty:16,
      fornStart:18, fornCount:4, menorPreco:null, fornMenor:null, obs:30,
      skipCheck:[7,6],
    }));

    // JUNTA ESPIRAL
    const jEsp = find("JUNTA ESPIRAL");
    if (jEsp) result.push(...parseGeneric(wb.Sheets[jEsp], "JUNTA ESPIRAL", {
      rfq:0, cliente:1, pi:2, op:3, dataCotacao:4, tipoMaterial:5,
      codigo:6, product:7, classe:9, sch:null, dn:11, material:10, qty:15,
      fornStart:17, fornCount:4, menorPreco:null, fornMenor:null, obs:29,
      skipCheck:[7,6],
    }));

    // FIGURA 8 / RAQ
    const fig8 = find("FIGURA");
    if (fig8) result.push(...parseGeneric(wb.Sheets[fig8], "FIGURA 8 / RAQ", {
      rfq:0, cliente:1, pi:2, op:3, dataCotacao:4, tipoMaterial:5,
      codigo:6, product:7, classe:8, sch:10, dn:11, material:12, qty:14,
      fornStart:16, fornCount:4, menorPreco:null, fornMenor:null, obs:28,
      skipCheck:[7,6],
    }));

    // PARAFUSO
    const parafSheet = find("PARAFUSO");
    if (parafSheet) result.push(...parseGeneric(wb.Sheets[parafSheet], "PARAFUSO", {
      rfq:2, cliente:0, pi:null, op:1, dataCotacao:3, tipoMaterial:null,
      codigo:4, product:5, classe:6, sch:7, dn:8, material:11, qty:17,
      fornStart:18, fornCount:4, menorPreco:null, fornMenor:null, obs:30,
      skipCheck:[5,4],
    }));

    // GERAL
    const geralSheet = find("GERAL");
    if (geralSheet) result.push(...parseGeneric(wb.Sheets[geralSheet], "GERAL", {
      rfq:0, cliente:1, pi:2, op:null, dataCotacao:3, tipoMaterial:7,
      codigo:4, product:6, classe:8, sch:9, dn:10, material:13, qty:15,
      fornStart:16, fornCount:4, menorPreco:null, fornMenor:null, obs:null,
      skipCheck:[6,4],
    }));

    // PETROBRAS
    const pbSheet = find("PETROBRAS");
    if (pbSheet) result.push(...parseGeneric(wb.Sheets[pbSheet], "PETROBRAS", {
      rfq:0, cliente:1, pi:2, op:null, dataCotacao:3, tipoMaterial:7,
      codigo:4, product:6, classe:8, sch:9, dn:10, material:13, qty:18,
      fornStart:19, fornCount:4, menorPreco:null, fornMenor:null, obs:null,
      skipCheck:[6,4],
    }));

    return result;
  });
}
