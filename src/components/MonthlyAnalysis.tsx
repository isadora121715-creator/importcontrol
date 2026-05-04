import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, DollarSign, Package, CheckCircle, AlertTriangle, TrendingUp, BarChart3, Search, ArrowUpDown, Clock } from "lucide-react";
import { SalesVsPurchasesChart } from "@/components/SalesVsPurchasesChart";
import { PoDetailModal } from "@/components/monthly/PoDetailModal";
import { MaterialDetailModal } from "@/components/monthly/MaterialDetailModal";
import type { PedidoRow } from "@/lib/parseExcel";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) return new Date(year, month, day);
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isChegou(status: string | null): boolean {
  if (!status) return false;
  return status.toLowerCase().includes("chegou");
}

function formatBRL(v: number | null | undefined) {
  const num = v ?? 0;
  return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUSD(v: number | null | undefined) {
  const num = v ?? 0;
  return `$ ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface MonthlyAnalysisProps {
  data: PedidoRow[];
}

type SortField = "po" | "fornecedor" | "venda" | "compra";
type SortDir = "asc" | "desc";

export function MonthlyAnalysis({ data }: MonthlyAnalysisProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [materialRankBy, setMaterialRankBy] = useState<"qty" | "value">("qty");
  const [poSearch, setPoSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("compra");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [chegouSearch, setChegouSearch] = useState("");
  const [chegouSortField, setChegouSortField] = useState<SortField>("compra");
  const [chegouSortDir, setChegouSortDir] = useState<SortDir>("desc");
  const [selectedPo, setSelectedPo] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);

  // Available months: from dataCompra OR chegadaHci
  const availableMonths = useMemo(() => {
    const monthSet = new Map<string, string>();
    data.forEach((d) => {
      for (const raw of [d.dataCompra, d.chegadaHci]) {
        const date = parseDate(raw as string | null);
        if (date) {
          const key = dateKey(date);
          if (!monthSet.has(key)) {
            monthSet.set(key, `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`);
          }
        }
      }
    });
    return Array.from(monthSet.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, label]) => ({ key, label }));
  }, [data]);

  // Collect POs that arrived in the selected month (statusCompraVenda "Chegou" + chegadaHci in month)
  const posChegouNoMes = useMemo(() => {
    if (selectedMonth === "all") return new Set<string>();
    const set = new Set<string>();
    data.forEach((d) => {
      if (!d.po || !isChegou(d.statusCompraVenda)) return;
      const chDate = parseDate(d.chegadaHci);
      if (chDate && dateKey(chDate) === selectedMonth) set.add(d.po);
    });
    return set;
  }, [data, selectedMonth]);

  // Filter: include rows where dataCompra is in month OR chegadaHci is in month OR PO arrived in month
  const monthFilteredData = useMemo(() => {
    if (selectedMonth === "all") return data;
    return data.filter((d) => {
      const dcDate = parseDate(d.dataCompra as string | null);
      const chDate = parseDate(d.chegadaHci);
      if (dcDate && dateKey(dcDate) === selectedMonth) return true;
      if (chDate && dateKey(chDate) === selectedMonth) return true;
      // Include all items of POs that arrived in this month
      if (d.po && posChegouNoMes.has(d.po)) return true;
      return false;
    });
  }, [data, selectedMonth, posChegouNoMes]);

  // KPIs
  const kpis = useMemo(() => {
    // POs compradas no mês = distinct POs where dataCompra is in month
    const posCompradasSet = new Set<string>();
    // POs que chegaram no mês = distinct POs where chegadaHci is in month AND status "Chegou"
    const posChegaram = new Set<string>();
    let faturamento = 0;
    let gastos = 0;
    let itensNoPrazo = 0;
    let itensAtrasadas = 0;
    let itensChegaram = 0;
    const poStatus = new Map<string, "prazo" | "atraso">();

    // For POs compradas: use dataCompra in month
    data.forEach((d) => {
      if (!d.po) return;
      if (selectedMonth === "all") {
        posCompradasSet.add(d.po);
      } else {
        const dcDate = parseDate(d.dataCompra as string | null);
        if (dcDate && dateKey(dcDate) === selectedMonth) posCompradasSet.add(d.po);
      }
    });

    // For POs que chegaram: use chegadaHci in month + status "Chegou"
    data.forEach((d) => {
      if (!d.po || !isChegou(d.statusCompraVenda)) return;
      if (selectedMonth === "all") {
        posChegaram.add(d.po);
        itensChegaram++;
      } else {
        const chDate = parseDate(d.chegadaHci);
        if (chDate && dateKey(chDate) === selectedMonth) {
          posChegaram.add(d.po);
          itensChegaram++;
        }
      }
    });

    // Financial KPIs from monthFilteredData
    monthFilteredData.forEach((d) => {
      if (d.precoVenda != null) faturamento += d.precoVenda * (d.qtyVenda ?? 1);
      if (d.precoCompra != null) gastos += d.precoCompra * (d.qtyCompra ?? 1);

      // Prazo analysis: only for items that "Chegou" and chegadaHci in month
      if (isChegou(d.statusCompraVenda)) {
        const chegada = parseDate(d.chegadaHci);
        if (selectedMonth !== "all" && (!chegada || dateKey(chegada) !== selectedMonth)) return;
        const prazo = parseDate(d.prazoCliente) || parseDate(d.entregaFornecedor);
        if (chegada && prazo) {
          const onTime = chegada <= prazo;
          if (onTime) itensNoPrazo++;
          else itensAtrasadas++;
          if (d.po) {
            const current = poStatus.get(d.po);
            if (!current || (!onTime && current === "prazo")) {
              poStatus.set(d.po, onTime ? "prazo" : "atraso");
            }
          }
        }
      }
    });

    let posNoPrazo = 0;
    let posAtrasadas = 0;
    poStatus.forEach((status) => {
      if (status === "prazo") posNoPrazo++;
      else posAtrasadas++;
    });

    return {
      posCompradas: posCompradasSet.size,
      posChegaram: posChegaram.size,
      faturamento,
      gastos,
      itensNoPrazo,
      itensAtrasadas,
      itensChegaram,
      posNoPrazo,
      posAtrasadas,
    };
  }, [data, monthFilteredData, selectedMonth]);

  // PO detail table - based on dataCompra in month
  const poDetails = useMemo(() => {
    const poMap = new Map<string, { po: string; fornecedor: string; venda: number; compra: number }>();
    const filtered = selectedMonth === "all" ? data : data.filter((d) => {
      const dcDate = parseDate(d.dataCompra as string | null);
      return dcDate && dateKey(dcDate) === selectedMonth;
    });
    filtered.forEach((d) => {
      if (!d.po) return;
      if (!poMap.has(d.po)) {
        poMap.set(d.po, { po: d.po, fornecedor: d.fornecedor || "-", venda: 0, compra: 0 });
      }
      const entry = poMap.get(d.po)!;
      if (d.precoVenda != null) entry.venda += d.precoVenda * (d.qtyVenda ?? 1);
      if (d.precoCompra != null) entry.compra += d.precoCompra * (d.qtyCompra ?? 1);
      if (d.fornecedor && entry.fornecedor === "-") entry.fornecedor = d.fornecedor;
    });

    let results = Array.from(poMap.values());
    if (poSearch.trim()) {
      const q = poSearch.trim().toLowerCase();
      results = results.filter((r) => r.po.toLowerCase().includes(q));
    }
    results.sort((a, b) => {
      let cmp = 0;
      if (sortField === "po") cmp = a.po.localeCompare(b.po);
      else if (sortField === "fornecedor") cmp = a.fornecedor.localeCompare(b.fornecedor);
      else if (sortField === "venda") cmp = a.venda - b.venda;
      else cmp = a.compra - b.compra;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return results;
  }, [data, selectedMonth, poSearch, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const toggleChegouSort = (field: SortField) => {
    if (chegouSortField === field) setChegouSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setChegouSortField(field); setChegouSortDir("desc"); }
  };

  // POs que Chegaram table - based on chegadaHci in month + status "Chegou"
  // Also includes POs with previsão (chegadaHci in month but NOT "Chegou")
  const poChegouDetails = useMemo(() => {
    type ChegouEntry = { po: string; fornecedor: string; venda: number; compra: number; previsao: boolean };
    const poMap = new Map<string, ChegouEntry>();

    const filtered = selectedMonth === "all"
      ? data.filter((d) => {
          if (isChegou(d.statusCompraVenda)) return true;
          // In "all" mode, don't include previsão
          return false;
        })
      : data.filter((d) => {
          const chDate = parseDate(d.chegadaHci);
          if (!chDate || dateKey(chDate) !== selectedMonth) return false;
          return true; // include both "Chegou" and previsão
        });

    filtered.forEach((d) => {
      if (!d.po) return;
      const chegou = isChegou(d.statusCompraVenda);
      if (!poMap.has(d.po)) {
        poMap.set(d.po, { po: d.po, fornecedor: d.fornecedor || "-", venda: 0, compra: 0, previsao: !chegou });
      }
      const entry = poMap.get(d.po)!;
      // If any item in the PO has "Chegou", mark the whole PO as not previsão
      if (chegou) entry.previsao = false;
      if (d.precoVenda != null) entry.venda += d.precoVenda * (d.qtyVenda ?? 1);
      if (d.precoCompra != null) entry.compra += d.precoCompra * (d.qtyCompra ?? 1);
      if (d.fornecedor && entry.fornecedor === "-") entry.fornecedor = d.fornecedor;
    });

    let results = Array.from(poMap.values());
    if (chegouSearch.trim()) {
      const q = chegouSearch.trim().toLowerCase();
      results = results.filter((r) => r.po.toLowerCase().includes(q));
    }
    // Sort: confirmed first, then previsão
    results.sort((a, b) => {
      if (a.previsao !== b.previsao) return a.previsao ? 1 : -1;
      let cmp = 0;
      if (chegouSortField === "po") cmp = a.po.localeCompare(b.po);
      else if (chegouSortField === "fornecedor") cmp = a.fornecedor.localeCompare(b.fornecedor);
      else if (chegouSortField === "venda") cmp = a.venda - b.venda;
      else cmp = a.compra - b.compra;
      return chegouSortDir === "asc" ? cmp : -cmp;
    });
    return results;
  }, [data, selectedMonth, chegouSearch, chegouSortField, chegouSortDir]);

  // Top materials
  const topMaterials = useMemo(() => {
    const materialMap = new Map<string, { qty: number; value: number }>();
    monthFilteredData.forEach((d) => {
      const name = d.descricao?.split(/\s+/)[0]?.toUpperCase() || "OUTROS";
      if (!materialMap.has(name)) materialMap.set(name, { qty: 0, value: 0 });
      const entry = materialMap.get(name)!;
      entry.qty += d.qtyCompra ?? 1;
      if (d.precoCompra != null) entry.value += d.precoCompra * (d.qtyCompra ?? 1);
    });
    return Array.from(materialMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => (materialRankBy === "qty" ? b.qty - a.qty : b.value - a.value))
      .slice(0, 10);
  }, [monthFilteredData, materialRankBy]);

  const maxMaterialValue = topMaterials.length > 0
    ? Math.max(...topMaterials.map((m) => (materialRankBy === "qty" ? m.qty : m.value)))
    : 1;

  const BAR_COLORS = [
    "hsl(215, 80%, 48%)", "hsl(215, 80%, 55%)", "hsl(215, 70%, 60%)",
    "hsl(215, 60%, 65%)", "hsl(215, 50%, 70%)", "hsl(200, 50%, 55%)",
    "hsl(200, 40%, 60%)", "hsl(200, 35%, 65%)", "hsl(200, 30%, 70%)", "hsl(200, 25%, 75%)",
  ];

  return (
    <div className="space-y-6">
      {/* Header with month filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Análise Mensal
        </h3>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="Selecionar mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {availableMonths.map((m) => (
                <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards - Row 1: POs Compradas (with breakdown), Faturamento, Gastos */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-none">{kpis.posCompradas}</p>
                <p className="mt-1 text-xs text-muted-foreground">POs Compradas</p>
              </div>
            </div>
            <div className="ml-[52px] space-y-1 border-t pt-2">
              <p className="text-xs text-muted-foreground">
                Chegaram: <span className="font-semibold text-foreground">{kpis.posChegaram}</span>
                <span className="text-[10px] text-muted-foreground ml-1">({kpis.itensChegaram} itens)</span>
              </p>
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle className="h-3 w-3" /> {kpis.posNoPrazo} no prazo
                </span>
                <span className="flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-3 w-3" /> {kpis.posAtrasadas} em atraso
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight truncate" title={formatBRL(kpis.faturamento)}>{formatBRL(kpis.faturamento)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Faturamento</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <DollarSign className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight truncate" title={formatUSD(kpis.gastos)}>{formatUSD(kpis.gastos)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Gastos (Compras)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards - Row 2: Itens prazo/atraso */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{kpis.itensNoPrazo}</p>
              <p className="mt-1 text-xs text-muted-foreground">Itens no Prazo</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{kpis.itensAtrasadas}</p>
              <p className="mt-1 text-xs text-muted-foreground">Itens em Atraso</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales vs Purchases Chart */}
      <SalesVsPurchasesChart data={monthFilteredData} />

      {/* PO Detail Table - only show if there are POs */}
      {poDetails.length > 0 && (
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" />
              POs Compradas ({poDetails.length})
            </CardTitle>
            <div className="relative w-[200px]">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar PO..."
                value={poSearch}
                onChange={(e) => setPoSearch(e.target.value)}
                className="h-7 pl-7 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("po")}>
                    <span className="flex items-center gap-1">PO <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("fornecedor")}>
                    <span className="flex items-center gap-1">Fornecedor <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("venda")}>
                    <span className="flex items-center gap-1 justify-end">Venda (R$) <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("compra")}>
                    <span className="flex items-center gap-1 justify-end">Compra ($) <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poDetails.map((row) => (
                  <TableRow
                    key={row.po}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => setSelectedPo(row.po)}
                  >
                    <TableCell className="font-medium text-xs text-primary underline-offset-2 hover:underline">{row.po}</TableCell>
                    <TableCell className="text-xs">{row.fornecedor}</TableCell>
                    <TableCell className="text-xs text-right">{formatBRL(row.venda)}</TableCell>
                    <TableCell className="text-xs text-right">{formatUSD(row.compra)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* POs que Chegaram Table - only show if there are POs */}
      {poChegouDetails.length > 0 && (
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              POs que Chegaram ({poChegouDetails.filter(r => !r.previsao).length})
              {poChegouDetails.some(r => r.previsao) && (
                <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  + {poChegouDetails.filter(r => r.previsao).length} previsão
                </span>
              )}
            </CardTitle>
            <div className="relative w-[200px]">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar PO..."
                value={chegouSearch}
                onChange={(e) => setChegouSearch(e.target.value)}
                className="h-7 pl-7 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleChegouSort("po")}>
                    <span className="flex items-center gap-1">PO <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleChegouSort("fornecedor")}>
                    <span className="flex items-center gap-1">Fornecedor <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleChegouSort("venda")}>
                    <span className="flex items-center gap-1 justify-end">Venda (R$) <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleChegouSort("compra")}>
                    <span className="flex items-center gap-1 justify-end">Compra ($) <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poChegouDetails.map((row) => (
                  <TableRow
                    key={row.po}
                    className={`cursor-pointer hover:bg-accent/50 transition-colors ${row.previsao ? 'opacity-70' : ''}`}
                    onClick={() => setSelectedPo(row.po)}
                  >
                    <TableCell className="font-medium text-xs text-primary underline-offset-2 hover:underline">
                      <span className="flex items-center gap-2">
                        {row.po}
                        {row.previsao && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600 dark:text-amber-400">
                            Previsão
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{row.fornecedor}</TableCell>
                    <TableCell className="text-xs text-right">{formatBRL(row.venda)}</TableCell>
                    <TableCell className="text-xs text-right">{formatUSD(row.compra)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Top Materials */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Materiais Mais Comprados
            </CardTitle>
            <Select value={materialRankBy} onValueChange={(v) => setMaterialRankBy(v as "qty" | "value")}>
              <SelectTrigger className="h-7 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="qty">Quantidade</SelectItem>
                <SelectItem value="value">Valor ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {topMaterials.length > 0 ? (
            <div className="space-y-2">
              {topMaterials.map((m, i) => {
                const percent = ((materialRankBy === "qty" ? m.qty : m.value) / maxMaterialValue) * 100;
                return (
                  <div
                    key={m.name}
                    className="flex items-center gap-3 cursor-pointer rounded-md p-1 -m-1 hover:bg-accent/50 transition-colors"
                    onClick={() => setSelectedMaterial(m.name)}
                  >
                    <span className="text-xs font-medium text-muted-foreground w-5 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium truncate text-primary underline-offset-2 hover:underline">{m.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">
                          {materialRankBy === "qty" ? `${m.qty.toLocaleString("pt-BR")} un` : formatUSD(m.value)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%`, backgroundColor: BAR_COLORS[i] || BAR_COLORS[0] }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados para exibir</p>
          )}
        </CardContent>
      </Card>

      {/* Drill-down modals */}
      <PoDetailModal po={selectedPo} data={data} onClose={() => setSelectedPo(null)} />
      <MaterialDetailModal material={selectedMaterial} data={monthFilteredData} onClose={() => setSelectedMaterial(null)} />
    </div>
  );
}
