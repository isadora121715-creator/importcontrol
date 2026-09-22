import { useRef, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  parseExcelPagamentos,
  type MatRow,
  type DesRow,
  type CambioRow,
} from "@/lib/parseExcelPagamentos";
import { fetchJson, uploadJson } from "@/lib/jsonSync";
import { SupplierTicker, type TickerItem } from "@/components/SupplierTicker";
import { toast } from "sonner";
import { HeaderTabs } from "@/components/HeaderTabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
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
  Loader2,
  X,
  RefreshCw,
  Check,
  Flame,
  Landmark,
} from "lucide-react";

// ── Sync files (public Supabase Storage — see src/lib/jsonSync.ts) ───────────
const SYNC_MAT = "pagamentos-material-cache.json";
const SYNC_DES = "pagamentos-desembaraco-cache.json";
const SYNC_CAM = "pagamentos-cambio-cache.json";

// ── Constants ─────────────────────────────────────────────────────────────────
const INITIAL_ROWS = 10;
const PAGE_SIZE    = 50;
const AUTO_REFRESH_MS = 60_000; // "live" feel — re-check for updates every minute

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const STATUS_OPTIONS = ["PENDENTE", "AGUARDANDO", "PAGO", "CANCELADO", "EXCLUÍDO"];

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
const isPending = (status: string | null) => {
  const s = (status ?? "PENDENTE").toUpperCase();
  return s !== "PAGO" && s !== "CANCELADO" && s !== "EXCLUÍDO";
};

function statusBadge(s: string | null) {
  const v = (s ?? "PENDENTE").toUpperCase();
  if (v === "PAGO")       return <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30 text-xs">PAGO</Badge>;
  if (v === "PENDENTE")   return <Badge className="bg-yellow-600/20  text-yellow-400  border-yellow-600/30  text-xs">PENDENTE</Badge>;
  if (v === "AGUARDANDO") return <Badge className="bg-blue-600/20    text-blue-400    border-blue-600/30    text-xs">AGUARDANDO</Badge>;
  if (v === "CANCELADO")  return <Badge className="bg-red-600/20     text-red-400     border-red-600/30     text-xs">CANCELADO</Badge>;
  if (v.includes("EXCLU"))return <Badge className="bg-zinc-600/20   text-zinc-400    border-zinc-600/30    text-xs">EXCLUÍDO</Badge>;
  return <Badge variant="outline" className="text-xs">{v}</Badge>;
}

function urgenciaBadge(u: string | null) {
  if (!u) return null;
  const v = u.toUpperCase();
  if (v.includes("URGENTE"))
    return <Badge className="bg-red-600/20 text-red-400 border-red-600/30 text-xs gap-1"><Flame className="h-3 w-3" />{u}</Badge>;
  if (v.includes("ATEN") || v.includes("MODERAD"))
    return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30 text-xs">{u}</Badge>;
  return <Badge variant="outline" className="text-xs">{u}</Badge>;
}

function vencCell(d: string | null | undefined, status: string | null) {
  if (!isPending(status)) return <span>{fmtDate(d)}</span>;
  if (isOverdue(d))  return <span className="text-red-400    font-semibold">{fmtDate(d)}</span>;
  if (isDueSoon(d))  return <span className="text-yellow-400 font-semibold">{fmtDate(d)}</span>;
  return <span>{fmtDate(d)}</span>;
}

// ── Multi-select component ────────────────────────────────────────────────────
function MultiSelect({
  options, value, onChange, placeholder, className = "", maxWidth = "w-[150px]",
}: {
  options: string[]; value: string[]; onChange: (v: string[]) => void;
  placeholder: string; className?: string; maxWidth?: string;
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

// ── Data fetching — shared storage first, bundled static fallback ────────────
async function fetchMaterial(): Promise<MatRow[]> {
  const synced = await fetchJson<MatRow[]>(SYNC_MAT);
  if (synced && synced.length > 0) return synced;
  const r = await fetch(`/data/${SYNC_MAT}?_=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Falha ao carregar dados de material.");
  return r.json();
}

async function fetchDesembaraco(): Promise<DesRow[]> {
  const synced = await fetchJson<DesRow[]>(SYNC_DES);
  if (synced && synced.length > 0) return synced;
  const r = await fetch(`/data/${SYNC_DES}?_=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Falha ao carregar dados de desembaraço.");
  return r.json();
}

async function fetchCambio(): Promise<CambioRow[]> {
  const synced = await fetchJson<CambioRow[]>(SYNC_CAM);
  if (synced && synced.length > 0) return synced;
  try {
    const r = await fetch(`/data/${SYNC_CAM}?_=${Date.now()}`, { cache: "no-store" });
    if (r.ok) return await r.json();
  } catch { /* no fallback available */ }
  return [];
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

// ── Câmbio do dia strip ────────────────────────────────────────────────────────
function CambioStrip({ rows }: { rows: CambioRow[] }) {
  if (rows.length === 0) return null;
  const updatedAt = rows.find((r) => r.atualizadoEm)?.atualizadoEm ?? null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground font-medium">Câmbio do dia{updatedAt ? ` (${fmtDate(updatedAt)})` : ""}:</span>
      {rows.filter((r) => r.moeda !== "BRL").map((r) => (
        <Badge key={r.moeda} variant="outline" className="font-mono text-xs">
          {r.moeda}/BRL {r.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </Badge>
      ))}
    </div>
  );
}

// ── Date filters (multi-select) ───────────────────────────────────────────────
function DateFilters({
  years, filterYear, filterMonth, filterDay, onYear, onMonth, onDay,
}: {
  years: string[];
  filterYear: string[]; filterMonth: string[]; filterDay: string[];
  onYear: (v: string[]) => void; onMonth: (v: string[]) => void; onDay: (v: string[]) => void;
}) {
  const dayOptions = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
      <MultiSelect options={years} value={filterYear} onChange={onYear} placeholder="Ano" maxWidth="w-[110px]" />
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
  onClose, onSuccess,
}: {
  onClose: () => void;
  onSuccess: (mat: MatRow[], des: DesRow[], cam: CambioRow[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function syncAll(mat: MatRow[], des: DesRow[], cam: CambioRow[]) {
    setMsg("Sincronizando com outros usuários...");
    const results = await Promise.allSettled([
      uploadJson(SYNC_MAT, mat),
      uploadJson(SYNC_DES, des),
      uploadJson(SYNC_CAM, cam),
    ]);
    const failed = results.some((r) => r.status === "rejected");
    if (failed) console.warn("Sync parcial (não crítico):", results);
  }

  async function handleExcelFile(file: File) {
    setUploading(true);
    setMsg("Lendo arquivo Excel...");
    try {
      const { material, desembaraco, cambio } = await parseExcelPagamentos(file);
      setMsg(`Parseado: ${material.length} registros de material, ${desembaraco.length} de desembaraço.`);
      await syncAll(material, desembaraco, cambio);
      onSuccess(material, desembaraco, cambio);
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
            <p className="text-xs text-muted-foreground mt-1">
              Planilha "Pagamentos Internacionais" — abas <strong>Pagamentos - Material</strong>, <strong>Pagamentos - Desembaraço</strong> e <strong>Câmbio</strong>
            </p>
          </div>
          {!uploading && (
            <Button size="sm" className="w-full" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Selecionar arquivo Excel
            </Button>
          )}
        </div>

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

// ── Row detail modal ──────────────────────────────────────────────────────────
type UnifiedRow = (MatRow | DesRow) & { _kind: "Material" | "Desembaraço" };

function field(label: string, value: React.ReactNode) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function RowDetail({ row, onClose }: { row: UnifiedRow; onClose: () => void }) {
  const isMat = row._kind === "Material";
  const mat = row as MatRow;
  const des = row as DesRow;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs font-semibold">{row._kind}</Badge>
            <span className="font-mono text-base">{row.po ?? "—"}</span>
            <span className="text-sm text-muted-foreground font-normal">{row.pe}</span>
            {statusBadge(row.status)}
            {urgenciaBadge(row.urgencia)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {field("Empresa Compradora", row.empresa)}
            {field("Fornecedor/Exportador", row.fornecedor)}
            {field("Status da PO", row.statusPO)}
            {isMat ? field("Termo de Pagamento", mat.termoPagamento) : field("Tipo de Despesa", des.tipoDespesa)}
            {!isMat && field("Modalidade", des.modalidade)}
            {field("Modal", row.modal)}
            {isMat && field("ETD", fmtDate(mat.etd))}
            {isMat && field("ETA", fmtDate(mat.eta))}
          </div>

          <div className="bg-muted/20 rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold">Valores</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {isMat && field("Valor (Moeda Orig.)", fmtFX(mat.valorOrig, mat.moeda))}
              {!isMat && field("Valor Base", fmtFX(des.valorBase, des.moeda))}
              {!isMat && field("Valor Real Confirmado", fmtFX(des.valorRealConfirmado, des.moeda))}
              {!isMat && field("Valor Previsão", des.valorPrevisao != null ? fmtFX(des.valorPrevisao, des.moeda) : null)}
              {field("Taxa de Câmbio", row.taxaCambio?.toLocaleString("pt-BR"))}
              {field("Valor em BRL", fmtBRL(row.reais))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {field("Vencimento Original", fmtDate(row.vencOriginal))}
            {field("Vencimento Atualizado", fmtDate(row.vencAtualizado))}
            {field("Dias até Vencer (Fornecedor)", row.diasAteVencerFornecedor)}
            {field("Dias até Prazo Cliente", row.diasAtePrazoCliente)}
          </div>

          {(row.clientePrincipal || row.clienteSecundario) && (
            <div className="bg-muted/20 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold">Cliente &amp; Faturamento</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {field("Cliente Principal", row.clientePrincipal)}
                {field("Faturamento Cliente Princ.", fmtBRL(row.faturamentoClientePrincipal))}
                {field("Prazo Cliente Principal", fmtDate(row.prazoClientePrincipal))}
                {field("Cliente Secundário", row.clienteSecundario)}
                {field("Faturamento Cliente Sec.", fmtBRL(row.faturamentoClienteSecundario))}
                {field("Prazo Cliente Secundário", fmtDate(row.prazoClienteSecundario))}
                {field("Faturamento Total da PO", fmtBRL(row.faturamentoTotalPO))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {field("Score Priorização", row.scorePriorizacao)}
            {field("Enviado ao Financeiro", fmtDate(row.enviadoFinanceiro))}
            {field("Retorno do Financeiro", row.retornoFinanceiro)}
            {field("Banco Pagador", row.bancoPagador)}
            {field("Data de Pagamento", fmtDate(row.dataPagto))}
          </div>

          {row.observacoes && (
            <div className="bg-muted/20 rounded-md px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Obs: </span>{row.observacoes}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Priority dashboard ────────────────────────────────────────────────────────
function PriorityBoard({
  rows, onSelect,
}: {
  rows: UnifiedRow[];
  onSelect: (r: UnifiedRow) => void;
}) {
  const pending = useMemo(
    () => rows
      .filter((r) => isPending(r.status))
      .sort((a, b) => {
        const sa = a.scorePriorizacao ?? 0;
        const sb = b.scorePriorizacao ?? 0;
        if (sb !== sa) return sb - sa;
        const da = a.diasAtePrazoCliente ?? a.diasAteVencerFornecedor ?? 999;
        const db = b.diasAtePrazoCliente ?? b.diasAteVencerFornecedor ?? 999;
        return da - db;
      })
      .slice(0, 25),
    [rows],
  );

  const urgentCount = pending.filter((r) => (r.urgencia ?? "").toUpperCase().includes("URGENTE")).length;
  const totalPend = pending.reduce((s, r) => s + (r.reais ?? 0), 0);

  if (pending.length === 0) {
    return <p className="text-center py-16 text-muted-foreground">Nenhum pagamento pendente no momento. 🎉</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <SummaryCard icon={<Flame className="h-4 w-4 text-red-400" />} title="Mais urgentes" value={String(urgentCount)} sub="dentro do top 25 por score" color="text-red-400" />
        <SummaryCard icon={<DollarSign className="h-4 w-4 text-yellow-400" />} title="Valor em jogo" value={fmtBRL(totalPend)} sub={`${pending.length} pagamentos priorizados`} color="text-yellow-400" />
        <SummaryCard icon={<Landmark className="h-4 w-4 text-emerald-400" />} title="Faturamento vinculado" value={fmtBRL(pending.reduce((s, r) => s + (r.faturamentoTotalPO ?? 0), 0))} sub="a liberar para o cliente" color="text-emerald-400" />
      </div>

      <p className="text-xs text-muted-foreground">
        Ordenado por <strong>Score de Priorização</strong> (faturamento do cliente em risco × urgência) — o que está no topo é o que trava dinheiro entrando se não for pago.
      </p>

      <div className="space-y-2">
        {pending.map((r, i) => {
          const urgent = (r.urgencia ?? "").toUpperCase().includes("URGENTE");
          return (
            <div
              key={`${r._kind}-${r.po}-${r.pe}-${i}`}
              onClick={() => onSelect(r)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors hover:bg-muted/40 ${
                urgent ? "border-red-500/30 bg-red-500/5" : "border-border/50"
              }`}
            >
              <span className="shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-muted text-xs font-bold text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{r.fornecedor ?? "—"}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{r.po} {r.pe && `· ${r.pe}`}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="text-sm truncate" title={r.clientePrincipal ?? undefined}>{r.clientePrincipal ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  {vencCell(r.vencAtualizado ?? r.vencOriginal, r.status)}
                </div>
                <div className="text-right sm:text-left">
                  <p className="text-sm font-bold">{fmtBRL(r.reais)}</p>
                  <Badge variant="outline" className="text-[10px]">{r._kind}</Badge>
                </div>
              </div>
              <div className="shrink-0 hidden md:block">{urgenciaBadge(r.urgencia)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Material Tab ──────────────────────────────────────────────────────────────
function MaterialTab({ rows, onSelect }: { rows: MaterialRow[]; onSelect: (r: UnifiedRow) => void }) {
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState<string[]>([]);
  const [filterCompany, setFilterCompany] = useState<string[]>([]);
  const [filterExp,     setFilterExp]     = useState<string[]>([]);
  const [filterYear,    setFilterYear]    = useState<string[]>([]);
  const [filterMonth,   setFilterMonth]   = useState<string[]>([]);
  const [filterDay,     setFilterDay]     = useState<string[]>([]);
  const [showAll,       setShowAll]       = useState(false);
  const [page,          setPage]          = useState(1);

  const companies = useMemo(() =>
    Array.from(new Set(rows.map((r) => r.empresa).filter(Boolean))).sort() as string[], [rows]);
  const exporters = useMemo(() =>
    Array.from(new Set(rows.map((r) => r.fornecedor).filter(Boolean))).sort() as string[], [rows]);
  const years = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { const d = parseDate(r.vencAtualizado ?? r.vencOriginal); if (d) s.add(String(d.getFullYear())); });
    return Array.from(s).sort().reverse();
  }, [rows]);

  const reset = () => { setSearch(""); setFilterStatus([]); setFilterCompany([]); setFilterExp([]); setFilterYear([]); setFilterMonth([]); setFilterDay([]); setShowAll(false); setPage(1); };
  const anyFilter = !!(search || filterStatus.length || filterCompany.length || filterExp.length || filterYear.length || filterMonth.length || filterDay.length);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (filterStatus.length  && !filterStatus.includes(r.status ?? ""))     return false;
      if (filterCompany.length && !filterCompany.includes(r.empresa ?? ""))   return false;
      if (filterExp.length     && !filterExp.includes(r.fornecedor ?? ""))    return false;
      const vd = r.vencAtualizado ?? r.vencOriginal;
      const dt = (filterYear.length || filterMonth.length || filterDay.length) ? parseDate(vd) : null;
      if (filterYear.length  && (!dt || !filterYear.includes(String(dt.getFullYear()))))  return false;
      if (filterMonth.length && (!dt || !filterMonth.includes(String(dt.getMonth() + 1)))) return false;
      if (filterDay.length   && (!dt || !filterDay.includes(String(dt.getDate()))))        return false;
      if (q && !`${r.po} ${r.fornecedor} ${r.clientePrincipal} ${r.pe} ${r.termoPagamento}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, filterStatus, filterCompany, filterExp, filterYear, filterMonth, filterDay]);

  const pendentes = useMemo(() => filtered.filter((r) => isPending(r.status)), [filtered]);
  const vencidos  = useMemo(() => pendentes.filter((r) => isOverdue(r.vencAtualizado ?? r.vencOriginal)), [pendentes]);
  const aSoon     = useMemo(() => pendentes.filter((r) => isDueSoon(r.vencAtualizado ?? r.vencOriginal)), [pendentes]);
  const totalPend = useMemo(() => pendentes.reduce((s, r) => s + (r.reais ?? 0), 0), [pendentes]);
  const totalVenc = useMemo(() => vencidos.reduce((s, r) => s + (r.reais ?? 0), 0), [vencidos]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const displayed  = showAll
    ? filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : filtered.slice(0, INITIAL_ROWS);

  const cf = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setShowAll(false); setPage(1); };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={<Clock         className="h-4 w-4 text-yellow-400"/>}  title="Pendentes"        value={fmtBRL(totalPend)} sub={`${pendentes.length} pagamentos`}  color="text-yellow-400"/>
        <SummaryCard icon={<AlertTriangle className="h-4 w-4 text-red-400"/>}     title="Vencidos"         value={fmtBRL(totalVenc)} sub={`${vencidos.length} pagamentos`}   color="text-red-400"/>
        <SummaryCard icon={<DollarSign    className="h-4 w-4 text-orange-400"/>}  title="Vence em 30 dias" value={fmtBRL(aSoon.reduce((s,r)=>s+(r.reais??0),0))} sub={`${aSoon.length} pagamentos`} color="text-orange-400"/>
        <SummaryCard icon={<CheckCircle2  className="h-4 w-4 text-emerald-400"/>} title="Total registros"  value={filtered.length.toLocaleString("pt-BR")} sub={`${filtered.filter(r=>r.status==="PAGO").length} pagos`} color="text-emerald-400"/>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
          <Input placeholder="Buscar PO, fornecedor, cliente..." value={search} onChange={(e) => cf(setSearch)(e.target.value)} className="pl-8 h-9 text-sm"/>
        </div>
        <MultiSelect options={STATUS_OPTIONS} value={filterStatus}  onChange={cf(setFilterStatus)}  placeholder="Status"      maxWidth="w-[145px]"/>
        <MultiSelect options={companies}      value={filterCompany} onChange={cf(setFilterCompany)} placeholder="Empresa"     maxWidth="w-[130px]"/>
        <MultiSelect options={exporters}      value={filterExp}     onChange={cf(setFilterExp)}     placeholder="Fornecedor"  maxWidth="w-[160px]"/>
        {anyFilter && <Button variant="ghost" size="sm" className="h-9" onClick={reset}>Limpar</Button>}
      </div>

      <DateFilters years={years} filterYear={filterYear} filterMonth={filterMonth} filterDay={filterDay}
        onYear={cf(setFilterYear)} onMonth={cf(setFilterMonth)} onDay={cf(setFilterDay)} />

      <p className="text-xs text-muted-foreground">
        {filtered.length.toLocaleString("pt-BR")} registros encontrados{filtered.length !== rows.length && ` (de ${rows.length.toLocaleString("pt-BR")} total)`}
        {!showAll && filtered.length > INITIAL_ROWS && ` — exibindo os primeiros ${INITIAL_ROWS}`}
        {" "}<span className="opacity-60">· clique em uma linha para ver detalhes</span>
      </p>

      <div className="rounded-md border border-border/50 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs w-[90px]">Status</TableHead>
              <TableHead className="text-xs">PO</TableHead>
              <TableHead className="text-xs">Fornecedor</TableHead>
              <TableHead className="text-xs">Empresa</TableHead>
              <TableHead className="text-xs">Urgência</TableHead>
              <TableHead className="text-xs">Valor FX</TableHead>
              <TableHead className="text-xs text-right">R$</TableHead>
              <TableHead className="text-xs">Vencimento</TableHead>
              <TableHead className="text-xs">Cliente Principal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
            ) : displayed.map((r, i) => (
              <TableRow key={i} className="text-xs hover:bg-muted/30 cursor-pointer" onClick={() => onSelect({ ...r, _kind: "Material" })}>
                <TableCell>{statusBadge(r.status)}</TableCell>
                <TableCell className="font-mono">{r.po ?? "—"}</TableCell>
                <TableCell>{r.fornecedor ?? "—"}</TableCell>
                <TableCell>{r.empresa ?? "—"}</TableCell>
                <TableCell>{urgenciaBadge(r.urgencia)}</TableCell>
                <TableCell>{fmtFX(r.valorOrig, r.moeda)}</TableCell>
                <TableCell className="text-right font-medium">{fmtBRL(r.reais)}</TableCell>
                <TableCell>{vencCell(r.vencAtualizado ?? r.vencOriginal, r.status)}</TableCell>
                <TableCell className="max-w-[160px] truncate text-muted-foreground" title={r.clientePrincipal ?? undefined}>{r.clientePrincipal ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!showAll && filtered.length > INITIAL_ROWS && (
        <button onClick={() => setShowAll(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border border-dashed border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors">
          <ChevronDown className="h-4 w-4"/> Ver todos os {filtered.length.toLocaleString("pt-BR")} registros
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
            <ChevronUp className="h-3.5 w-3.5"/> Recolher
          </button>
        </div>
      )}
    </div>
  );
}

// ── Desembaraço Tab ───────────────────────────────────────────────────────────
function DesembaracoTab({ rows, onSelect }: { rows: DesembaracoRow[]; onSelect: (r: UnifiedRow) => void }) {
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState<string[]>([]);
  const [filterEmpresa, setFilterEmpresa] = useState<string[]>([]);
  const [filterTipo,    setFilterTipo]    = useState<string[]>([]);
  const [filterYear,    setFilterYear]    = useState<string[]>([]);
  const [filterMonth,   setFilterMonth]   = useState<string[]>([]);
  const [filterDay,     setFilterDay]     = useState<string[]>([]);
  const [showAll,       setShowAll]       = useState(false);
  const [page,          setPage]          = useState(1);

  const empresas = useMemo(() =>
    Array.from(new Set(rows.map((r) => r.empresa).filter(Boolean))).sort() as string[], [rows]);
  const tipos = useMemo(() =>
    Array.from(new Set(rows.map((r) => r.tipoDespesa).filter(Boolean))).sort() as string[], [rows]);
  const years = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { const d = parseDate(r.vencAtualizado ?? r.vencOriginal); if (d) s.add(String(d.getFullYear())); });
    return Array.from(s).sort().reverse();
  }, [rows]);

  const reset = () => { setSearch(""); setFilterStatus([]); setFilterEmpresa([]); setFilterTipo([]); setFilterYear([]); setFilterMonth([]); setFilterDay([]); setShowAll(false); setPage(1); };
  const anyFilter = !!(search || filterStatus.length || filterEmpresa.length || filterTipo.length || filterYear.length || filterMonth.length || filterDay.length);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (filterStatus.length  && !filterStatus.includes(r.status ?? ""))     return false;
      if (filterEmpresa.length && !filterEmpresa.includes(r.empresa ?? "")) return false;
      if (filterTipo.length    && !filterTipo.includes(r.tipoDespesa ?? ""))       return false;
      const vd = r.vencAtualizado ?? r.vencOriginal;
      const dt = (filterYear.length || filterMonth.length || filterDay.length) ? parseDate(vd) : null;
      if (filterYear.length  && (!dt || !filterYear.includes(String(dt.getFullYear()))))  return false;
      if (filterMonth.length && (!dt || !filterMonth.includes(String(dt.getMonth() + 1)))) return false;
      if (filterDay.length   && (!dt || !filterDay.includes(String(dt.getDate()))))        return false;
      if (q && !`${r.po} ${r.fornecedor} ${r.clientePrincipal} ${r.pe} ${r.modalidade}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, filterStatus, filterEmpresa, filterTipo, filterYear, filterMonth, filterDay]);

  const pendentes = useMemo(() => filtered.filter((r) => isPending(r.status)), [filtered]);
  const vencidos  = useMemo(() => pendentes.filter((r) => isOverdue(r.vencAtualizado ?? r.vencOriginal)), [pendentes]);
  const aSoon     = useMemo(() => pendentes.filter((r) => isDueSoon(r.vencAtualizado ?? r.vencOriginal)), [pendentes]);
  const totalPend = useMemo(() => pendentes.reduce((s, r) => s + (r.reais ?? 0), 0), [pendentes]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const displayed  = showAll
    ? filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : filtered.slice(0, INITIAL_ROWS);

  const cf = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setShowAll(false); setPage(1); };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={<Clock         className="h-4 w-4 text-yellow-400"/>}  title="Pendentes / Aguardando" value={fmtBRL(totalPend)} sub={`${pendentes.length} lançamentos`} color="text-yellow-400"/>
        <SummaryCard icon={<AlertTriangle className="h-4 w-4 text-red-400"/>}     title="Vencidos"               value={fmtBRL(vencidos.reduce((s,r)=>s+(r.reais??0),0))} sub={`${vencidos.length} lançamentos`} color="text-red-400"/>
        <SummaryCard icon={<DollarSign    className="h-4 w-4 text-orange-400"/>}  title="Vence em 30 dias"       value={fmtBRL(aSoon.reduce((s,r)=>s+(r.reais??0),0))} sub={`${aSoon.length} lançamentos`} color="text-orange-400"/>
        <SummaryCard icon={<CheckCircle2  className="h-4 w-4 text-emerald-400"/>} title="Total registros"        value={filtered.length.toLocaleString("pt-BR")} sub={`${filtered.filter(r=>r.status==="PAGO").length} pagos`} color="text-emerald-400"/>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
          <Input placeholder="Buscar PO, fornecedor, cliente..." value={search} onChange={(e) => cf(setSearch)(e.target.value)} className="pl-8 h-9 text-sm"/>
        </div>
        <MultiSelect options={STATUS_OPTIONS} value={filterStatus}  onChange={cf(setFilterStatus)}  placeholder="Status"  maxWidth="w-[145px]"/>
        <MultiSelect options={empresas}       value={filterEmpresa} onChange={cf(setFilterEmpresa)} placeholder="Empresa" maxWidth="w-[130px]"/>
        <MultiSelect options={tipos}          value={filterTipo}    onChange={cf(setFilterTipo)}    placeholder="Tipo"    maxWidth="w-[150px]"/>
        {anyFilter && <Button variant="ghost" size="sm" className="h-9" onClick={reset}>Limpar</Button>}
      </div>

      <DateFilters years={years} filterYear={filterYear} filterMonth={filterMonth} filterDay={filterDay}
        onYear={cf(setFilterYear)} onMonth={cf(setFilterMonth)} onDay={cf(setFilterDay)} />

      <p className="text-xs text-muted-foreground">
        {filtered.length.toLocaleString("pt-BR")} registros encontrados{filtered.length !== rows.length && ` (de ${rows.length.toLocaleString("pt-BR")} total)`}
        {!showAll && filtered.length > INITIAL_ROWS && ` — exibindo os primeiros ${INITIAL_ROWS}`}
        {" "}<span className="opacity-60">· clique em uma linha para ver detalhes</span>
      </p>

      <div className="rounded-md border border-border/50 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs w-[100px]">Status</TableHead>
              <TableHead className="text-xs">PO</TableHead>
              <TableHead className="text-xs">Fornecedor</TableHead>
              <TableHead className="text-xs">Empresa</TableHead>
              <TableHead className="text-xs">Tipo</TableHead>
              <TableHead className="text-xs">Urgência</TableHead>
              <TableHead className="text-xs text-right">R$</TableHead>
              <TableHead className="text-xs">Vencimento</TableHead>
              <TableHead className="text-xs">Cliente Principal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
            ) : displayed.map((r, i) => (
              <TableRow key={i} className="text-xs hover:bg-muted/30 cursor-pointer" onClick={() => onSelect({ ...r, _kind: "Desembaraço" })}>
                <TableCell>{statusBadge(r.status)}</TableCell>
                <TableCell className="font-mono">{r.po ?? "—"}</TableCell>
                <TableCell>{r.fornecedor ?? "—"}</TableCell>
                <TableCell>{r.empresa ?? "—"}</TableCell>
                <TableCell>{r.tipoDespesa ?? "—"}</TableCell>
                <TableCell>{urgenciaBadge(r.urgencia)}</TableCell>
                <TableCell className="text-right font-medium">{fmtBRL(r.reais)}</TableCell>
                <TableCell>{vencCell(r.vencAtualizado ?? r.vencOriginal, r.status)}</TableCell>
                <TableCell className="max-w-[160px] truncate text-muted-foreground" title={r.clientePrincipal ?? undefined}>{r.clientePrincipal ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!showAll && filtered.length > INITIAL_ROWS && (
        <button onClick={() => setShowAll(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border border-dashed border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors">
          <ChevronDown className="h-4 w-4"/> Ver todos os {filtered.length.toLocaleString("pt-BR")} registros
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
            <ChevronUp className="h-3.5 w-3.5"/> Recolher
          </button>
        </div>
      )}
    </div>
  );
}

type MaterialRow    = MatRow;
type DesembaracoRow = DesRow;

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Pagamentos() {
  const qc   = useQueryClient();
  const matQ = useQuery({
    queryKey: ["pagamentos-material"], queryFn: fetchMaterial,
    staleTime: 5*60_000, gcTime: 30*60_000,
    refetchOnMount: true, refetchOnWindowFocus: true, refetchInterval: AUTO_REFRESH_MS,
  });
  const desQ = useQuery({
    queryKey: ["pagamentos-desembaraco"], queryFn: fetchDesembaraco,
    staleTime: 5*60_000, gcTime: 30*60_000,
    refetchOnMount: true, refetchOnWindowFocus: true, refetchInterval: AUTO_REFRESH_MS,
  });
  const camQ = useQuery({
    queryKey: ["pagamentos-cambio"], queryFn: fetchCambio,
    staleTime: 5*60_000, gcTime: 30*60_000,
    refetchOnMount: true, refetchOnWindowFocus: true, refetchInterval: AUTO_REFRESH_MS,
  });
  const [showUpload, setShowUpload] = useState(false);
  const [selected, setSelected] = useState<UnifiedRow | null>(null);

  const matRows = useMemo(() => matQ.data ?? [], [matQ.data]);
  const desRows = useMemo(() => desQ.data ?? [], [desQ.data]);
  const camRows = camQ.data ?? [];

  const isLive = matQ.isFetching || desQ.isFetching;

  function handleUploadSuccess(mat: MatRow[], des: DesRow[], cam: CambioRow[]) {
    qc.setQueryData(["pagamentos-material"],    mat);
    qc.setQueryData(["pagamentos-desembaraco"], des);
    qc.setQueryData(["pagamentos-cambio"],      cam);
  }

  const allUnified: UnifiedRow[] = useMemo(() => [
    ...matRows.map((r) => ({ ...r, _kind: "Material" as const })),
    ...desRows.map((r) => ({ ...r, _kind: "Desembaraço" as const })),
  ], [matRows, desRows]);

  const tickerItems: TickerItem[] = useMemo(() => {
    return allUnified
      .filter((r) => isPending(r.status) && r.fornecedor && r.reais)
      .sort((a, b) => (b.scorePriorizacao ?? 0) - (a.scorePriorizacao ?? 0))
      .slice(0, 30)
      .map((r, i) => ({
        key: `${r.po}-${r.pe}-${i}`,
        name: r.fornecedor as string,
        value: r.reais as number,
        meta: r.po ?? undefined,
        tone: (r.urgencia ?? "").toUpperCase().includes("URGENTE") ? "urgent" : "normal",
      }));
  }, [allUnified]);

  const pendingCountMat = matRows.filter(r => isPending(r.status)).length;
  const pendingCountDes = desRows.filter(r => isPending(r.status)).length;

  return (
    <div className="min-h-screen bg-background">
      <HeaderTabs />
      <main className="mx-auto max-w-[1600px] px-4 py-6 space-y-6">

        {selected && <RowDetail row={selected} onClose={() => setSelected(null)} />}

        {/* Page header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Banknote className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                Pagamentos &amp; Desembaraço
                <span className="flex items-center gap-1 text-[10px] font-normal text-muted-foreground">
                  <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/40"}`} />
                  {isLive ? "atualizando..." : "ao vivo"}
                </span>
              </h1>
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

        {/* Bloomberg-style ticker */}
        <SupplierTicker items={tickerItems} />

        {/* Câmbio do dia */}
        <CambioStrip rows={camRows} />

        {/* Upload panel */}
        {showUpload && (
          <UploadPanel onClose={() => setShowUpload(false)} onSuccess={handleUploadSuccess} />
        )}

        {/* Tabs */}
        <Tabs defaultValue="prioridade" className="w-full">
          <TabsList className="h-9">
            <TabsTrigger value="prioridade" className="gap-2 text-sm">
              <Flame className="h-3.5 w-3.5"/>
              Prioridade
            </TabsTrigger>
            <TabsTrigger value="material" className="gap-2 text-sm">
              <Package className="h-3.5 w-3.5"/>
              Material
              {pendingCountMat > 0 && (
                <Badge className="ml-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs px-1.5 py-0">{pendingCountMat}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="desembaraco" className="gap-2 text-sm">
              <Truck className="h-3.5 w-3.5"/>
              Desembaraço
              {pendingCountDes > 0 && (
                <Badge className="ml-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs px-1.5 py-0">{pendingCountDes}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="prioridade" className="mt-4">
            {(matQ.isLoading || desQ.isLoading) ? <p className="text-center py-16 text-muted-foreground">Carregando...</p>
             : <PriorityBoard rows={allUnified} onSelect={setSelected} />}
          </TabsContent>

          <TabsContent value="material" className="mt-4">
            {matQ.isLoading ? <p className="text-center py-16 text-muted-foreground">Carregando...</p>
             : matQ.error   ? <p className="text-center py-16 text-red-400">Erro ao carregar dados de material.</p>
             : <MaterialTab rows={matRows} onSelect={setSelected}/>}
          </TabsContent>

          <TabsContent value="desembaraco" className="mt-4">
            {desQ.isLoading ? <p className="text-center py-16 text-muted-foreground">Carregando...</p>
             : desQ.error   ? <p className="text-center py-16 text-red-400">Erro ao carregar dados de desembaraço.</p>
             : <DesembaracoTab rows={desRows} onSelect={setSelected}/>}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
