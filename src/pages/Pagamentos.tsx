import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HeaderTabs } from "@/components/HeaderTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type MaterialRow = {
  pgto: string | null;
  dataEnvioFinanceiro: string | null;
  banco: string | null;
  tipo: string | null;
  payment: string | null;
  company: string | null;
  exporter: string | null;
  po: string | null;
  pe: string | null;
  moeda: string | null;
  valor: number | null;
  lancamentoSistema: number | null;
  reais: number | null;
  primeiroVencimento: string | null;
  vencAlterado: string | null;
  cliente: string | null;
  dataPagto: string | null;
  modal: string | null;
  etd: string | null;
  eta: string | null;
  status: string | null;
};

type DesembaracoRow = {
  pagto: string | null;
  tipo: string | null;
  paisOrigem: string | null;
  chegadaPorto: string | null;
  modalidade: string | null;
  empresa: string | null;
  exportador: string | null;
  po: string | null;
  pe: string | null;
  moeda: string | null;
  valor: number | null;
  fator: number | null;
  lancamentoSistema: number | null;
  reais: number | null;
  vencimento: string | null;
  vencAlterado: string | null;
  prevImpostos: number | null;
  cliente: string | null;
  dataPagto: string | null;
  status: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtBRL = (v: number | null | undefined) =>
  v != null
    ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

const fmtFX = (v: number | null | undefined, moeda: string | null | undefined) =>
  v != null ? `${moeda ?? ""} ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

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
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

function isOverdue(d: string | null | undefined) {
  const dt = parseDate(d);
  return dt ? dt < today : false;
}

function isDueSoon(d: string | null | undefined) {
  const dt = parseDate(d);
  return dt ? dt >= today && dt <= in30 : false;
}

function statusBadge(s: string | null) {
  const v = (s ?? "PENDENTE").toUpperCase();
  if (v === "PAGO")
    return <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30 text-xs">PAGO</Badge>;
  if (v === "PENDENTE")
    return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30 text-xs">PENDENTE</Badge>;
  if (v === "AGUARDANDO")
    return <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30 text-xs">AGUARDANDO</Badge>;
  if (v === "CANCELADO")
    return <Badge className="bg-red-600/20 text-red-400 border-red-600/30 text-xs">CANCELADO</Badge>;
  if (v.includes("EXCLU"))
    return <Badge className="bg-zinc-600/20 text-zinc-400 border-zinc-600/30 text-xs">EXCLUÍDO</Badge>;
  return <Badge variant="outline" className="text-xs">{v}</Badge>;
}

function vencBadge(d: string | null | undefined, status: string | null) {
  if ((status ?? "").toUpperCase() === "PAGO") return fmtDate(d);
  if (isOverdue(d))
    return <span className="text-red-400 font-semibold">{fmtDate(d)}</span>;
  if (isDueSoon(d))
    return <span className="text-yellow-400 font-semibold">{fmtDate(d)}</span>;
  return fmtDate(d);
}

const PAGE_SIZE = 50;

// ── Data fetching ─────────────────────────────────────────────────────────────
async function fetchMaterial(): Promise<MaterialRow[]> {
  const r = await fetch(`/data/pagamentos-material-cache.json?_=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Erro ao carregar dados de material");
  return r.json();
}

async function fetchDesembaraco(): Promise<DesembaracoRow[]> {
  const r = await fetch(`/data/pagamentos-desembaraco-cache.json?_=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Erro ao carregar dados de desembaraço");
  return r.json();
}

// ── Summary cards ─────────────────────────────────────────────────────────────
function SummaryCard({
  icon,
  title,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  sub?: string;
  color: string;
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
          <div className={`p-2 rounded-lg ${color.replace("text-", "bg-").replace("-400", "-500/10").replace("-600", "-500/10")}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Material Tab ──────────────────────────────────────────────────────────────
function MaterialTab({ rows }: { rows: MaterialRow[] }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterExporter, setFilterExporter] = useState("all");
  const [page, setPage] = useState(1);

  const pendentes = useMemo(() => rows.filter((r) => r.pgto === "PENDENTE"), [rows]);
  const vencidos = useMemo(() => pendentes.filter((r) => isOverdue(r.vencAlterado ?? r.primeiroVencimento)), [pendentes]);
  const aSoon = useMemo(() => pendentes.filter((r) => isDueSoon(r.vencAlterado ?? r.primeiroVencimento)), [pendentes]);
  const totalPendente = useMemo(() => pendentes.reduce((s, r) => s + (r.reais ?? 0), 0), [pendentes]);
  const totalVencido = useMemo(() => vencidos.reduce((s, r) => s + (r.reais ?? 0), 0), [vencidos]);

  const companies = useMemo(() => ["all", ...Array.from(new Set(rows.map((r) => r.company).filter(Boolean))).sort()], [rows]);
  const exporters = useMemo(() => ["all", ...Array.from(new Set(rows.map((r) => r.exporter).filter(Boolean))).sort()], [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (filterStatus !== "all" && r.pgto !== filterStatus) return false;
      if (filterCompany !== "all" && r.company !== filterCompany) return false;
      if (filterExporter !== "all" && r.exporter !== filterExporter) return false;
      if (q && !`${r.po} ${r.exporter} ${r.cliente} ${r.pe} ${r.payment}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, filterStatus, filterCompany, filterExporter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Clock className="h-4 w-4 text-yellow-400" />}
          title="Pendentes"
          value={fmtBRL(totalPendente)}
          sub={`${pendentes.length} pagamentos`}
          color="text-yellow-400"
        />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
          title="Vencidos"
          value={fmtBRL(totalVencido)}
          sub={`${vencidos.length} pagamentos`}
          color="text-red-400"
        />
        <SummaryCard
          icon={<DollarSign className="h-4 w-4 text-orange-400" />}
          title="Vence em 30 dias"
          value={fmtBRL(aSoon.reduce((s, r) => s + (r.reais ?? 0), 0))}
          sub={`${aSoon.length} pagamentos`}
          color="text-orange-400"
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          title="Total registros"
          value={rows.length.toLocaleString("pt-BR")}
          sub={`${rows.filter((r) => r.pgto === "PAGO").length} pagos`}
          color="text-emerald-400"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar PO, exportador, cliente..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[140px] text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="PENDENTE">Pendente</SelectItem>
            <SelectItem value="PAGO">Pago</SelectItem>
            <SelectItem value="CANCELADO">Cancelado</SelectItem>
            <SelectItem value="EXCLUÍDO">Excluído</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCompany} onValueChange={(v) => { setFilterCompany(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            {companies.map((c) => <SelectItem key={c} value={c}>{c === "all" ? "Todas empresas" : c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterExporter} onValueChange={(v) => { setFilterExporter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[160px] text-sm"><SelectValue placeholder="Exportador" /></SelectTrigger>
          <SelectContent>
            {exporters.map((e) => <SelectItem key={e} value={e}>{e === "all" ? "Todos exportadores" : e}</SelectItem>)}
          </SelectContent>
        </Select>
        {(search || filterStatus !== "all" || filterCompany !== "all" || filterExporter !== "all") && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setSearch(""); setFilterStatus("all"); setFilterCompany("all"); setFilterExporter("all"); setPage(1); }}>
            Limpar
          </Button>
        )}
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length.toLocaleString("pt-BR")} registros encontrados
        {filtered.length !== rows.length && ` (de ${rows.length.toLocaleString("pt-BR")} total)`}
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
            {paged.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
            ) : (
              paged.map((r, i) => (
                <TableRow key={i} className="text-xs hover:bg-muted/30">
                  <TableCell>{statusBadge(r.pgto)}</TableCell>
                  <TableCell className="font-mono">{r.po ?? "—"}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{r.pe ?? "—"}</TableCell>
                  <TableCell>{r.exporter ?? "—"}</TableCell>
                  <TableCell>{r.company ?? "—"}</TableCell>
                  <TableCell className="max-w-[160px] truncate" title={r.payment ?? undefined}>{r.payment ?? "—"}</TableCell>
                  <TableCell>{fmtFX(r.valor, r.moeda)}</TableCell>
                  <TableCell className="text-right font-medium">{fmtBRL(r.reais)}</TableCell>
                  <TableCell>{vencBadge(r.vencAlterado ?? r.primeiroVencimento, r.pgto)}</TableCell>
                  <TableCell>{fmtDate(r.dataPagto)}</TableCell>
                  <TableCell className="max-w-[140px] truncate text-muted-foreground" title={r.cliente ?? undefined}>{r.cliente ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-3 w-3" /></Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-3 w-3" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Desembaraço Tab ───────────────────────────────────────────────────────────
function DesembaracoTab({ rows }: { rows: DesembaracoRow[] }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEmpresa, setFilterEmpresa] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [page, setPage] = useState(1);

  const pendentes = useMemo(() => rows.filter((r) => r.pagto === "PENDENTE" || r.pagto === "AGUARDANDO"), [rows]);
  const vencidos = useMemo(() => pendentes.filter((r) => isOverdue(r.vencAlterado ?? r.vencimento)), [pendentes]);
  const aSoon = useMemo(() => pendentes.filter((r) => isDueSoon(r.vencAlterado ?? r.vencimento)), [pendentes]);
  const totalPendente = useMemo(() => pendentes.reduce((s, r) => s + (r.reais ?? 0), 0), [pendentes]);

  const empresas = useMemo(() => ["all", ...Array.from(new Set(rows.map((r) => r.empresa).filter(Boolean))).sort()], [rows]);
  const tipos = useMemo(() => ["all", ...Array.from(new Set(rows.map((r) => r.tipo).filter(Boolean))).sort()], [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (filterStatus !== "all" && r.pagto !== filterStatus) return false;
      if (filterEmpresa !== "all" && r.empresa !== filterEmpresa) return false;
      if (filterTipo !== "all" && r.tipo !== filterTipo) return false;
      if (q && !`${r.po} ${r.exportador} ${r.cliente} ${r.pe} ${r.modalidade}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, filterStatus, filterEmpresa, filterTipo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Clock className="h-4 w-4 text-yellow-400" />}
          title="Pendentes / Aguardando"
          value={fmtBRL(totalPendente)}
          sub={`${pendentes.length} lançamentos`}
          color="text-yellow-400"
        />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
          title="Vencidos"
          value={fmtBRL(vencidos.reduce((s, r) => s + (r.reais ?? 0), 0))}
          sub={`${vencidos.length} lançamentos`}
          color="text-red-400"
        />
        <SummaryCard
          icon={<DollarSign className="h-4 w-4 text-orange-400" />}
          title="Vence em 30 dias"
          value={fmtBRL(aSoon.reduce((s, r) => s + (r.reais ?? 0), 0))}
          sub={`${aSoon.length} lançamentos`}
          color="text-orange-400"
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          title="Total registros"
          value={rows.length.toLocaleString("pt-BR")}
          sub={`${rows.filter((r) => r.pagto === "PAGO").length} pagos`}
          color="text-emerald-400"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar PO, exportador, cliente..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[140px] text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="PENDENTE">Pendente</SelectItem>
            <SelectItem value="AGUARDANDO">Aguardando</SelectItem>
            <SelectItem value="PAGO">Pago</SelectItem>
            <SelectItem value="CANCELADO">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEmpresa} onValueChange={(v) => { setFilterEmpresa(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            {empresas.map((e) => <SelectItem key={e} value={e}>{e === "all" ? "Todas empresas" : e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            {tipos.map((t) => <SelectItem key={t} value={t}>{t === "all" ? "Todos tipos" : t}</SelectItem>)}
          </SelectContent>
        </Select>
        {(search || filterStatus !== "all" || filterEmpresa !== "all" || filterTipo !== "all") && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setSearch(""); setFilterStatus("all"); setFilterEmpresa("all"); setFilterTipo("all"); setPage(1); }}>
            Limpar
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length.toLocaleString("pt-BR")} registros encontrados
        {filtered.length !== rows.length && ` (de ${rows.length.toLocaleString("pt-BR")} total)`}
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
            {paged.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
            ) : (
              paged.map((r, i) => (
                <TableRow key={i} className="text-xs hover:bg-muted/30">
                  <TableCell>{statusBadge(r.pagto)}</TableCell>
                  <TableCell className="font-mono">{r.po ?? "—"}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{r.pe ?? "—"}</TableCell>
                  <TableCell>{r.exportador ?? "—"}</TableCell>
                  <TableCell>{r.empresa ?? "—"}</TableCell>
                  <TableCell>{r.tipo ?? "—"}</TableCell>
                  <TableCell>{r.modalidade ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{fmtBRL(r.reais)}</TableCell>
                  <TableCell>{vencBadge(r.vencAlterado ?? r.vencimento, r.pagto)}</TableCell>
                  <TableCell>{fmtDate(r.dataPagto)}</TableCell>
                  <TableCell className="max-w-[140px] truncate text-muted-foreground" title={r.cliente ?? undefined}>{r.cliente ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-3 w-3" /></Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-3 w-3" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Pagamentos() {
  const matQuery = useQuery({
    queryKey: ["pagamentos-material"],
    queryFn: fetchMaterial,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const desQuery = useQuery({
    queryKey: ["pagamentos-desembaraco"],
    queryFn: fetchDesembaraco,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const matRows = matQuery.data ?? [];
  const desRows = desQuery.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <HeaderTabs />
      <main className="mx-auto max-w-[1600px] px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Banknote className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Pagamentos &amp; Desembaraço</h1>
            <p className="text-sm text-muted-foreground">FUP de pagamentos de material e custos de importação</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="material" className="w-full">
          <TabsList className="h-9">
            <TabsTrigger value="material" className="gap-2 text-sm">
              <Package className="h-3.5 w-3.5" />
              Material
              {matRows.filter((r) => r.pgto === "PENDENTE").length > 0 && (
                <Badge className="ml-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs px-1.5 py-0">
                  {matRows.filter((r) => r.pgto === "PENDENTE").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="desembaraco" className="gap-2 text-sm">
              <Truck className="h-3.5 w-3.5" />
              Desembaraço
              {desRows.filter((r) => r.pagto === "PENDENTE" || r.pagto === "AGUARDANDO").length > 0 && (
                <Badge className="ml-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs px-1.5 py-0">
                  {desRows.filter((r) => r.pagto === "PENDENTE" || r.pagto === "AGUARDANDO").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="material" className="mt-4">
            {matQuery.isLoading ? (
              <div className="text-center py-16 text-muted-foreground">Carregando...</div>
            ) : matQuery.error ? (
              <div className="text-center py-16 text-red-400">Erro ao carregar dados de material.</div>
            ) : (
              <MaterialTab rows={matRows} />
            )}
          </TabsContent>

          <TabsContent value="desembaraco" className="mt-4">
            {desQuery.isLoading ? (
              <div className="text-center py-16 text-muted-foreground">Carregando...</div>
            ) : desQuery.error ? (
              <div className="text-center py-16 text-red-400">Erro ao carregar dados de desembaraço.</div>
            ) : (
              <DesembaracoTab rows={desRows} />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
