import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { AlertTriangle, TrendingUp, TrendingDown, DollarSign, Truck, RotateCcw, Zap, Package, Download } from "lucide-react";
import { downloadDelayReport } from "@/lib/downloadDelayReport";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionPlanModal } from "./ActionPlanModal";

interface OrderData {
  pi: number | null;
  cliente: string | null;
  codigo: string | null;
  descricao: string | null;
  precoVenda: number | null;
  precoCompra: number | null;
  qtyVenda: number | null;
  qtyCompra: number | null;
  fornecedor: string | null;
  statusCompraVenda: string | null;
  statusFornecedor: string | null;
  diasFaltam: number | null;
  diasAtraso: number | null;
  po: string | null;
  chegadaHci: string | null;
  prazoCliente: string | null;
  item: string | null;
  [key: string]: unknown;
}

function formatUSD(v: number | null) {
  if (v == null) return "—";
  return `$ ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatBRL(v: number | null) {
  if (v == null) return "—";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getMarginPct(venda: number | null, compra: number | null) {
  if (!venda || !compra || compra === 0) return null;
  return ((venda - compra) / venda) * 100;
}

interface SmartAlertsProps {
  data: OrderData[];
  activePo?: string | null;
}

export function SmartAlerts({ data, activePo }: SmartAlertsProps) {
  const [pesoKgValue, setPesoKgValue] = useState(1.0);
  const [itemWeights, setItemWeights] = useState<Record<string, number>>({});
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);
  // Price analysis
  const priceAnalysis = useMemo(() => {
    const withPrices = data.filter((d) => d.precoCompra != null && d.precoCompra > 0);
    const sorted = [...withPrices].sort((a, b) => (b.precoCompra ?? 0) - (a.precoCompra ?? 0));
    const top5Expensive = sorted.slice(0, 5);
    const top5Cheapest = sorted.slice(-5).reverse();

    const withMargin = data
      .filter((d) => d.precoVenda != null && d.precoCompra != null && d.precoCompra > 0)
      .map((d) => ({
        ...d,
        margin: getMarginPct(d.precoVenda, d.precoCompra)!,
        profit: (d.precoVenda! - d.precoCompra!) * (typeof d.qtyVenda === "number" ? d.qtyVenda : 1),
      }))
      .sort((a, b) => a.margin - b.margin);

    const lowMargin = withMargin.filter((d) => d.margin < 15).slice(0, 10);
    const highMargin = withMargin.filter((d) => d.margin >= 40).slice(0, 5);

    return { top5Expensive, top5Cheapest, lowMargin, highMargin };
  }, [data]);

  // Delay alerts with action suggestions
  const delayAlerts = useMemo(() => {
    const alerts: { item: OrderData; severity: "critical" | "warning" | "info"; message: string; action: string }[] = [];

    data.forEach((d) => {
      if (d.statusCompraVenda === "Crítico") {
        alerts.push({
          item: d,
          severity: "critical",
          message: `PI ${d.pi} — ${d.descricao || d.codigo} está CRÍTICO`,
          action: "Considerar frete aéreo ou trocar fornecedor urgente",
        });
      } else if (d.statusCompraVenda === "Atrasado") {
        alerts.push({
          item: d,
          severity: "warning",
          message: `PI ${d.pi} — ${d.descricao || d.codigo} está ATRASADO`,
          action: d.diasFaltam != null && d.diasFaltam < 5
            ? "Acelerar frete — prazo muito curto"
            : "Contatar fornecedor para atualização de prazo",
        });
      } else if (d.statusFornecedor === "Atrasado" && d.statusCompraVenda !== "Chegou" && d.statusCompraVenda !== "Estoque") {
        alerts.push({
          item: d,
          severity: "warning",
          message: `PI ${d.pi} — Fornecedor ${d.fornecedor} atrasado`,
          action: "Cobrar fornecedor ou buscar alternativa",
        });
      } else if (d.statusCompraVenda === "Verificar aéreo") {
        alerts.push({
          item: d,
          severity: "info",
          message: `PI ${d.pi} — Verificar necessidade de frete aéreo`,
          action: "Comparar custo do aéreo vs impacto do atraso no cliente",
        });
      }
    });

    return alerts.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
  }, [data]);

  // Supplier performance — ALL suppliers with on-time rate
  const supplierStats = useMemo(() => {
    const map: Record<string, { name: string; total: number; noPrazo: number; atrasados: number; criticos: number; pos: Set<string>; posAtrasadas: Set<string> }> = {};
    data.forEach((d) => {
      if (!d.fornecedor) return;
      if (!map[d.fornecedor]) map[d.fornecedor] = { name: d.fornecedor, total: 0, noPrazo: 0, atrasados: 0, criticos: 0, pos: new Set(), posAtrasadas: new Set() };
      map[d.fornecedor].total++;
      if (d.po) map[d.fornecedor].pos.add(d.po);
      if (d.statusFornecedor === "On time" || d.statusCompraVenda === "No prazo" || d.statusCompraVenda === "Chegou") map[d.fornecedor].noPrazo++;
      if (d.statusFornecedor === "Atrasado") {
        map[d.fornecedor].atrasados++;
        if (d.po) map[d.fornecedor].posAtrasadas.add(d.po);
      }
      if (d.statusCompraVenda === "Crítico") {
        map[d.fornecedor].criticos++;
        if (d.po) map[d.fornecedor].posAtrasadas.add(d.po);
      }
    });
    return Object.values(map)
      .map((s) => ({ ...s, totalPOs: s.pos.size, totalPOsAtrasadas: s.posAtrasadas.size }))
      .sort((a, b) => (b.criticos + b.atrasados) - (a.criticos + a.atrasados));
  }, [data]);

  // Air freight margin analysis — STEP 1: filter + sort ONCE using default peso.
  // itemWeights is intentionally excluded so that editing a weight never reorders rows.
  const airFreightBase = useMemo(() => {
    const FRETE_USD_KG = 1.0;
    const PESO_KG = pesoKgValue;
    const FATOR_NAC = 8;

    const statuses = ["crítico", "atrasado", "verificar aéreo", "alerta"];
    const matchStatus = (s: unknown) => typeof s === "string" ? statuses.includes(s.toLowerCase()) : false;

    const matchingPOs = new Set<string>();
    if (activePo && activePo !== "all") {
      matchingPOs.add(activePo);
    } else {
      data.forEach((d) => {
        if (
          (matchStatus(d.statusCompraVenda) || matchStatus(d.statusFornecedor)) &&
          (typeof d.statusCompraVenda !== "string" || d.statusCompraVenda.toLowerCase() !== "no prazo") &&
          d.precoCompra != null && d.precoCompra > 0 &&
          d.po
        ) {
          matchingPOs.add(d.po);
        }
      });
    }

    return data
      .filter((d) => d.po && matchingPOs.has(d.po) && (activePo && activePo !== "all" ? true : (d.precoCompra != null && d.precoCompra > 0)))
      .map((d) => {
        const precoUnit = d.precoCompra ?? 0;
        const precoCliente = d.precoVenda ?? 0;
        const itemKey = `${d.pi}-${d.codigo}`;

        const nacionalizado = precoUnit * FATOR_NAC;
        const margem = nacionalizado > 0 ? precoCliente / nacionalizado : null;
        const fator = precoUnit > 0 ? precoCliente / precoUnit : null;

        // Sort key uses the global default peso — never per-item weights
        const freteDefault = FRETE_USD_KG * PESO_KG * FATOR_NAC;
        const itemComFreteDefault = precoUnit + freteDefault;
        const novaMargemDefault = itemComFreteDefault * FATOR_NAC > 0
          ? precoCliente / (itemComFreteDefault * FATOR_NAC)
          : null;

        return { ...d, precoUnit, precoCliente, nacionalizado, margem, fator, _itemKey: itemKey, _sortKey: novaMargemDefault };
      })
      .sort((a, b) => (b._sortKey ?? -999) - (a._sortKey ?? -999));
  }, [data, pesoKgValue, activePo]); // ← itemWeights intentionally absent

  // STEP 2: apply per-item weights on top of the stable order — no re-sort.
  const airFreightAnalysis = useMemo(() => {
    const FRETE_USD_KG = 1.0;
    const FATOR_NAC = 8;

    const items = airFreightBase.map((d) => {
      const peso = itemWeights[d._itemKey] ?? pesoKgValue;
      const freteUnit = FRETE_USD_KG * peso * FATOR_NAC;
      const itemComFrete = d.precoUnit + freteUnit;
      const nacionalizadoComFrete = itemComFrete * FATOR_NAC;
      const novaMargem = nacionalizadoComFrete > 0 ? d.precoCliente / nacionalizadoComFrete : null;
      const novoFator = itemComFrete > 0 ? d.precoCliente / itemComFrete : null;
      return { ...d, pesoKg: peso, freteUsdKg: freteUnit, itemComFrete, nacionalizadoComFrete, novaMargem, novoFator };
    });

    const viable = items.filter((d) => d.novaMargem != null && d.novaMargem > 1);
    const notViable = items.filter((d) => d.novaMargem != null && d.novaMargem <= 1);
    return { items, viable, notViable };
  }, [airFreightBase, itemWeights, pesoKgValue]);

  // Critical payment priorities - items that are critical/delayed with highest values
  const criticalPayments = useMemo(() => {
    const critical = data
      .filter((d) =>
        (d.statusCompraVenda === "Crítico" || d.statusCompraVenda === "Atrasado" || d.statusCompraVenda === "Verificar aéreo") &&
        d.precoCompra != null && d.precoCompra > 0
      )
      .map((d) => ({
        ...d,
        totalCompra: (d.precoCompra ?? 0) * (typeof d.qtyCompra === "number" ? d.qtyCompra : 1),
        totalVenda: (d.precoVenda ?? 0) * (typeof d.qtyVenda === "number" ? d.qtyVenda : 1),
      }))
      .filter((d) => d.totalVenda > 7000)
      .sort((a, b) => b.totalCompra - a.totalCompra);

    const totalValueAtRisk = critical.reduce((sum, d) => sum + d.totalCompra, 0);
    const totalVendaAtRisk = critical.reduce((sum, d) => sum + d.totalVenda, 0);

    return { items: critical, totalValueAtRisk, totalVendaAtRisk };
  }, [data]);

  const severityStyles = {
    critical: "border-l-4 border-l-status-critico bg-status-critico/5",
    warning: "border-l-4 border-l-status-atrasado bg-status-atrasado/5",
    info: "border-l-4 border-l-status-verificar bg-status-verificar/5",
  };

  const severityIcon = {
    critical: <AlertTriangle className="h-4 w-4 text-status-critico" />,
    warning: <AlertTriangle className="h-4 w-4 text-status-atrasado" />,
    info: <Truck className="h-4 w-4 text-status-verificar" />,
  };

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">Alertas Inteligentes</CardTitle>
          <span className="ml-auto rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {delayAlerts.length} alertas
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="alerts" className="w-full">
          <TabsList className="mb-3 w-full justify-start">
            <TabsTrigger value="alerts" className="text-xs">
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Atrasos & Ações
            </TabsTrigger>
            <TabsTrigger value="prices" className="text-xs">
              <DollarSign className="mr-1.5 h-3.5 w-3.5" /> Preços & Margem
            </TabsTrigger>
            <TabsTrigger value="critical-payments" className="text-xs">
              <DollarSign className="mr-1.5 h-3.5 w-3.5" /> Valores Críticos
            </TabsTrigger>
            <TabsTrigger value="air-freight" className="text-xs">
              <Truck className="mr-1.5 h-3.5 w-3.5" /> Margem Aéreo
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="text-xs">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Fornecedores
            </TabsTrigger>
            {activePo && activePo !== "all" && (
              <TabsTrigger value="po-items" className="text-xs">
                <Package className="mr-1.5 h-3.5 w-3.5" /> Itens PO: {activePo}
              </TabsTrigger>
            )}
          </TabsList>

          {/* ALERTS TAB */}
          <TabsContent value="alerts" className="max-h-[450px] space-y-2 overflow-auto">
            {delayAlerts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum alerta no momento 🎉</p>
            ) : (
              <>
                <div className="flex justify-end mb-2">
                  <button
                    onClick={async () => {
                      const ok = await downloadDelayReport(data);
                      if (!ok) toast.info("Nenhum pedido em atraso para exportar.");
                    }}
                    className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar Relatório
                  </button>
                </div>
              {delayAlerts.map((a, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-3 cursor-pointer transition-shadow hover:shadow-md ${severityStyles[a.severity]}`}
                  onClick={() => setSelectedOrder(a.item)}
                  title="Clique para ver o plano de ação"
                >
                  <div className="flex items-start gap-2">
                    {severityIcon[a.severity]}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{a.message}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Ação:</span> {a.action}
                      </p>
                      <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                        <span>PO: {a.item.po || "—"}</span>
                        <span>Fornecedor: {a.item.fornecedor || "—"}</span>
                        <span>Cliente: {a.item.cliente || "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              </>
            )}
          </TabsContent>

          {/* PRICES TAB */}
          <TabsContent value="prices" className="space-y-4 max-h-[450px] overflow-auto">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Most Expensive */}
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                  <TrendingUp className="h-3.5 w-3.5 text-destructive" /> Itens Mais Caros (Compra)
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Código</TableHead>
                      <TableHead className="text-xs">Preço Compra</TableHead>
                      <TableHead className="text-xs">Preço Venda</TableHead>
                      <TableHead className="text-xs">Margem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceAnalysis.top5Expensive.map((r, i) => {
                      const m = getMarginPct(r.precoVenda, r.precoCompra);
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{r.codigo || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{formatUSD(r.precoCompra)}</TableCell>
                          <TableCell className="text-xs font-mono">{formatBRL(r.precoVenda)}</TableCell>
                          <TableCell className={`text-xs font-mono ${m != null && m < 15 ? "text-destructive font-semibold" : ""}`}>
                            {m != null ? `${m.toFixed(1)}%` : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Cheapest */}
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                  <TrendingDown className="h-3.5 w-3.5 text-status-chegou" /> Itens Mais Baratos (Compra)
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Código</TableHead>
                      <TableHead className="text-xs">Preço Compra</TableHead>
                      <TableHead className="text-xs">Preço Venda</TableHead>
                      <TableHead className="text-xs">Margem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceAnalysis.top5Cheapest.map((r, i) => {
                      const m = getMarginPct(r.precoVenda, r.precoCompra);
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{r.codigo || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{formatUSD(r.precoCompra)}</TableCell>
                          <TableCell className="text-xs font-mono">{formatBRL(r.precoVenda)}</TableCell>
                          <TableCell className="text-xs font-mono">{m != null ? `${m.toFixed(1)}%` : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Low margin items */}
            {priceAnalysis.lowMargin.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> Itens com Margem Baixa (&lt;15%)
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">PI</TableHead>
                      <TableHead className="text-xs">Código</TableHead>
                      <TableHead className="text-xs">Fornecedor</TableHead>
                      <TableHead className="text-xs">Compra</TableHead>
                      <TableHead className="text-xs">Venda</TableHead>
                      <TableHead className="text-xs">Margem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceAnalysis.lowMargin.map((r, i) => (
                      <TableRow key={i} className="bg-destructive/5">
                        <TableCell className="font-mono text-xs">{r.pi || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.codigo || "—"}</TableCell>
                        <TableCell className="text-xs">{r.fornecedor || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{formatUSD(r.precoCompra)}</TableCell>
                        <TableCell className="text-xs font-mono">{formatBRL(r.precoVenda)}</TableCell>
                        <TableCell className="text-xs font-mono font-semibold text-destructive">{r.margin != null ? r.margin.toFixed(1) : "—"}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* CRITICAL PAYMENTS TAB */}
          <TabsContent value="critical-payments" className="max-h-[450px] space-y-3 overflow-auto">
            {criticalPayments.items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum item crítico para pagamento 🎉</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-4 rounded-lg bg-destructive/5 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Valor Total em Risco (Compra)</p>
                    <p className="text-lg font-bold font-mono">{formatUSD(criticalPayments.totalValueAtRisk)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor Total em Risco (Venda)</p>
                    <p className="text-lg font-bold font-mono">{formatBRL(criticalPayments.totalVendaAtRisk)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Itens Prioritários</p>
                    <p className="text-lg font-bold">{criticalPayments.items.length}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Itens críticos/atrasados ordenados por valor de compra — prioridade para pagamento e acompanhamento.</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">PO</TableHead>
                      <TableHead className="text-xs">Item</TableHead>
                      <TableHead className="text-xs">Fornecedor</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Vlr Compra</TableHead>
                      <TableHead className="text-xs text-right">Vlr Venda</TableHead>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-xs">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {criticalPayments.items.map((d, i) => (
                      <TableRow key={i} className={d.statusCompraVenda === "Crítico" ? "bg-status-critico/5" : "bg-status-atrasado/5"}>
                        <TableCell className="font-mono text-xs font-medium">{d.po || "—"}</TableCell>
                        <TableCell className="text-xs">{d.codigo || "—"}</TableCell>
                        <TableCell className="text-xs">{d.fornecedor || "—"}</TableCell>
                        <TableCell className="text-xs">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            d.statusCompraVenda === "Crítico" ? "bg-status-critico/20 text-status-critico" :
                            d.statusCompraVenda === "Atrasado" ? "bg-status-atrasado/20 text-status-atrasado" :
                            "bg-status-verificar/20 text-status-verificar"
                          }`}>{d.statusCompraVenda}</span>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-right font-semibold">{formatUSD(d.totalCompra)}</TableCell>
                        <TableCell className="text-xs font-mono text-right">{formatBRL(d.totalVenda)}</TableCell>
                        <TableCell className="text-xs">{d.cliente || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {d.statusCompraVenda === "Crítico"
                            ? "🚨 Prioridade máxima"
                            : d.totalCompra > 5000
                            ? "⚠️ Alto valor — acompanhar"
                            : "📋 Monitorar"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </TabsContent>

          {/* AIR FREIGHT MARGIN TAB */}
          <TabsContent value="air-freight" className="max-h-[450px] space-y-3 overflow-auto">
            {airFreightAnalysis.items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum item crítico/atrasado para análise de frete aéreo 🎉</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-4 rounded-lg bg-primary/5 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Itens Analisados</p>
                    <p className="text-lg font-bold">{airFreightAnalysis.items.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Viáveis (margem &gt; 1.0)</p>
                    <p className="text-lg font-bold text-status-chegou">{airFreightAnalysis.viable.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Inviáveis (margem ≤ 1.0)</p>
                    <p className="text-lg font-bold text-destructive">{airFreightAnalysis.notViable.length}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Simulação: Custo nacionalizado (×8) sem e com frete aéreo (~1,00 USD/kg) — avalia viabilidade.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">PO</TableHead>
                      <TableHead className="text-xs">Cód. Compra</TableHead>
                      <TableHead className="text-xs">Item</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Unit Forn. ($)</TableHead>
                      <TableHead className="text-xs text-right">Unit Cliente (R$)</TableHead>
                      <TableHead className="text-xs text-right">Nac. ×8</TableHead>
                      <TableHead className="text-xs text-right">Margem</TableHead>
                      <TableHead className="text-xs text-right">Fator</TableHead>
                      <TableHead className="text-xs text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span>Peso (kg)</span>
                        </div>
                      </TableHead>
                       <TableHead className="text-xs text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span>USD/KG</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={pesoKgValue}
                            onChange={(e) => setPesoKgValue(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                            className="w-16 h-6 text-xs text-right rounded border border-input bg-background px-1 font-mono"
                          />
                        </div>
                      </TableHead>
                      <TableHead className="text-xs text-right">Item+Frete</TableHead>
                      <TableHead className="text-xs text-right">Nac. ×8 c/ Frete</TableHead>
                      <TableHead className="text-xs text-right">Nova Margem</TableHead>
                      <TableHead className="text-xs text-right">Novo Fator</TableHead>
                      <TableHead className="text-xs">Viabilidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {airFreightAnalysis.items.map((d) => (
                      <TableRow key={d._itemKey} className={
                        d.novaMargem != null && d.novaMargem > 1.1 ? "bg-status-chegou/5" :
                        d.novaMargem != null && d.novaMargem > 1 ? "bg-status-verificar/5" :
                        "bg-status-critico/5"
                      }>
                        <TableCell className="font-mono text-xs font-medium">{d.po || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{(d as any).codigoCompra || "—"}</TableCell>
                        <TableCell className="text-xs">{(d as any).item || "—"}</TableCell>
                        <TableCell className="text-xs">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            d.statusCompraVenda === "Crítico" ? "bg-status-critico/20 text-status-critico" :
                            d.statusCompraVenda === "Atrasado" ? "bg-status-atrasado/20 text-status-atrasado" :
                            "bg-status-verificar/20 text-status-verificar"
                          }`}>{d.statusCompraVenda || d.statusFornecedor}</span>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-right">{formatUSD(d.precoUnit)}</TableCell>
                        <TableCell className="text-xs font-mono text-right">{formatBRL(d.precoCliente)}</TableCell>
                        <TableCell className="text-xs font-mono text-right">{formatBRL(d.nacionalizado)}</TableCell>
                        <TableCell className={`text-xs font-mono text-right ${d.margem != null && d.margem < 1 ? "text-destructive font-semibold" : ""}`}>
                          {d.margem != null ? d.margem.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-right">{d.fator != null ? d.fator.toFixed(2) : "—"}</TableCell>
                        <TableCell className="text-xs text-right">
                          <input
                            key={`${d._itemKey}-${itemWeights[d._itemKey] ?? pesoKgValue}`}
                            type="number"
                            step="0.1"
                            min="0.1"
                            defaultValue={itemWeights[d._itemKey] ?? pesoKgValue}
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v > 0) {
                                setItemWeights((prev) => ({ ...prev, [d._itemKey]: v }));
                              }
                            }}
                            className="w-16 h-6 text-xs text-right rounded border border-input bg-background px-1 font-mono"
                          />
                        </TableCell>
                        <TableCell className="text-xs font-mono text-right">{formatUSD(d.freteUsdKg)}</TableCell>
                        <TableCell className="text-xs font-mono text-right">{formatUSD(d.itemComFrete)}</TableCell>
                        <TableCell className="text-xs font-mono text-right font-semibold">{formatBRL(d.nacionalizadoComFrete)}</TableCell>
                        <TableCell className={`text-xs font-mono text-right font-semibold ${
                          d.novaMargem != null && d.novaMargem > 1.1 ? "text-status-chegou" :
                          d.novaMargem != null && d.novaMargem > 1 ? "text-status-verificar" :
                          "text-destructive"
                        }`}>
                          {d.novaMargem != null ? d.novaMargem.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className={`text-xs font-mono text-right font-semibold ${
                          d.novoFator != null && d.novoFator < 1 ? "text-destructive" : ""
                        }`}>
                          {d.novoFator != null ? d.novoFator.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {d.novoFator != null && d.novoFator > 12
                            ? "✅ Viável"
                            : d.novoFator != null && d.novoFator > 10
                            ? "⚠️ Apertada"
                            : "🚫 Inviável"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </TabsContent>

          {/* PO ITEMS TAB — only visible when a PO is selected */}
          {activePo && activePo !== "all" && (
            <TabsContent value="po-items" className="max-h-[450px] space-y-3 overflow-auto">
              {(() => {
                const poItems = data.filter((d) => d.po === activePo);
                if (poItems.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum item encontrado para esta PO</p>;

                // Propaga preço de compra: se o mesmo código tem preço em alguma linha
                // mas não em outras, preenche as linhas sem preço com o valor encontrado.
                const priceByCode = new Map<string, number>();
                poItems.forEach((d) => {
                  if (d.codigo && d.precoCompra != null && d.precoCompra > 0) {
                    if (!priceByCode.has(d.codigo)) priceByCode.set(d.codigo, d.precoCompra);
                  }
                });
                const poItemsEnriched = poItems.map((d) => ({
                  ...d,
                  precoCompraEfetivo:
                    d.precoCompra ?? (d.codigo ? (priceByCode.get(d.codigo) ?? null) : null),
                }));

                const downloadPoExcel = () => {
                  const rows = poItemsEnriched.map((d) => ({
                    Item: d.item ?? "",
                    PI: d.pi ?? "",
                    Código: d.codigo ?? "",
                    Descrição: d.descricao ?? "",
                    "Status C/V": d.statusCompraVenda ?? "",
                    "Status Forn.": d.statusFornecedor ?? "",
                    "Preço Compra": d.precoCompraEfetivo ?? "",
                    "Preço Venda": d.precoVenda ?? "",
                    Qty: d.qtyVenda ?? d.qtyCompra ?? "",
                    "Peso (kg)": itemWeights[`${d.pi}-${d.codigo}`] ?? "",
                    ETD: (d as any).etd ?? "",
                    ETA: (d as any).eta ?? "",
                    "Prazo Cliente": d.prazoCliente ?? "",
                    "Chegada HCI": d.chegadaHci ?? "",
                    Fornecedor: d.fornecedor ?? "",
                    Cliente: d.cliente ?? "",
                  }));
                  const ws = XLSX.utils.json_to_sheet(rows);
                  ws["!cols"] = [
                    { wch: 8 }, { wch: 8 }, { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 14 },
                    { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 12 },
                    { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 20 },
                  ];

                  // Aba 2: Margem Aérea da PO
                  const FATOR_NAC = 8;
                  const margemRows = poItemsEnriched.map((d) => {
                    const precoForn = d.precoCompraEfetivo ?? 0;
                    const precoCliente = d.precoVenda ?? 0;
                    const itemKey = `${d.pi}-${d.codigo}`;
                    const peso = itemWeights[itemKey] ?? pesoKgValue;
                    const nacionalizado = precoForn * FATOR_NAC;
                    const margem = nacionalizado > 0 ? precoCliente / nacionalizado : 0;
                    const fator = precoForn > 0 ? precoCliente / precoForn : 0;
                    const freteUnit = 1.0 * peso * FATOR_NAC;
                    const itemComFrete = precoForn + freteUnit;
                    const nacAereo = itemComFrete * FATOR_NAC;
                    const novaMargem = nacAereo > 0 ? precoCliente / nacAereo : 0;
                    const novoFator = itemComFrete > 0 ? precoCliente / itemComFrete : 0;

                    return {
                      Item: d.item ?? "",
                      PI: d.pi ?? "",
                      Código: d.codigo ?? "",
                      Descrição: d.descricao ?? "",
                      Status: d.statusCompraVenda ?? "",
                      Qty: d.qtyVenda ?? d.qtyCompra ?? "",
                      "Peso (kg)": peso,
                      "Preço Fornecedor": precoForn,
                      "Preço Cliente": precoCliente,
                      "Nacionalizado x8": nacionalizado,
                      "Margem": margem != null ? margem.toFixed(2) : "",
                      "Fator": fator != null ? fator.toFixed(2) : "",
                      "Frete Aéreo (USD)": freteUnit != null ? freteUnit.toFixed(2) : "",
                      "Item + Frete": itemComFrete != null ? itemComFrete.toFixed(2) : "",
                      "Nac. Aéreo x8": nacAereo != null ? nacAereo.toFixed(2) : "",
                      "Nova Margem": novaMargem != null ? novaMargem.toFixed(2) : "",
                      "Novo Fator": novoFator != null ? novoFator.toFixed(2) : "",
                      "Viabilidade": novaMargem > 1.2 ? "Viável" : novaMargem >= 1.0 ? "Margem Apertada" : "Inviável",
                    };
                  });
                  const ws2 = XLSX.utils.json_to_sheet(margemRows);
                  ws2["!cols"] = [
                    { wch: 8 }, { wch: 8 }, { wch: 18 }, { wch: 30 }, { wch: 14 },
                    { wch: 8 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
                    { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
                    { wch: 14 }, { wch: 12 }, { wch: 16 },
                  ];

                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, `PO ${activePo}`);
                  XLSX.utils.book_append_sheet(wb, ws2, "Margem Aérea");
                  XLSX.writeFile(wb, `PO_${activePo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
                };

                return (
                  <>
                    <div className="flex flex-wrap gap-4 rounded-lg bg-primary/5 p-3">
                      <div>
                        <p className="text-xs text-muted-foreground">PO</p>
                        <p className="text-lg font-bold font-mono">{activePo}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total de Itens</p>
                        <p className="text-lg font-bold">{poItems.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fornecedor</p>
                        <p className="text-lg font-bold">{poItems[0]?.fornecedor || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cliente{(() => { const c = [...new Set(poItems.map(d => d.cliente).filter(Boolean))]; return c.length > 1 ? "s" : ""; })()}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(() => {
                            const clientes = [...new Set(poItems.map(d => d.cliente).filter(Boolean))];
                            return clientes.length > 0
                              ? clientes.map((c, i) => (
                                  <span key={i} className="text-lg font-bold">{c}{i < clientes.length - 1 ? "," : ""}</span>
                                ))
                              : <span className="text-lg font-bold">—</span>;
                          })()}
                        </div>
                      </div>
                      <div className="ml-auto flex items-end">
                        <button
                          onClick={downloadPoExcel}
                          className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Baixar PO Excel
                        </button>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Item</TableHead>
                          <TableHead className="text-xs">PI</TableHead>
                          <TableHead className="text-xs">Código</TableHead>
                          <TableHead className="text-xs">Descrição</TableHead>
                          <TableHead className="text-xs">Status C/V</TableHead>
                          <TableHead className="text-xs">Status Forn.</TableHead>
                          <TableHead className="text-xs text-right">Preço Compra</TableHead>
                          <TableHead className="text-xs text-right">Preço Venda</TableHead>
                          <TableHead className="text-xs text-right">Qty</TableHead>
                          <TableHead className="text-xs text-right">Peso (kg)</TableHead>
                          <TableHead className="text-xs">Prazo Cliente</TableHead>
                          <TableHead className="text-xs">Chegada HCI</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {poItemsEnriched.map((d, i) => (
                          <TableRow key={i} className={
                            d.statusCompraVenda === "Crítico" ? "bg-status-critico/5" :
                            d.statusCompraVenda === "Atrasado" ? "bg-status-atrasado/5" : ""
                          }>
                            <TableCell className="font-mono text-xs font-semibold text-primary">{d.item || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{d.pi || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{d.codigo || "—"}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{d.descricao || "—"}</TableCell>
                            <TableCell className="text-xs">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                d.statusCompraVenda === "Crítico" ? "bg-status-critico/20 text-status-critico" :
                                d.statusCompraVenda === "Atrasado" ? "bg-status-atrasado/20 text-status-atrasado" :
                                d.statusCompraVenda === "No prazo" ? "bg-status-no-prazo/20 text-status-no-prazo" :
                                d.statusCompraVenda === "Chegou" ? "bg-status-chegou/20 text-status-chegou" :
                                "bg-muted text-muted-foreground"
                              }`}>{d.statusCompraVenda || "—"}</span>
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                d.statusFornecedor === "Atrasado" ? "bg-status-atrasado/20 text-status-atrasado" :
                                "bg-muted text-muted-foreground"
                              }`}>{d.statusFornecedor || "—"}</span>
                            </TableCell>
                            <TableCell className={`text-xs font-mono text-right ${d.precoCompraEfetivo !== d.precoCompra ? "text-muted-foreground italic" : ""}`}>
                              {formatUSD(d.precoCompraEfetivo)}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-right">{formatBRL(d.precoVenda)}</TableCell>
                            <TableCell className="text-xs font-mono text-right">{d.qtyVenda ?? d.qtyCompra ?? "—"}</TableCell>
                            <TableCell className="text-xs text-right">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={itemWeights[`${d.pi}-${d.codigo}`] ?? ""}
                                placeholder="—"
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  setItemWeights((prev) => ({ ...prev, [`${d.pi}-${d.codigo}`]: isNaN(v) ? 0 : v }));
                                }}
                                className="w-16 h-6 text-xs text-right rounded border border-input bg-background px-1 font-mono"
                              />
                            </TableCell>
                            <TableCell className="text-xs font-mono whitespace-nowrap">{d.prazoCliente || "—"}</TableCell>
                            <TableCell className="text-xs font-mono whitespace-nowrap">{d.chegadaHci || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                );
              })()}
            </TabsContent>
          )}

          {/* SUPPLIERS TAB */}
          <TabsContent value="suppliers" className="max-h-[450px] overflow-auto">
            {supplierStats.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum fornecedor cadastrado</p>
            ) : (
              <>
                <p className="mb-3 text-xs text-muted-foreground">Visão geral do desempenho dos fornecedores — entregas no prazo vs atrasos.</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Fornecedor</TableHead>
                      <TableHead className="text-xs text-center">Total Itens</TableHead>
                      <TableHead className="text-xs text-center">Qtd POs</TableHead>
                      <TableHead className="text-xs text-center">No Prazo</TableHead>
                      <TableHead className="text-xs text-center">Atrasados</TableHead>
                      <TableHead className="text-xs text-center">Críticos</TableHead>
                      <TableHead className="text-xs text-center">POs c/ Atraso</TableHead>
                      <TableHead className="text-xs text-center">Taxa Pontualidade</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierStats.map((s) => {
                      const rate = s.total > 0 ? ((s.noPrazo / s.total) * 100) : 0;
                      const statusLabel = s.criticos > 2 ? "🔴 Crítico" : s.atrasados > 3 ? "🟠 Atenção" : rate >= 80 ? "🟢 Bom" : rate >= 50 ? "🟡 Regular" : "🔴 Ruim";
                      return (
                        <TableRow key={s.name} className={s.criticos > 0 ? "bg-status-critico/5" : s.atrasados > 0 ? "bg-status-atrasado/5" : ""}>
                          <TableCell className="text-xs font-medium">{s.name}</TableCell>
                          <TableCell className="text-xs text-center">{s.total}</TableCell>
                          <TableCell className="text-xs text-center font-mono font-semibold">{s.totalPOs}</TableCell>
                          <TableCell className="text-xs text-center font-mono text-status-no-prazo">{s.noPrazo}</TableCell>
                          <TableCell className="text-xs text-center font-mono">{s.atrasados}</TableCell>
                          <TableCell className="text-xs text-center font-mono font-semibold text-destructive">{s.criticos}</TableCell>
                          <TableCell className="text-xs text-center font-mono font-semibold text-destructive">{s.totalPOsAtrasadas}</TableCell>
                          <TableCell className="text-xs text-center">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              rate >= 80 ? "bg-status-no-prazo/20 text-status-no-prazo" :
                              rate >= 50 ? "bg-status-verificar/20 text-status-verificar" :
                              "bg-status-atrasado/20 text-status-atrasado"
                            }`}>{rate.toFixed(0)}%</span>
                          </TableCell>
                          <TableCell className="text-xs font-medium">{statusLabel}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </TabsContent>
        </Tabs>
        <ActionPlanModal
          open={!!selectedOrder}
          onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}
          order={selectedOrder}
        />
      </CardContent>
    </Card>
  );
}
