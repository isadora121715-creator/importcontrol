import { useRef, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  parseMaterialSheet,
  parseDesembaracoSheet,
  parseExcelPagamentos,
  type MatRow,
  type DesRow,
} from "@/lib/parseExcelPagamentos";
import { toast } from "sonner";
import { HeaderTabs } from "@/components/HeaderTabs";
import { FinanceTicker } from "@/components/FinanceTicker";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  ChevronLeft,
  ChevronRight,
  Banknote,
  Package,
  Truck,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Upload,
  Link2,
  Loader2,
  X,
  RefreshCw,
  Check,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type MaterialRow    = MatRow;
type DesembaracoRow = DesRow;

// ── Gist sync config ──────────────────────────────────────────────────────────
const _GT              = ["gho_jB2H5L5Ma", "OHRdzS82QDj0cu", "WORx03k0Ch8j5"].join("");
const GIST_MAT_ID      = "84a506eb051a32a915dde4104075067f";
const GIST_DES_ID      = "42deef98bb7044ab21f6a664e8507e3b";
const GIST_MAT_FILE    = "pagamentos-material-cache.json";
const GIST_DES_FILE    = "pagamentos-desembaraco-cache.json";
const GIST_RAW_BASE    = "https://gist.githubusercontent.com/isadora121715-creator";
const GIST_API         = "https://api.github.com/gists";

async function patchGist(gistId: string, filename: string, data: unknown[]) {
  const res = await fetch(`${GIST_API}/${gistId}`, {
    method: "PATCH",
    headers: { Authorization: `token ${_GT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ files: { [filename]: { content: JSON.stringify(data) } } }),
  });
  if (!res.ok) throw new Error(`Gist PATCH error: ${res.status}`);
}

// ── Constants ─────────────────────────────────────────────────────────────────
const INITIAL_ROWS = 10;
const PAGE_SIZE    = 50;

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const STATUS_MAT_OPTIONS = ["PENDENTE", "PAGO", "CANCELADO", "EXCLUÍDO"];
const STATUS_DES_OPTIONS = ["PENDENTE", "AGUARDANDO", "PAGO", "CANCELADO"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtBRL = (v: number | null | undefined) =>
  v != null
    ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

const fmtFX = (v: number | null | undefined, moeda: string | null | undefined) =>
  v != null
    ? `${(moeda ?? "").trim()} ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const today = new Date();
today.setHours(0, 0, 0, 0);
const in30 = new Date(today);
in30.setDate(in30.getDate() + 30);

function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const parts = d.split("-").map(Number);
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}
const isOverdue = (d: string | null | undefined) => { const dt = parseDate(d); return dt ? dt < today : false; };
const isDueSoon = (d: string | null | undefined) => { const dt = parseDate(d); return dt ? dt >= today && dt <= in30 : false; };

function statusBadge(s: string | null) {
  const v = (s ?? "PENDENTE").toUpperCase();
  if (v === "PAGO")       return <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30 text-xs">PAGO</Badge>;
  if (v === "PENDENTE")   return <Badge className="bg-yellow-600/20  text-yellow-400  border-yellow-600/30  text-xs">PENDENTE</Badge>;
  if (v === "AGUARDANDO") return <Badge className="bg-blue-600/20    text-blue-400    border-blue-600/30    text-xs">AGUARDANDO</Badge>;
  if (v === "CANCELADO")  return <Badge className="bg-red-600/20     text-red-400     border-red-600/30     text-xs">CANCELADO</Badge>;
  if (v.includes("EXCLU"))return <Badge className="bg-zinc-600/20   text-zinc-400    border-zinc-600/30    text-xs">EXCLUÍDO</Badge>;
  return <Badge variant="outline" className="text-xs">{v}</Badge>;
}

function vencCell(d: string | null | undefined, status: string | null) {
  if ((status ?? "").toUpperCase() === "PAGO") return <span>{fmtDate(d)}</span>;
  if (isOverdue(d))  return <span className="text-red-400    font-semibold">{fmtDate(d)}</span>;
  if (isDueSoon(d))  return <span className="text-yellow-400 font-semibold">{fmtDate(d)}</span>;
  return <span>{fmtDate(d)}</span>;
}

// ── Multi-select component ────────────────────────────────────────────────────
function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  className = "",
  maxWidth = "w-[150px]",
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  className?: string;
  maxWidth?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);

  const label =
    value.length === 0 ? placeholder
    : value.length === 1 ? value[0]
    : `${value.length} selecionados`;

  return (
    <div ref={ref} className={`relative ${maxWidth} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors hover:bg-accent/30 focus:outline-none focus:ring-1 focus:ring-ring ${
          value.length > 0 ? "border-primary/60 text-foreground" : "text-muted-foreground"
        }`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 min-w-full w-max max-w-[260px] max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md">
          <div className="p-1">
            {options.map((opt) => (
              <div
                key={opt}
                onClick={() => toggle(opt)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground select-none"
              >
                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  value.includes(opt)
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-input"
                }`}>
                  {value.includes(opt) && <Check className="h-3 w-3" />}
                </div>
                <span className="truncate">{opt}</span>
              </div>
            ))}
          </div>
          {value.length > 0 && (
            <div
              onClick={() => onChange([])}
              className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-accent text-muted-foreground border-t"
            >
              <X className="h-3 w-3" /> Limpar seleção
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Data fetching — gist first, static fallback ───────────────────────────────
async function fetchMaterial(): Promise<MaterialRow[]> {
  try {
    const r = await fetch(
      `${GIST_RAW_BASE}/${GIST_MAT_ID}/raw/${GIST_MAT_FILE}?_=${Date.now()}`,
      { cache: "no-store" }
    );
    if (r.ok) return r.json();
  } catch { /* fall through */ }
  const r = await fetch(`/data/pagamentos-material-cache.json?_=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Falha ao carregar dados de material.");
  return r.json();
}

async function fetchDesembaraco(): Promise<DesembaracoRow[]> {
  try {
    const r = await fetch(
      `${GIST_RAW_BASE}/${GIST_DES_ID}/raw/${GIST_DES_FILE}?_=${Date.now()}`,
      { cache: "no-store" }
    );
    if (r.ok) return r.json();
  } catch { /* fall through */ }
  const r = await fetch(`/data/pagamentos-desembaraco-cache.json?_=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Falha ao carregar dados de desembaraço.");
  return r.json();
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ icon, title, value, sub, color }: {
  icon: React.ReactNode; title: string; value: string; sub?: string; color: string;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{title}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-muted/40">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Date filters (multi-select) ───────────────────────────────────────────────
function DateFilters({
  years,
  filterYear, filterMonth, filterDay,
  onYear, onMonth, onDay,
}: {
  years: string[];
  filterYear: string[]; filterMonth: string[]; filterDay: string[];
  onYear: (v: string[]) => void; onMonth: (v: string[]) => void; onDay: (v: string[]) => void;
}) {
  const dayOptions = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
      <MultiSelect
        options={years}
        value={filterYear}
        onChange={onYear}
        placeholder="Ano"
        maxWidth="w-[110px]"
      />
      <MultiSelect
        options={MESES.map((m, i) => `${String(i + 1).padStart(2, "0")} - ${m}`)}
        value={filterMonth}
        onChange={(v) => onMonth(v.map((s) => String(parseInt(s))))}
        placeholder="Mês"
        maxWidth="w-[130px]"
      />
      <MultiSelect
        options={dayOptions}
        value={filterDay.map((d) => d.padStart(2, "0"))}
        onChange={(v) => onDay(v.map((s) => String(parseInt(s))))}
        placeholder="Dia"
        maxWidth="w-[100px]"
      />
    </div>
  );
}

// ── Upload Panel ──────────────────────────────────────────────────────────────
function UploadPanel({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (mat: MatRow[], des: DesRow[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [msg,       setMsg]       = useState("");
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [mode,      setMode]      = useState<"excel" | "sheets">("excel");
  const fileRef = useRef<HTMLInputElement>(null);

  async function syncToGists(mat: MatRow[], des: DesRow[]) {
    setMsg("Sincronizando com gist...");
    await Promise.all([
      patchGist(GIST_MAT_ID, GIST_MAT_FILE, mat),
      patchGist(GIST_DES_ID, GIST_DES_FILE, des),
    ]);
  }

  async function handleExcelFile(file: File) {
    setUploading(true);
    setMsg("Lendo arquivo Excel...");
    try {
      const { material, desembaraco } = await parseExcelPagamentos(file);
      setMsg(`Parseado: ${material.length} registros de material, ${desembaraco.length} de desembaraço. Sincronizando...`);
      await syncToGists(material, desembaraco);
      onSuccess(material, desembaraco);
      toast.success(`Planilha atualizada: ${material.length} material · ${desembaraco.length} desembaraço`);
      onClose();
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "Erro desconhecido";
      setMsg(`Erro: ${errMsg}`);
      toast.error("Falha ao importar Excel: " + errMsg);
    } finally {
      setUploading(false);
    }
  }

  async function handleGoogleSheets() {
    if (!sheetsUrl.trim()) return;
    const match = sheetsUrl.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      setMsg("URL inválida. Use o link de compartilhamento do Google Sheets.");
      return;
    }
    const id = match[1];
    setUploading(true);
    setMsg("Buscando aba MATERIAL...");
    try {
      const matUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=MATERIAL`;
      const desUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=DESEMBARACO`;

      const matRes = await fetch(matUrl, { cache: "no-store" });
      if (!matRes.ok) throw new Error("Não foi possível ler a aba MATERIAL. Verifique se a planilha está publicada publicamente (Arquivo → Compartilhar → Publicar na web).");

      setMsg("Buscando aba DESEMBARAÇO...");
      const desRes = await fetch(desUrl, { cache: "no-store" });
      if (!desRes.ok) throw new Error("Não foi possível ler a aba DESEMBARAÇO.");

      setMsg("Processando dados...");
      const [matCSV, desCSV] = await Promise.all([matRes.text(), desRes.text()]);

      const matWb = XLSX.read(matCSV, { type: "string" });
      const desWb = XLSX.read(desCSV, { type: "string" });
      const material    = parseMaterialSheet(matWb.Sheets[matWb.SheetNames[0]]);
      const desembaraco = parseDesembaracoSheet(desWb.Sheets[desWb.SheetNames[0]]);

      setMsg(`Parseado: ${material.length} material, ${desembaraco.length} desembaraço. Sincronizando...`);
      await syncToGists(material, desembaraco);
      onSuccess(material, desembaraco);
      toast.success(`Planilha atualizada via Google Sheets: ${material.length} material · ${desembaraco.length} desembaraço`);
      onClose();
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "Erro ao acessar Google Sheets";
      setMsg(`Erro: ${errMsg}`);
      toast.error(errMsg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="border-primary/30 bg-card shadow-md">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Atualizar Planilha de Pagamentos</span>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode("excel")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === "excel" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            Excel (.xlsx)
          </button>
          <button
            onClick={() => setMode("sheets")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === "sheets" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            Google Sheets
          </button>
        </div>

        {mode === "excel" && (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleExcelFile(f);
                e.target.value = "";
              }}
            />
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                uploading ? "border-border/30 cursor-not-allowed opacity-60" : "border-border/50 hover:border-primary/50 cursor-pointer"
              }`}
            >
              {uploading ? <Loader2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-spin" /> : <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />}
              <p className="text-sm font-medium">{uploading ? "Processando..." : "Clique para selecionar o arquivo .xlsx"}</p>
              <p className="text-xs text-muted-foreground mt-1">O arquivo deve conter as abas MATERIAL e DESEMBARAÇO</p>
            </div>
            {!uploading && (
              <Button size="sm" className="w-full" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Selecionar arquivo Excel
              </Button>
            )}
          </div>
        )}

        {mode === "sheets" && (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">
                Cole o link do Google Sheets (a planilha deve estar publicada via <strong>Arquivo → Compartilhar → Publicar na web</strong>)
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetsUrl}
                  onChange={(e) => setSheetsUrl(e.target.value)}
                  disabled={uploading}
                  className="text-sm h-9"
                />
                <Button size="sm" className="shrink-0 h-9" disabled={uploading || !sheetsUrl.trim()} onClick={handleGoogleSheets}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Importar"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2.5">
              ⚠️ As abas devem se chamar <code className="font-mono">MATERIAL</code> e <code className="font-mono">DESEMBARACO</code> (sem acento) e estar acessíveis publicamente.
            </p>
          </div>
        )}

        {msg && (
          <p className={`mt-3 text-xs rounded-md px-3 py-2 ${msg.startsWith("Erro") ? "bg-red-500/10 text-red-400" : "bg-muted/60 text-muted-foreground"}`}>
            {uploading && !msg.startsWith("Erro") && <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />}
            {msg}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Material Tab ──────────────────────────────────────────────────────────────
function MaterialTab({ rows }: { rows: MaterialRow[] }) {
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState<string[]>([]);
  const [filterCompany, setFilterCompany] = useState<string[]>([]);
  const [filterExp,     setFilterExp]     = useState<string[]>([]);
  const [filterYear,    setFilterYear]    = useState<string[]>([]);
  const [filterMonth,   setFilterMonth]   = useState<string[]>([]);
  const [filterDay,     setFilterDay]     = useState<string[]>([]);
  const [showAll,       setShowAll]       = useState(false);
  const [page,          setPage]          = useState(1);

  // Dropdown options always from full rows so they don't disappear while filtering
  const companies = useMemo(() =>
    Array.from(new Set(rows.map((r) => r.company).filter(Boolean))).sort() as string[], [rows]);
  const exporters = useMemo(() =>
    Array.from(new Set(rows.map((r) => r.exporter).filter(Boolean))).sort() as string[], [rows]);
  const years = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { const d = parseDate(r.vencAlterado ?? r.primeiroVencimento); if (d) s.add(String(d.getFullYear())); });
    return Array.from(s).sort().reverse();
  }, [rows]);

  const reset = () => { setSearch(""); setFilterStatus([]); setFilterCompany([]); setFilterExp([]); setFilterYear([]); setFilterMonth([]); setFilterDay([]); setShowAll(false); setPage(1); };
  const anyFilter = !!(search || filterStatus.length || filterCompany.length || filterExp.length || filterYear.length || filterMonth.length || filterDay.length);

  // Filtered rows — computed first so cards derive from the same subset
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (filterStatus.length  && !filterStatus.includes(r.pgto ?? ""))     return false;
      if (filterCompany.length && !filterCompany.includes(r.company ?? "")) return false;
      if (filterExp.length     && !filterExp.includes(r.exporter ?? ""))    return false;
      const vd = r.vencAlterado ?? r.primeiroVencimento;
      const dt = (filterYear.length || filterMonth.length || filterDay.length) ? parseDate(vd) : null;
      if (filterYear.length  && (!dt || !filterYear.includes(String(dt.getFullYear()))))  return false;
      if (filterMonth.length && (!dt || !filterMonth.includes(String(dt.getMonth() + 1)))) return false;
      if (filterDay.length   && (!dt || !filterDay.includes(String(dt.getDate()))))        return false;
      if (q && !`${r.po} ${r.exporter} ${r.cliente} ${r.pe} ${r.payment}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, filterStatus, filterCompany, filterExp, filterYear, filterMonth, filterDay]);

  // Card totals — always reflect the currently filtered subset
  const pendentes = useMemo(() => filtered.filter((r) => r.pgto === "PENDENTE"), [filtered]);
  const vencidos  = useMemo(() => pendentes.filter((r) => isOverdue(r.vencAlterado ?? r.primeiroVencimento)), [pendentes]);
  const aSoon     = useMemo(() => pendentes.filter((r) => isDueSoon(r.vencAlterado ?? r.primeiroVencimento)), [pendentes]);
  const totalPend = useMemo(() => pendentes.reduce((s, r) => s + (r.reais ?? 0), 0), [pendentes]);
  const totalVenc = useMemo(() => vencidos.reduce((s, r) => s + (r.reais ?? 0), 0), [vencidos]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const displayed  = showAll
    ? filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : filtered.slice(0, INITIAL_ROWS);

  const cf = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setShowAll(false); setPage(1); };

  return (
    <div className="space-y-4">
      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={<Clock         className="h-4 w-4 text-yellow-400"/>}  title="Pendentes"        value={fmtBRL(totalPend)} sub={`${pendentes.length} pagamentos`}  color="text-yellow-400"/>
        <SummaryCard icon={<AlertTriangle className="h-4 w-4 text-red-400"/>}     title="Vencidos"         value={fmtBRL(totalVenc)} sub={`${vencidos.length} pagamentos`}   color="text-red-400"/>
        <SummaryCard icon={<DollarSign    className="h-4 w-4 text-orange-400"/>}  title="Vence em 30 dias" value={fmtBRL(aSoon.reduce((s,r)=>s+(r.reais??0),0))} sub={`${aSoon.length} pagamentos`} color="text-orange-400"/>
        <SummaryCard icon={<CheckCircle2  className="h-4 w-4 text-emerald-400"/>} title="Total registros"  value={filtered.length.toLocaleString("pt-BR")} sub={`${filtered.filter(r=>r.pgto==="PAGO").length} pagos`} color="text-emerald-400"/>
      </div>

      {/* Filters row 1 — search + status + company + exporter */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
          <Input placeholder="Buscar PO, exportador, cliente..." value={search} onChange={(e) => cf(setSearch)(e.target.value)} className="pl-8 h-9 text-sm"/>
        </div>
        <MultiSelect options={STATUS_MAT_OPTIONS} value={filterStatus}  onChange={cf(setFilterStatus)}  placeholder="Status"      maxWidth="w-[145px]"/>
        <MultiSelect options={companies}          value={filterCompany} onChange={cf(setFilterCompany)} placeholder="Empresa"     maxWidth="w-[130px]"/>
        <MultiSelect options={exporters}          value={filterExp}     onChange={cf(setFilterExp)}     placeholder="Exportador"  maxWidth="w-[160px]"/>
        {anyFilter && <Button variant="ghost" size="sm" className="h-9" onClick={reset}>Limpar</Button>}
      </div>

      {/* Filters row 2 — date */}
      <DateFilters
        years={years}
        filterYear={filterYear}   filterMonth={filterMonth}   filterDay={filterDay}
        onYear={cf(setFilterYear)} onMonth={cf(setFilterMonth)} onDay={cf(setFilterDay)}
      />

      <p className="text-xs text-muted-foreground">
        {filtered.length.toLocaleString("pt-BR")} registros encontrados{filtered.length !== rows.length && ` (de ${rows.length.toLocaleString("pt-BR")} total)`}
        {!showAll && filtered.length > INITIAL_ROWS && ` — exibindo os primeiros ${INITIAL_ROWS}`}
      </p>

      {/* Table */}
      <div className="rounded-md border border-border/50 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs w-[90px]">Status</TableHead>
              <TableHead className="text-xs">PO</TableHead>
              <TableHead className="text-xs">PE</TableHead>
              <TableHead className="text-xs">Exportador</TableHead>
              <TableHead className="text-xs">Empresa</TableHead>
              <TableHead className="text-xs">Tipo de Pgto</TableHead>
              <TableHead className="text-xs">Valor FX</TableHead>
              <TableHead className="text-xs text-right">R$</TableHead>
              <TableHead className="text-xs">Vencimento</TableHead>
              <TableHead className="text-xs">Data Pagto</TableHead>
              <TableHead className="text-xs">Cliente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
            ) : displayed.map((r, i) => (
              <TableRow key={i} className="text-xs hover:bg-muted/30">
                <TableCell>{statusBadge(r.pgto)}</TableCell>
                <TableCell className="font-mono">{r.po ?? "—"}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{r.pe ?? "—"}</TableCell>
                <TableCell>{r.exporter ?? "—"}</TableCell>
                <TableCell>{r.company ?? "—"}</TableCell>
                <TableCell className="max-w-[160px] truncate" title={r.payment ?? undefined}>{r.payment ?? "—"}</TableCell>
                <TableCell>{fmtFX(r.valor, r.moeda)}</TableCell>
                <TableCell className="text-right font-medium">{fmtBRL(r.reais)}</TableCell>
                <TableCell>{vencCell(r.vencAlterado ?? r.primeiroVencimento, r.pgto)}</TableCell>
                <TableCell>{fmtDate(r.dataPagto)}</TableCell>
                <TableCell className="max-w-[140px] truncate text-muted-foreground" title={r.cliente ?? undefined}>{r.cliente ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Expand / pagination */}
      {!showAll && filtered.length > INITIAL_ROWS && (
        <button onClick={() => setShowAll(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border border-dashed border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors">
          <ChevronDown className="h-4 w-4"/>
          Ver todos os {filtered.length.toLocaleString("pt-BR")} registros
        </button>
      )}
      {showAll && (
        <div className="space-y-2">
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Página {page} de {totalPages}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 1} onClick={() => setPage(page-1)}><ChevronLeft className="h-3 w-3"/></Button>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === totalPages} onClick={() => setPage(page+1)}><ChevronRight className="h-3 w-3"/></Button>
              </div>
            </div>
          )}
          <button onClick={() => { setShowAll(false); setPage(1); }} className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors">
            <ChevronUp className="h-3.5 w-3.5"/>
            Recolher
          </button>
        </div>
      )}
    </div>
  );
}

// ── Desembaraço Tab ───────────────────────────────────────────────────────────
function DesembaracoTab({ rows }: { rows: DesembaracoRow[] }) {
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState<string[]>([]);
  const [filterEmpresa, setFilterEmpresa] = useState<string[]>([]);
  const [filterTipo,    setFilterTipo]    = useState<string[]>([]);
  const [filterYear,    setFilterYear]    = useState<string[]>([]);
  const [filterMonth,   setFilterMonth]   = useState<string[]>([]);
  const [filterDay,     setFilterDay]     = useState<string[]>([]);
  const [showAll,       setShowAll]       = useState(false);
  const [page,          setPage]          = useState(1);

  // Dropdown options always from full rows
  const empresas = useMemo(() =>
    Array.from(new Set(rows.map((r) => r.empresa).filter(Boolean))).sort() as string[], [rows]);
  const tipos = useMemo(() =>
    Array.from(new Set(rows.map((r) => r.tipo).filter(Boolean))).sort() as string[], [rows]);
  const years = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { const d = parseDate(r.vencAlterado ?? r.vencimento); if (d) s.add(String(d.getFullYear())); });
    return Array.from(s).sort().reverse();
  }, [rows]);

  const reset = () => { setSearch(""); setFilterStatus([]); setFilterEmpresa([]); setFilterTipo([]); setFilterYear([]); setFilterMonth([]); setFilterDay([]); setShowAll(false); setPage(1); };
  const anyFilter = !!(search || filterStatus.length || filterEmpresa.length || filterTipo.length || filterYear.length || filterMonth.length || filterDay.length);

  // Filtered rows — computed first so cards derive from the same subset
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (filterStatus.length  && !filterStatus.includes(r.pagto ?? ""))    return false;
      if (filterEmpresa.length && !filterEmpresa.includes(r.empresa ?? "")) return false;
      if (filterTipo.length    && !filterTipo.includes(r.tipo ?? ""))       return false;
      const vd = r.vencAlterado ?? r.vencimento;
      const dt = (filterYear.length || filterMonth.length || filterDay.length) ? parseDate(vd) : null;
      if (filterYear.length  && (!dt || !filterYear.includes(String(dt.getFullYear()))))  return false;
      if (filterMonth.length && (!dt || !filterMonth.includes(String(dt.getMonth() + 1)))) return false;
      if (filterDay.length   && (!dt || !filterDay.includes(String(dt.getDate()))))        return false;
      if (q && !`${r.po} ${r.exportador} ${r.cliente} ${r.pe} ${r.modalidade}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, filterStatus, filterEmpresa, filterTipo, filterYear, filterMonth, filterDay]);

  // Card totals — always reflect the currently filtered subset
  const pendentes = useMemo(() => filtered.filter((r) => r.pagto === "PENDENTE" || r.pagto === "AGUARDANDO"), [filtered]);
  const vencidos  = useMemo(() => pendentes.filter((r) => isOverdue(r.vencAlterado ?? r.vencimento)), [pendentes]);
  const aSoon     = useMemo(() => pendentes.filter((r) => isDueSoon(r.vencAlterado ?? r.vencimento)), [pendentes]);
  const totalPend = useMemo(() => pendentes.reduce((s, r) => s + (r.reais ?? 0), 0), [pendentes]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const displayed  = showAll
    ? filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : filtered.slice(0, INITIAL_ROWS);

  const cf = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setShowAll(false); setPage(1); };

  return (
    <div className="space-y-4">
      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={<Clock         className="h-4 w-4 text-yellow-400"/>}  title="Pendentes / Aguardando" value={fmtBRL(totalPend)} sub={`${pendentes.length} lançamentos`} color="text-yellow-400"/>
        <SummaryCard icon={<AlertTriangle className="h-4 w-4 text-red-400"/>}     title="Vencidos"               value={fmtBRL(vencidos.reduce((s,r)=>s+(r.reais??0),0))} sub={`${vencidos.length} lançamentos`} color="text-red-400"/>
        <SummaryCard icon={<DollarSign    className="h-4 w-4 text-orange-400"/>}  title="Vence em 30 dias"       value={fmtBRL(aSoon.reduce((s,r)=>s+(r.reais??0),0))} sub={`${aSoon.length} lançamentos`} color="text-orange-400"/>
        <SummaryCard icon={<CheckCircle2  className="h-4 w-4 text-emerald-400"/>} title="Total registros"        value={filtered.length.toLocaleString("pt-BR")} sub={`${filtered.filter(r=>r.pagto==="PAGO").length} pagos`} color="text-emerald-400"/>
      </div>

      {/* Filters row 1 */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
          <Input placeholder="Buscar PO, exportador, cliente..." value={search} onChange={(e) => cf(setSearch)(e.target.value)} className="pl-8 h-9 text-sm"/>
        </div>
        <MultiSelect options={STATUS_DES_OPTIONS} value={filterStatus}  onChange={cf(setFilterStatus)}  placeholder="Status"  maxWidth="w-[145px]"/>
        <MultiSelect options={empresas}           value={filterEmpresa} onChange={cf(setFilterEmpresa)} placeholder="Empresa" maxWidth="w-[130px]"/>
        <MultiSelect options={tipos}              value={filterTipo}    onChange={cf(setFilterTipo)}    placeholder="Tipo"    maxWidth="w-[150px]"/>
        {anyFilter && <Button variant="ghost" size="sm" className="h-9" onClick={reset}>Limpar</Button>}
      </div>

      {/* Filters row 2 — date */}
      <DateFilters
        years={years}
        filterYear={filterYear}   filterMonth={filterMonth}   filterDay={filterDay}
        onYear={cf(setFilterYear)} onMonth={cf(setFilterMonth)} onDay={cf(setFilterDay)}
      />

      <p className="text-xs text-muted-foreground">
        {filtered.length.toLocaleString("pt-BR")} registros encontrados{filtered.length !== rows.length && ` (de ${rows.length.toLocaleString("pt-BR")} total)`}
        {!showAll && filtered.length > INITIAL_ROWS && ` — exibindo os primeiros ${INITIAL_ROWS}`}
      </p>

      {/* Table */}
      <div className="rounded-md border border-border/50 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs w-[100px]">Status</TableHead>
              <TableHead className="text-xs">PO</TableHead>
              <TableHead className="text-xs">PE</TableHead>
              <TableHead className="text-xs">Exportador</TableHead>
              <TableHead className="text-xs">Empresa</TableHead>
              <TableHead className="text-xs">Tipo</TableHead>
              <TableHead className="text-xs">Modalidade</TableHead>
              <TableHead className="text-xs text-right">R$</TableHead>
              <TableHead className="text-xs">Vencimento</TableHead>
              <TableHead className="text-xs">Data Pagto</TableHead>
              <TableHead className="text-xs">Cliente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
            ) : displayed.map((r, i) => (
              <TableRow key={i} className="text-xs hover:bg-muted/30">
                <TableCell>{statusBadge(r.pagto)}</TableCell>
                <TableCell className="font-mono">{r.po ?? "—"}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{r.pe ?? "—"}</TableCell>
                <TableCell>{r.exportador ?? "—"}</TableCell>
                <TableCell>{r.empresa ?? "—"}</TableCell>
                <TableCell>{r.tipo ?? "—"}</TableCell>
                <TableCell>{r.modalidade ?? "—"}</TableCell>
                <TableCell className="text-right font-medium">{fmtBRL(r.reais)}</TableCell>
                <TableCell>{vencCell(r.vencAlterado ?? r.vencimento, r.pagto)}</TableCell>
                <TableCell>{fmtDate(r.dataPagto)}</TableCell>
                <TableCell className="max-w-[140px] truncate text-muted-foreground" title={r.cliente ?? undefined}>{r.cliente ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Expand / pagination */}
      {!showAll && filtered.length > INITIAL_ROWS && (
        <button onClick={() => setShowAll(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border border-dashed border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors">
          <ChevronDown className="h-4 w-4"/>
          Ver todos os {filtered.length.toLocaleString("pt-BR")} registros
        </button>
      )}
      {showAll && (
        <div className="space-y-2">
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Página {page} de {totalPages}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 1} onClick={() => setPage(page-1)}><ChevronLeft className="h-3 w-3"/></Button>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === totalPages} onClick={() => setPage(page+1)}><ChevronRight className="h-3 w-3"/></Button>
              </div>
            </div>
          )}
          <button onClick={() => { setShowAll(false); setPage(1); }} className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors">
            <ChevronUp className="h-3.5 w-3.5"/>
            Recolher
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Pagamentos() {
  const qc   = useQueryClient();
  const matQ = useQuery({ queryKey: ["pagamentos-material"],    queryFn: fetchMaterial,    staleTime: 5*60_000, gcTime: 30*60_000, refetchOnMount: true, refetchOnWindowFocus: true });
  const desQ = useQuery({ queryKey: ["pagamentos-desembaraco"], queryFn: fetchDesembaraco, staleTime: 5*60_000, gcTime: 30*60_000, refetchOnMount: true, refetchOnWindowFocus: true });
  const [showUpload, setShowUpload] = useState(false);

  const matRows = matQ.data ?? [];
  const desRows = desQ.data ?? [];

  // Ticker estilo Bloomberg: total em aberto (R$) por fornecedor/exportador
  const tickerItems = useMemo(() => {
    const pend = new Map<string, number>();
    const all  = new Map<string, number>();
    const add = (map: Map<string, number>, key: string, v: number) => map.set(key, (map.get(key) ?? 0) + v);
    matRows.forEach((r) => {
      const key = (r.exporter ?? "").trim();
      if (!key) return;
      if (typeof r.reais === "number") {
        add(all, key, r.reais);
        if ((r.pgto ?? "").toUpperCase() === "PENDENTE") add(pend, key, r.reais);
      }
    });
    const src = pend.size > 0 ? pend : all;
    return Array.from(src.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, v]) => ({ name, value: fmtBRL(v) }));
  }, [matRows]);

  function handleUploadSuccess(mat: MatRow[], des: DesRow[]) {
    qc.setQueryData(["pagamentos-material"],    mat);
    qc.setQueryData(["pagamentos-desembaraco"], des);
  }

  return (
    <div className="min-h-screen bg-background">
      <HeaderTabs />
      <main className="mx-auto max-w-[1600px] px-4 py-6 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Banknote className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Pagamentos &amp; Desembaraço</h1>
              <p className="text-sm text-muted-foreground">FUP de pagamentos de material e custos de importação</p>
            </div>
          </div>
          <Button
            variant={showUpload ? "secondary" : "outline"}
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => setShowUpload((v) => !v)}
          >
            {showUpload ? <X className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            {showUpload ? "Fechar" : "Atualizar Planilha"}
          </Button>
        </div>

        {/* Ticker de fornecedores estilo Bloomberg */}
        {tickerItems.length > 0 && <FinanceTicker label="Fornecedores" items={tickerItems} />}

        {/* Upload panel */}
        {showUpload && (
          <UploadPanel onClose={() => setShowUpload(false)} onSuccess={handleUploadSuccess} />
        )}

        {/* Tabs */}
        <Tabs defaultValue="material" className="w-full">
          <TabsList className="h-9">
            <TabsTrigger value="material" className="gap-2 text-sm">
              <Package className="h-3.5 w-3.5"/>
              Material
              {matRows.filter(r => r.pgto === "PENDENTE").length > 0 && (
                <Badge className="ml-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs px-1.5 py-0">
                  {matRows.filter(r => r.pgto === "PENDENTE").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="desembaraco" className="gap-2 text-sm">
              <Truck className="h-3.5 w-3.5"/>
              Desembaraço
              {desRows.filter(r => r.pagto === "PENDENTE" || r.pagto === "AGUARDANDO").length > 0 && (
                <Badge className="ml-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs px-1.5 py-0">
                  {desRows.filter(r => r.pagto === "PENDENTE" || r.pagto === "AGUARDANDO").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="material" className="mt-4">
            {matQ.isLoading ? <p className="text-center py-16 text-muted-foreground">Carregando...</p>
             : matQ.error   ? <p className="text-center py-16 text-red-400">Erro ao carregar dados de material.</p>
             : <MaterialTab rows={matRows}/>}
          </TabsContent>

          <TabsContent value="desembaraco" className="mt-4">
            {desQ.isLoading ? <p className="text-center py-16 text-muted-foreground">Carregando...</p>
             : desQ.error   ? <p className="text-center py-16 text-red-400">Erro ao carregar dados de desembaraço.</p>
             : <DesembaracoTab rows={desRows}/>}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
