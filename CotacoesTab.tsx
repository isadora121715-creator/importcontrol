import { useRef, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseCotacoesExcel, type CotacaoRow } from "@/lib/parseCotacoesExcel";
import { fetchJson, uploadJson } from "@/lib/jsonSync";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FileText, Search, Upload, RefreshCw, X, Check, ChevronDown,
  ChevronUp, ChevronLeft, ChevronRight, Loader2, Users, Tag,
  CalendarDays, Ruler, Layers,
} from "lucide-react";

// ── Cross-user sync ───────────────────────────────────────────────────────────
// Data is shared across every user via a public Supabase Storage file — see
// src/lib/jsonSync.ts. Falls back to the static snapshot bundled at last deploy.
const SYNC_FILE = "cotacoes-cache.json";

async function fetchCotacoes(): Promise<CotacaoRow[]> {
  const synced = await fetchJson<CotacaoRow[]>(SYNC_FILE);
  if (Array.isArray(synced) && synced.length > 0) return synced;
  const r = await fetch(`/data/cotacoes-cache.json?_=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Falha ao carregar cotações.");
  return r.json();
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE    = 50;
const INITIAL_ROWS = 15;

const SHEET_LABELS: Record<string, string> = {
  "FLANGES":        "Flanges",
  "TUBULARES":      "Tubulares",
  "FORJADINHOS":    "Forjadinhos",
  "JUNTA ANEL":     "Junta Anel",
  "JUNTA ESPIRAL":  "Junta Espiral",
  "FIGURA 8 / RAQ": "Figura 8 / RAQ",
  "PARAFUSO":       "Parafuso",
  "GERAL":          "Geral",
  "PETROBRAS":      "Petrobras",
};

const SHEET_ORDER = [
  "FLANGES","TUBULARES","FORJADINHOS","JUNTA ANEL",
  "JUNTA ESPIRAL","FIGURA 8 / RAQ","PARAFUSO","GERAL","PETROBRAS",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const fmtPreco = (v: number | null | undefined) =>
  v != null
    ? `$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const parts = d.split("-").map(Number);
  if (parts.length >= 3) return new Date(parts[0], parts[1] - 1, parts[2]);
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

function getBest(r: CotacaoRow) {
  const bestPreco = r.menorPreco ??
    (r.fornecedores.length > 0
      ? (r.fornecedores.filter((f) => f.preco != null).sort((a, b) => (a.preco! - b.preco!))[0]?.preco ?? null)
      : null);
  const bestForn = r.fornecedorMenorPreco ??
    (r.fornecedores.find((f) => f.preco === bestPreco)?.nome ?? null);
  return { bestPreco, bestForn };
}

// ── Searchable MultiSelect ────────────────────────────────────────────────────
function MultiSelect({
  options, value, onChange, placeholder, maxWidth = "w-[150px]", searchable = false,
}: {
  options: string[]; value: string[]; onChange: (v: string[]) => void;
  placeholder: string; maxWidth?: string; searchable?: boolean;
}) {
  const [open, setOpen]   = useState(false);
  const [q, setQ]         = useState("");
  const ref               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQ(""); }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  const label  = value.length === 0 ? placeholder : value.length === 1 ? value[0] : `${value.length} selecionados`;
  const visible = searchable && q ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options;

  return (
    <div ref={ref} className={`relative ${maxWidth}`}>
      <button type="button" onClick={() => { setOpen((o) => !o); setQ(""); }}
        className={`flex h-9 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors hover:bg-accent/30 focus:outline-none ${value.length > 0 ? "border-primary/60 text-foreground" : "text-muted-foreground"}`}>
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}/>
      </button>

      {open && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 min-w-full w-max max-w-[280px] max-h-72 flex flex-col rounded-md border bg-popover shadow-md">
          {searchable && (
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground"/>
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Pesquisar..."
                  className="w-full h-7 pl-6 pr-2 text-xs bg-muted/40 rounded border border-input focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          )}
          <div className="overflow-y-auto flex-1 p-1">
            {visible.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-3 text-center">Nenhum resultado</p>
            ) : visible.map((o) => (
              <div key={o} onClick={() => toggle(o)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent select-none">
                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${value.includes(o) ? "bg-primary border-primary text-primary-foreground" : "border-input"}`}>
                  {value.includes(o) && <Check className="h-3 w-3"/>}
                </div>
                <span className="truncate">{o}</span>
              </div>
            ))}
          </div>
          {value.length > 0 && (
            <div onClick={() => { onChange([]); setQ(""); }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-accent text-muted-foreground border-t shrink-0">
              <X className="h-3 w-3"/> Limpar seleção
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function CotacaoDetail({ row, onClose }: { row: CotacaoRow; onClose: () => void }) {
  const { bestPreco, bestForn } = getBest(row);

  const field = (label: string, value: string | number | null | undefined) => (
    value != null && value !== "" && value !== "—" ? (
      <div className="space-y-0.5">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium">{String(value)}</p>
      </div>
    ) : null
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs font-semibold">
              {SHEET_LABELS[row.sheet] ?? row.sheet}
            </Badge>
            <span className="font-mono text-base">{row.codigo ?? row.rfq ?? "—"}</span>
            {row.dataCotacao && (
              <span className="text-sm text-muted-foreground font-normal">{fmtDate(row.dataCotacao)}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Product name */}
          {row.product && (
            <div className="bg-muted/30 rounded-lg px-4 py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Produto</p>
              <p className="text-base font-semibold">{row.product}</p>
            </div>
          )}

          {/* Two-column grid: specs + client */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {field("Código", row.codigo)}
            {field("RFQ", row.rfq)}
            {field("Cliente", row.cliente)}
            {field("PI", row.pi)}
            {field("OP", row.op)}
            {field("Tipo Material", row.tipoMaterial)}
            {field("DN", row.dn)}
            {field("Classe", row.classe)}
            {field("SCH / THK", row.sch)}
            {field("Material", row.material)}
            {field("Quantidade", row.qty)}
            {field("Data Cotação", fmtDate(row.dataCotacao))}
          </div>

          {/* Observações */}
          {row.obs && (
            <div className="bg-muted/20 rounded-md px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Obs: </span>{row.obs}
            </div>
          )}

          {/* Fornecedores table */}
          {row.fornecedores.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Fornecedores</p>
              <div className="rounded-md border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">Fornecedor</TableHead>
                      <TableHead className="text-xs text-right">Preço</TableHead>
                      <TableHead className="text-xs">Data Receb.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {row.fornecedores.map((f, i) => (
                      <TableRow key={i} className={`text-sm ${f.nome === bestForn ? "bg-emerald-500/5" : ""}`}>
                        <TableCell className="font-medium">
                          {f.nome}
                          {f.nome === bestForn && bestPreco != null && (
                            <Badge className="ml-2 bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                              Menor preço
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${f.nome === bestForn ? "text-emerald-400" : ""}`}>
                          {fmtPreco(f.preco)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{fmtDate(f.data)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {bestPreco != null && (
                <div className="mt-2 flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-md px-4 py-2.5">
                  <span className="text-sm font-medium">Menor Preço — {bestForn ?? "—"}</span>
                  <span className="text-lg font-bold text-emerald-400">{fmtPreco(bestPreco)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Upload Panel ──────────────────────────────────────────────────────────────
function UploadPanel({ onClose, onSuccess }: { onClose: () => void; onSuccess: (rows: CotacaoRow[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handle(file: File) {
    setUploading(true);
    setMsg("Lendo arquivo...");
    try {
      const rows = await parseCotacoesExcel(file);
      setMsg(`${rows.length} cotações lidas. Sincronizando...`);
      await uploadJson(SYNC_FILE, rows);
      onSuccess(rows);
      toast.success(`Cotações atualizadas: ${rows.length} registros`);
      onClose();
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Erro desconhecido";
      setMsg(`Erro: ${m}`);
      toast.error(m);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="border-primary/30 bg-card shadow-md">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary"/>
            <span className="font-semibold text-sm">Atualizar Planilha de Cotações</span>
          </div>
          <button onClick={onClose} disabled={uploading} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4"/>
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Selecione o arquivo <strong>Cadastro de cotações</strong> (.xlsx). As abas FLANGES, TUBULARES, FORJADINHOS, JUNTA ANEL, JUNTA ESPIRAL, FIGURA 8 / RAQ, PARAFUSO, GERAL e PETROBRAS serão importadas.
        </p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = ""; }}
        />
        <div onClick={() => !uploading && fileRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${uploading ? "opacity-60 cursor-not-allowed border-border/30" : "border-border/50 hover:border-primary/50"}`}>
          {uploading
            ? <Loader2 className="h-7 w-7 mx-auto mb-1.5 text-muted-foreground animate-spin"/>
            : <Upload className="h-7 w-7 mx-auto mb-1.5 text-muted-foreground"/>}
          <p className="text-sm font-medium">{uploading ? "Processando..." : "Clique para selecionar o arquivo .xlsx"}</p>
        </div>
        {!uploading && (
          <Button size="sm" className="w-full mt-2" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2"/> Selecionar arquivo Excel
          </Button>
        )}
        {msg && (
          <p className={`mt-2 text-xs rounded px-3 py-2 ${msg.startsWith("Erro") ? "bg-red-500/10 text-red-400" : "bg-muted/60 text-muted-foreground"}`}>
            {uploading && !msg.startsWith("Erro") && <Loader2 className="inline h-3 w-3 mr-1 animate-spin"/>}
            {msg}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main CotacoesTab ──────────────────────────────────────────────────────────
export function CotacoesTab() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["cotacoes"],
    queryFn: fetchCotacoes,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  const rows = data ?? [];

  const [showUpload,    setShowUpload]    = useState(false);
  const [selectedRow,   setSelectedRow]   = useState<CotacaoRow | null>(null);
  const [search,        setSearch]        = useState("");
  const [filterSheet,   setFilterSheet]   = useState<string[]>([]);
  const [filterCliente, setFilterCliente] = useState<string[]>([]);
  const [filterTipo,    setFilterTipo]    = useState<string[]>([]);
  const [filterDN,      setFilterDN]      = useState<string[]>([]);
  const [filterMaterial,setFilterMaterial]= useState<string[]>([]);
  const [filterYear,    setFilterYear]    = useState<string[]>([]);
  const [showAll,       setShowAll]       = useState(false);
  const [page,          setPage]          = useState(1);

  function handleUploadSuccess(newRows: CotacaoRow[]) {
    qc.setQueryData(["cotacoes"], newRows);
  }

  // Dropdown options (always from full rows)
  const sheetOptions   = SHEET_ORDER.filter((s) => rows.some((r) => r.sheet === s));
  const clienteOpts    = useMemo(() => Array.from(new Set(rows.map((r) => r.cliente).filter(Boolean))).sort() as string[], [rows]);
  const tipoOpts       = useMemo(() => Array.from(new Set(rows.map((r) => r.tipoMaterial).filter(Boolean))).sort() as string[], [rows]);
  const yearOpts       = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { const d = parseDate(r.dataCotacao); if (d) s.add(String(d.getFullYear())); });
    return Array.from(s).sort().reverse();
  }, [rows]);
  const dnOpts         = useMemo(() => Array.from(new Set(rows.map((r) => r.dn).filter(Boolean))).sort((a, b) => {
    // Sort numerically by extracting the first number
    const na = parseFloat((a as string).replace(/[^\d.]/g, "")) || 0;
    const nb = parseFloat((b as string).replace(/[^\d.]/g, "")) || 0;
    return na - nb;
  }) as string[], [rows]);
  const materialOpts   = useMemo(() => Array.from(new Set(rows.map((r) => r.material).filter(Boolean))).sort() as string[], [rows]);

  const anyFilter = !!(search || filterSheet.length || filterCliente.length || filterTipo.length || filterDN.length || filterMaterial.length || filterYear.length);
  const reset = () => {
    setSearch(""); setFilterSheet([]); setFilterCliente([]); setFilterTipo([]);
    setFilterDN([]); setFilterMaterial([]); setFilterYear([]); setShowAll(false); setPage(1);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (filterSheet.length    && !filterSheet.includes(r.sheet))                  return false;
      if (filterCliente.length  && !filterCliente.includes(r.cliente ?? ""))        return false;
      if (filterTipo.length     && !filterTipo.includes(r.tipoMaterial ?? ""))      return false;
      if (filterDN.length       && !filterDN.includes(r.dn ?? ""))                  return false;
      if (filterMaterial.length && !filterMaterial.includes(r.material ?? ""))      return false;
      if (filterYear.length) {
        const d = parseDate(r.dataCotacao);
        if (!d || !filterYear.includes(String(d.getFullYear()))) return false;
      }
      if (q && !`${r.rfq} ${r.codigo} ${r.product} ${r.cliente} ${r.dn} ${r.material} ${r.classe}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, filterSheet, filterCliente, filterTipo, filterDN, filterMaterial, filterYear]);

  const cf = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setShowAll(false); setPage(1); };

  // Summary stats
  const totalForn    = useMemo(() => new Set(rows.flatMap((r) => r.fornecedores.map((f) => f.nome))).size, [rows]);
  const comPreco     = useMemo(() => rows.filter((r) => r.menorPreco != null || r.fornecedores.some((f) => f.preco != null)).length, [rows]);
  const countBySheet = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => { m[r.sheet] = (m[r.sheet] ?? 0) + 1; });
    return m;
  }, [rows]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const displayed  = showAll
    ? filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : filtered.slice(0, INITIAL_ROWS);

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin"/><span>Carregando cotações...</span>
    </div>
  );
  if (error) return <div className="text-center py-20 text-red-400">Erro ao carregar cotações.</div>;

  return (
    <div className="space-y-5">
      {/* Detail modal */}
      {selectedRow && <CotacaoDetail row={selectedRow} onClose={() => setSelectedRow(null)}/>}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Cotações de Materiais</h2>
          <p className="text-sm text-muted-foreground">{rows.length.toLocaleString("pt-BR")} cotações importadas de 9 planilhas</p>
        </div>
        <Button variant={showUpload ? "secondary" : "outline"} size="sm" className="gap-2"
          onClick={() => setShowUpload((v) => !v)}>
          {showUpload ? <X className="h-4 w-4"/> : <RefreshCw className="h-4 w-4"/>}
          {showUpload ? "Fechar" : "Atualizar Planilha"}
        </Button>
      </div>

      {/* Upload panel */}
      {showUpload && <UploadPanel onClose={() => setShowUpload(false)} onSuccess={handleUploadSuccess}/>}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/50"><CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground mb-1">Total Cotações</p>
          <p className="text-2xl font-bold text-primary">{rows.length.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{filtered.length.toLocaleString("pt-BR")} exibidas</p>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Fornecedores</p>
              <p className="text-2xl font-bold">{totalForn}</p>
              <p className="text-xs text-muted-foreground mt-0.5">únicos</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/40"><Users className="h-4 w-4 text-muted-foreground"/></div>
          </div>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Com Preço</p>
              <p className="text-2xl font-bold text-emerald-400">{comPreco.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">cotações com valor</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/40"><Tag className="h-4 w-4 text-muted-foreground"/></div>
          </div>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tipos de Material</p>
              <p className="text-2xl font-bold">{sheetOptions.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">categorias</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/40"><FileText className="h-4 w-4 text-muted-foreground"/></div>
          </div>
        </CardContent></Card>
      </div>

      {/* Sheet pill filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setFilterSheet([]); setShowAll(false); setPage(1); }}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${filterSheet.length === 0 ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-transparent hover:border-border"}`}
        >
          Todos <span className="ml-1 text-[10px]">{rows.length.toLocaleString("pt-BR")}</span>
        </button>
        {sheetOptions.map((s) => (
          <button key={s}
            onClick={() => { setFilterSheet([s]); setShowAll(false); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${filterSheet.length === 1 && filterSheet[0] === s ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-transparent hover:border-border"}`}
          >
            {SHEET_LABELS[s] ?? s} <span className="ml-1 text-[10px]">{countBySheet[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Filter row 1: search + cliente + tipo + ano */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
          <Input placeholder="Buscar RFQ, código, produto, DN, material..."
            value={search} onChange={(e) => { setSearch(e.target.value); setShowAll(false); setPage(1); }}
            className="pl-8 h-9 text-sm"/>
        </div>
        <MultiSelect options={clienteOpts} value={filterCliente} onChange={cf(setFilterCliente)}
          placeholder="Cliente" maxWidth="w-[150px]" searchable={clienteOpts.length > 10}/>
        <MultiSelect options={tipoOpts} value={filterTipo} onChange={cf(setFilterTipo)}
          placeholder="Tipo Material" maxWidth="w-[145px]"/>
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0"/>
          <MultiSelect options={yearOpts} value={filterYear} onChange={cf(setFilterYear)}
            placeholder="Ano" maxWidth="w-[110px]"/>
        </div>
      </div>

      {/* Filter row 2: DN + material + clear */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5">
          <Ruler className="h-4 w-4 text-muted-foreground shrink-0"/>
          <MultiSelect options={dnOpts} value={filterDN} onChange={cf(setFilterDN)}
            placeholder="DN" maxWidth="w-[120px]" searchable={dnOpts.length > 10}/>
        </div>
        <div className="flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-muted-foreground shrink-0"/>
          <MultiSelect options={materialOpts} value={filterMaterial} onChange={cf(setFilterMaterial)}
            placeholder="Material" maxWidth="w-[155px]" searchable={materialOpts.length > 10}/>
        </div>
        {anyFilter && <Button variant="ghost" size="sm" className="h-9" onClick={reset}>Limpar tudo</Button>}
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length.toLocaleString("pt-BR")} registros encontrados{filtered.length !== rows.length && ` (de ${rows.length.toLocaleString("pt-BR")} total)`}
        {!showAll && filtered.length > INITIAL_ROWS && ` — exibindo os primeiros ${INITIAL_ROWS}`}
        {" "}<span className="opacity-60">· clique em uma linha para ver detalhes</span>
      </p>

      {/* Table */}
      <div className="rounded-md border border-border/50 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs w-[90px]">Tipo</TableHead>
              <TableHead className="text-xs w-[100px]">Data</TableHead>
              <TableHead className="text-xs">RFQ</TableHead>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs">Código</TableHead>
              <TableHead className="text-xs">Produto</TableHead>
              <TableHead className="text-xs">DN</TableHead>
              <TableHead className="text-xs">Classe</TableHead>
              <TableHead className="text-xs">Material</TableHead>
              <TableHead className="text-xs text-center">Qtd</TableHead>
              <TableHead className="text-xs">Fornecedores</TableHead>
              <TableHead className="text-xs text-right">Menor Preço</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.length === 0 ? (
              <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-10">Nenhum registro encontrado</TableCell></TableRow>
            ) : displayed.map((r, i) => {
              const { bestPreco, bestForn } = getBest(r);
              return (
                <TableRow key={i}
                  className="text-xs hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => setSelectedRow(r)}
                >
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-medium whitespace-nowrap">
                      {SHEET_LABELS[r.sheet] ?? r.sheet}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(r.dataCotacao)}</TableCell>
                  <TableCell className="font-mono max-w-[120px] truncate" title={r.rfq ?? undefined}>{r.rfq ?? "—"}</TableCell>
                  <TableCell className="max-w-[120px] truncate" title={r.cliente ?? undefined}>{r.cliente ?? "—"}</TableCell>
                  <TableCell className="font-mono max-w-[110px] truncate" title={r.codigo ?? undefined}>{r.codigo ?? "—"}</TableCell>
                  <TableCell className="max-w-[160px] truncate" title={r.product ?? undefined}>{r.product ?? "—"}</TableCell>
                  <TableCell className="font-mono">{r.dn ?? "—"}</TableCell>
                  <TableCell>{r.classe ?? "—"}</TableCell>
                  <TableCell className="max-w-[110px] truncate text-muted-foreground" title={r.material ?? undefined}>{r.material ?? "—"}</TableCell>
                  <TableCell className="text-center">{r.qty != null ? r.qty : "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {r.fornecedores.length === 0
                        ? <span className="text-muted-foreground">—</span>
                        : r.fornecedores.slice(0, 3).map((f, fi) => (
                          <span key={fi}
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${f.nome === bestForn ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-muted text-muted-foreground"}`}>
                            {f.nome}
                            {f.preco != null && <span className="ml-1 opacity-70">{fmtPreco(f.preco)}</span>}
                          </span>
                        ))
                      }
                      {r.fornecedores.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{r.fornecedores.length - 3}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-emerald-400">{fmtPreco(bestPreco)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Expand / pagination */}
      {!showAll && filtered.length > INITIAL_ROWS && (
        <button onClick={() => setShowAll(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border border-dashed border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors">
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
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-3 w-3"/></Button>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-3 w-3"/></Button>
              </div>
            </div>
          )}
          <button onClick={() => { setShowAll(false); setPage(1); }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors">
            <ChevronUp className="h-3.5 w-3.5"/> Recolher
          </button>
        </div>
      )}
    </div>
  );
}
