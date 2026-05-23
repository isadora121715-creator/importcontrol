import { useMemo, useState } from "react";
import {
  Ship, Package, DollarSign, CheckCircle2, XCircle,
  Search, Filter, TrendingUp, TrendingDown, Minus,
  Upload, RefreshCw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { HeaderTabs } from "@/components/HeaderTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FreteRow {
  agente?: string;
  data?: string;
  exportador?: string;
  po?: string;
  modalidade?: string;
  cntr?: string;
  cont20?: number;
  cont40?: number;
  cont45?: number;
  contFlatRack?: number;
  kg?: number;
  origem?: string;
  destino?: string;
  tipo?: string;
  material?: string;
  moedaPo?: string;
  valorPo?: number;
  tarifaInicial?: number;
  tarifaFinal?: number;
  diferencaTarifa?: number;
  freteTotalInicial?: number;
  dataFreteInicial?: string;
  freteTotalFinal?: number;
  dataRevisaoFinal?: string;
  diferencaFreteTotal?: number;
  taxasOrigemInicial?: number;
  taxasOrigemFinal?: number;
  taxasDestinoInicial?: number;
  taxasDestinoFinal?: number;
  taxasDestinoBrlInicial?: number;
  taxasDestinoBrlFinal?: number;
  custoTotalInicial?: number;
  custoTotalFinal?: number;
  percentAumento?: number;
  embarcou?: string;
  obs?: string;
  atualizacaoData?: string;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchFrete(): Promise<FreteRow[]> {
  const resp = await fetch("/data/frete-cache.json");
  if (!resp.ok) throw new Error("Erro ao carregar cotações de frete.");
  const data: FreteRow[] = await resp.json();
  return Array.isArray(data) ? data : [];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(v: number | undefined, symbol = "USD") {
  if (v == null) return "–";
  return `${symbol} ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtNum(v: number | undefined) {
  if (v == null) return "–";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(v: number | undefined) {
  if (v == null) return "–";
  const pct = v * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function normalizeEmbarcou(v: string | undefined): "SIM" | "NÃO" | "JÁ CHEGOU" | "–" {
  if (!v) return "–";
  const u = v.toUpperCase().trim();
  if (u === "SIM") return "SIM";
  if (u.includes("CHEGOU")) return "JÁ CHEGOU";
  if (u === "NÃO" || u === "NAO") return "NÃO";
  return u as "SIM";
}

const EMBARCOU_BADGE: Record<string, string> = {
  "SIM":      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "NÃO":      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "JÁ CHEGOU":"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "–":        "bg-muted text-muted-foreground",
};

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ rows }: { rows: FreteRow[] }) {
  const total = rows.length;
  const embarcados = rows.filter(r => {
    const e = normalizeEmbarcou(r.embarcou);
    return e === "SIM" || e === "JÁ CHEGOU";
  }).length;
  const naoEmbarcados = rows.filter(r => normalizeEmbarcou(r.embarcou) === "NÃO").length;
  const totalFreteFinal = rows.reduce((s, r) => s + (r.freteTotalFinal ?? r.freteTotalInicial ?? 0), 0);
  const totalCustoFinal = rows.reduce((s, r) => s + (r.custoTotalFinal ?? r.custoTotalInicial ?? 0), 0);

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Ship className="h-4 w-4" /> Cotações
          </div>
          <div className="text-2xl font-bold">{total}</div>
          <div className="text-xs text-muted-foreground">registros</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" /> Embarcados
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{embarcados}</div>
          <div className="text-xs text-muted-foreground">{naoEmbarcados} aguardando</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <DollarSign className="h-4 w-4" /> Frete Total Final
          </div>
          <div className="text-2xl font-bold">{fmtCurrency(totalFreteFinal)}</div>
          <div className="text-xs text-muted-foreground">soma dos fretes</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Package className="h-4 w-4" /> Custo Total Final
          </div>
          <div className="text-2xl font-bold">{fmtCurrency(totalCustoFinal)}</div>
          <div className="text-xs text-muted-foreground">frete + taxas</div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Diff Badge ───────────────────────────────────────────────────────────────

function DiffBadge({ value }: { value: number | undefined }) {
  if (value == null) return <span className="text-muted-foreground">–</span>;
  if (value === 0) return (
    <span className="inline-flex items-center gap-0.5 text-muted-foreground text-xs">
      <Minus className="h-3 w-3" /> 0
    </span>
  );
  if (value > 0) return (
    <span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400 text-xs font-medium">
      <TrendingUp className="h-3 w-3" /> +{fmtNum(value)}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400 text-xs font-medium">
      <TrendingDown className="h-3 w-3" /> {fmtNum(value)}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function Frete() {
  const { data = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["frete"],
    queryFn: fetchFrete,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const [search, setSearch]           = useState("");
  const [agente, setAgente]           = useState("all");
  const [tipo, setTipo]               = useState("all");
  const [modalidade, setModalidade]   = useState("all");
  const [embarcouF, setEmbarcouF]     = useState("all");
  const [page, setPage]               = useState(1);

  // Filter options
  const agentes    = useMemo(() => [...new Set(data.map(r => r.agente).filter(Boolean))].sort() as string[], [data]);
  const tipos      = useMemo(() => [...new Set(data.map(r => r.tipo).filter(Boolean))].sort() as string[], [data]);
  const modalidades= useMemo(() => [...new Set(data.map(r => r.modalidade).filter(Boolean))].sort() as string[], [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(r => {
      if (agente    !== "all" && r.agente    !== agente)    return false;
      if (tipo      !== "all" && r.tipo      !== tipo)      return false;
      if (modalidade!== "all" && r.modalidade!== modalidade)return false;
      if (embarcouF !== "all" && normalizeEmbarcou(r.embarcou) !== embarcouF) return false;
      if (q) {
        const haystack = [r.po, r.exportador, r.origem, r.material, r.obs, r.cntr]
          .filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, agente, tipo, modalidade, embarcouF]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetFilters() {
    setSearch(""); setAgente("all"); setTipo("all");
    setModalidade("all"); setEmbarcouF("all"); setPage(1);
  }

  const hasFilters = search || agente !== "all" || tipo !== "all" || modalidade !== "all" || embarcouF !== "all";

  return (
    <div className="min-h-screen bg-background">
      <HeaderTabs />
      <main className="mx-auto max-w-[1600px] px-4 py-6 space-y-6">

        {/* Title row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Ship className="h-5 w-5 text-primary" /> Cotações de Frete
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isLoading ? "Carregando..." : `${data.length} registros · ${filtered.length} filtrados`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4 mr-1", isFetching && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        {/* Summary */}
        {!isLoading && !isError && <SummaryCards rows={filtered} />}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar P.O., exportador, origem..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 h-9"
            />
          </div>

          <Select value={agente} onValueChange={v => { setAgente(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="Agente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos agentes</SelectItem>
              {agentes.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={tipo} onValueChange={v => { setTipo(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              {tipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={modalidade} onValueChange={v => { setModalidade(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue placeholder="Modal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">FCL / LCL</SelectItem>
              {modalidades.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={embarcouF} onValueChange={v => { setEmbarcouF(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="Embarcou?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="SIM">Sim</SelectItem>
              <SelectItem value="NÃO">Não embarcou</SelectItem>
              <SelectItem value="JÁ CHEGOU">Já chegou</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-muted-foreground">
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" /> Carregando cotações...
          </div>
        )}

        {/* Error */}
        {isError && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6 text-center text-destructive">
              Erro ao carregar os dados. <Button variant="link" className="p-0 h-auto" onClick={() => refetch()}>Tentar novamente</Button>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        {!isLoading && !isError && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Data</th>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Agente</th>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Exportador</th>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">P.O.</th>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Tipo</th>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Modal</th>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">CNTR</th>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Origem</th>
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Tarifa Ini.</th>
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Tarifa Final</th>
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Frete Final</th>
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Custo Total</th>
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">% Variação</th>
                      <th className="text-center px-3 py-2 font-medium whitespace-nowrap">Embarcou?</th>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="text-center py-12 text-muted-foreground">
                          Nenhum registro encontrado.
                        </td>
                      </tr>
                    ) : paginated.map((r, i) => {
                      const emb = normalizeEmbarcou(r.embarcou);
                      const pct = r.percentAumento;
                      return (
                        <tr
                          key={i}
                          className={cn(
                            "border-b transition-colors hover:bg-muted/30",
                            i % 2 === 0 ? "" : "bg-muted/10"
                          )}
                        >
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.data ?? "–"}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-medium">{r.agente ?? "–"}</td>
                          <td className="px-3 py-2 whitespace-nowrap max-w-[140px] truncate" title={r.exportador}>{r.exportador ?? "–"}</td>
                          <td className="px-3 py-2 whitespace-nowrap max-w-[160px] truncate text-xs" title={r.po}>{r.po ?? "–"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-muted font-medium">{r.tipo ?? "–"}</span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={cn(
                              "inline-block text-xs px-1.5 py-0.5 rounded font-medium",
                              r.modalidade === "FCL"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            )}>
                              {r.modalidade ?? "–"}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">{r.cntr ?? "–"}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground max-w-[130px] truncate" title={r.origem}>{r.origem ?? "–"}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{r.tarifaInicial != null ? fmtNum(r.tarifaInicial) : "–"}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums font-medium">{r.tarifaFinal != null ? fmtNum(r.tarifaFinal) : "–"}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums font-medium">{fmtCurrency(r.freteTotalFinal ?? r.freteTotalInicial)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums font-medium">{fmtCurrency(r.custoTotalFinal ?? r.custoTotalInicial)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {pct != null ? (
                              <span className={cn(
                                "text-xs font-medium",
                                pct > 0 ? "text-red-600 dark:text-red-400" :
                                pct < 0 ? "text-green-600 dark:text-green-400" :
                                "text-muted-foreground"
                              )}>
                                {fmtPct(pct)}
                              </span>
                            ) : "–"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={cn("inline-block text-xs px-2 py-0.5 rounded-full font-medium", EMBARCOU_BADGE[emb])}>
                              {emb}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground max-w-[180px] truncate" title={r.obs}>{r.obs ?? "–"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                  <span>
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
