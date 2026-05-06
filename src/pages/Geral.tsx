import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, Package, Users, ShoppingCart, DollarSign, FileText, Download } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { HeaderTabs } from "@/components/HeaderTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardLoadingSkeleton, DashboardErrorState } from "@/components/dashboard/DashboardStates";

type PedidoSummary = {
  categoria: string | null;
  status_fornecedor: string | null;
  status_compra_venda: string | null;
  fornecedor: string | null;
  cliente: string | null;
  preco_venda: number | null;
  preco_compra: number | null;
  qty_venda: number | null;
  qty_compra: number | null;
  po: string | null;
  embarque: string | null;
  prazo_cliente: string | null;
  emissao_pedido_sistema: string | null;
};

const CATEGORY_COLORS: Record<string, string> = {
  Conexões: "#3b82f6",   // azul
  Tubos:    "#f97316",   // laranja
  Válvulas: "#10b981",   // verde
};

const SHIPMENT_COLORS = ["#3b82f6", "#f97316", "#64748b"];

// Recharts tooltip style that respects the current CSS theme (light + dark)
const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  color: "hsl(var(--card-foreground))",
  fontSize: 12,
} as const;
const tooltipItemStyle = { color: "hsl(var(--card-foreground))" } as const;
const tooltipLabelStyle = { color: "hsl(var(--card-foreground))", fontWeight: 600, marginBottom: 4 } as const;

const STATUS_GROUPS = {
  noPrazo: ["no prazo", "on time", "entregue em dia", "chegou", "ok", "dia"],
  atrasado: ["atrasado", "entregue atrasado", "crítico", "critico", "verificar aéreo", "verificar aereo", "late"],
  emAndamento: ["em produção", "em producao", "em viagem", "aguardando embarque", "em desembaraço", "em desembaraco", "estoque", "em andamento", "in transit"],
};

function classifyStatus(status: string | null): "noPrazo" | "atrasado" | "emAndamento" | "outro" {
  if (typeof status !== "string") return "outro";
  const s = status.trim().toLowerCase();
  if (!s) return "outro";
  if (STATUS_GROUPS.noPrazo.includes(s)) return "noPrazo";
  if (STATUS_GROUPS.atrasado.includes(s)) return "atrasado";
  if (STATUS_GROUPS.emAndamento.includes(s)) return "emAndamento";
  return "outro";
}

function classifyShipment(value: string | null): "Marítimo" | "Aéreo" | "Outro" {
  if (typeof value !== "string") return "Outro";
  const s = value.trim().toLowerCase();
  if (!s) return "Outro";
  if (s.includes("mar")) return "Marítimo";
  if (s.includes("aer") || s.includes("aér") || s.includes("air")) return "Aéreo";
  return "Outro";
}

// Parse dates like "dd/mm/yyyy", "yyyy-mm-dd" or ISO; returns "yyyy-MM" or null
function parseMonthKey(value: string | null): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const y = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${y}-${br[2].padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return null;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[Number(m) - 1] ?? m}/${y.slice(-2)}`;
}

async function fetchAllCategoriesSummary(): Promise<PedidoSummary[]> {
  const all: PedidoSummary[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("pedidos")
      .select("categoria,status_fornecedor,status_compra_venda,fornecedor,cliente,preco_venda,preco_compra,qty_venda,qty_compra,po,embarque,prazo_cliente,emissao_pedido_sistema")
      .range(from, from + pageSize - 1);
    if (error) throw new Error("Erro ao carregar dados consolidados.");
    if (!data || data.length === 0) break;
    all.push(...(data as PedidoSummary[]));
    if (data.length < pageSize) break;
  }
  return all;
}

type ReportDimension = "mes" | "fornecedor" | "cliente" | "po";

const Geral = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["pedidos-geral-summary"],
    queryFn: fetchAllCategoriesSummary,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
  });

  const [reportDim, setReportDim] = useState<ReportDimension>("mes");

  const report = useMemo(() => {
    const rows = data ?? [];
    const map = new Map<string, { registros: number; pos: Set<string>; valorCompra: number; valorVenda: number }>();

    rows.forEach((r) => {
      let key: string | null = null;
      if (reportDim === "mes") {
        key = parseMonthKey(r.emissao_pedido_sistema) ?? parseMonthKey(r.prazo_cliente);
      } else if (reportDim === "fornecedor") {
        key = r.fornecedor;
      } else if (reportDim === "cliente") {
        key = r.cliente;
      } else if (reportDim === "po") {
        key = r.po;
      }
      if (!key) return;
      if (!map.has(key)) map.set(key, { registros: 0, pos: new Set(), valorCompra: 0, valorVenda: 0 });
      const acc = map.get(key)!;
      acc.registros += 1;
      if (r.po) acc.pos.add(r.po);
      const qVenda = Number(r.qty_venda) || 0;
      const qCompra = Number(r.qty_compra) || 0;
      const pVenda = Number(r.preco_venda) || 0;
      const pCompra = Number(r.preco_compra) || 0;
      const qCompraEff = qCompra > 0 ? qCompra : 1;
      acc.valorCompra += pCompra * qCompraEff;
      acc.valorVenda += pVenda * qVenda;
    });

    return Array.from(map.entries())
      .map(([key, v]) => ({
        chave: reportDim === "mes" ? monthLabel(key) : key,
        rawKey: key,
        registros: v.registros,
        pos: v.pos.size,
        valorCompra: v.valorCompra,
        valorVenda: v.valorVenda,
      }))
      .sort((a, b) => {
        if (reportDim === "mes") return a.rawKey.localeCompare(b.rawKey);
        return b.valorCompra - a.valorCompra;
      });
  }, [data, reportDim]);

  const downloadReportCsv = () => {
    const headers = [
      reportDim === "mes" ? "Mês" : reportDim === "fornecedor" ? "Fornecedor" : reportDim === "cliente" ? "Cliente" : "PO",
      "Registros",
      "POs Únicas",
      "Valor de Compra (USD)",
      "Valor de Venda (R$)",
    ];
    const csv = [
      headers.join(";"),
      ...report.map((r) =>
        [
          `"${(r.chave ?? "").toString().replace(/"/g, '""')}"`,
          r.registros,
          r.pos,
          r.valorCompra.toFixed(2).replace(".", ","),
          r.valorVenda.toFixed(2).replace(".", ","),
        ].join(";"),
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${reportDim}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    const rows = data ?? [];

    const byCategory = new Map<string, {
      total: number;
      valorCompra: number;
      valorVenda: number;
      pos: Set<string>;
      fornecedores: Set<string>;
      noPrazo: number;
      atrasado: number;
      emAndamento: number;
      outro: number;
    }>();

    const monthly = new Map<string, { compras: number; vendas: number }>();
    const shipments = new Map<string, number>();

    rows.forEach((r) => {
      const cat = r.categoria === "Tubos" ? "Tubos" : r.categoria === "Válvulas" ? "Válvulas" : "Conexões";
      if (!byCategory.has(cat)) {
        byCategory.set(cat, { total: 0, valorCompra: 0, valorVenda: 0, pos: new Set(), fornecedores: new Set(), noPrazo: 0, atrasado: 0, emAndamento: 0, outro: 0 });
      }
      const acc = byCategory.get(cat)!;
      acc.total += 1;
      const qVenda = Number(r.qty_venda) || 0;
      const qCompra = Number(r.qty_compra) || 0;
      const pVenda = Number(r.preco_venda) || 0;
      const pCompra = Number(r.preco_compra) || 0;
      // Fallback: usa qty_venda se qty_compra estiver vazio (caso de Tubos)
      const qCompraEff = qCompra > 0 ? qCompra : 1;
      acc.valorCompra += pCompra * qCompraEff;
      acc.valorVenda += pVenda * qVenda;
      if (r.po) acc.pos.add(r.po);
      if (r.fornecedor) acc.fornecedores.add(r.fornecedor);

      const klass = classifyStatus(r.status_fornecedor);
      acc[klass] += 1;

      const monthKey = parseMonthKey(r.emissao_pedido_sistema) ?? parseMonthKey(r.prazo_cliente);
      if (monthKey) {
        if (!monthly.has(monthKey)) monthly.set(monthKey, { compras: 0, vendas: 0 });
        const m = monthly.get(monthKey)!;
        m.compras += pCompra * qCompraEff;
        m.vendas += pVenda * qVenda;
      }

      const ship = classifyShipment(r.embarque);
      shipments.set(ship, (shipments.get(ship) ?? 0) + 1);
    });

    const volumeByCategory = Array.from(byCategory.entries()).map(([cat, v]) => ({
      categoria: cat,
      registros: v.total,
      pos: v.pos.size,
      fornecedores: v.fornecedores.size,
      valorCompra: v.valorCompra,
      valorVenda: v.valorVenda,
    }));

    const performanceByCategory = Array.from(byCategory.entries()).map(([cat, v]) => {
      const denom = v.noPrazo + v.atrasado + v.emAndamento + v.outro || 1;
      return {
        categoria: cat,
        "No Prazo": Math.round((v.noPrazo / denom) * 100),
        Atrasado: Math.round((v.atrasado / denom) * 100),
        "Em Andamento": Math.round((v.emAndamento / denom) * 100),
      };
    });

    const monthlySeries = Array.from(monthly.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, v]) => ({ mes: monthLabel(key), Compras: Math.round(v.compras), Vendas: Math.round(v.vendas) }));

    // Always show Marítimo and Aéreo even when count is 0; hide Outro if empty
    const shipmentSeries = (["Marítimo", "Aéreo", "Outro"] as const)
      .map((nome) => ({ nome, valor: shipments.get(nome) ?? 0 }))
      .filter(({ nome, valor }) => nome !== "Outro" || valor > 0);

    const totals = {
      itens: rows.length,
      pos: new Set(rows.filter((r) => r.po).map((r) => r.po!)).size,
      fornecedores: new Set(rows.filter((r) => r.fornecedor).map((r) => r.fornecedor!)).size,
      valorCompra: volumeByCategory.reduce((s, v) => s + v.valorCompra, 0),
      valorVenda: volumeByCategory.reduce((s, v) => s + v.valorVenda, 0),
    };

    return { volumeByCategory, performanceByCategory, monthlySeries, shipmentSeries, totals };
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <HeaderTabs />
        <main className="mx-auto max-w-[1600px] p-6">
          <DashboardLoadingSkeleton />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <HeaderTabs />
        <main className="mx-auto max-w-[1600px] p-6">
          <DashboardErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        </main>
      </div>
    );
  }

  const formatBRL = (v: number) =>
    `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

  const formatUSD = (v: number) =>
    `$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

  const kpis = [
    { label: "Total de POs", value: stats.totals.pos.toLocaleString("pt-BR"), icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { label: "Valor Total de Compra", value: formatUSD(stats.totals.valorCompra), icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "Valor Total de Venda", value: formatBRL(stats.totals.valorVenda), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Total de Itens", value: stats.totals.itens.toLocaleString("pt-BR"), icon: Package, color: "text-amber-600", bg: "bg-amber-500/10" },
    { label: "Total de Fornecedores", value: stats.totals.fornecedores.toLocaleString("pt-BR"), icon: Users, color: "text-fuchsia-600", bg: "bg-fuchsia-500/10" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <HeaderTabs />
      <main className="mx-auto max-w-[1600px] p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            Visão Geral Consolidada
          </h2>
          <p className="text-sm text-muted-foreground">
            Comparativo entre Conexões, Tubos e Válvulas
          </p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm card-lift">
                <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-primary/80 to-primary/30" />
                <div className="flex items-center gap-4 p-5 pt-6">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${k.bg}`}>
                    <Icon className={`h-5 w-5 ${k.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-bold leading-tight break-words num">{k.value}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground font-medium leading-snug">{k.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Volume + Distribuições de Valor */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Volume por Categoria (Registros & POs)</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.volumeByCategory}>
                  <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="categoria" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
                  <Bar dataKey="registros" name="Registros" radius={[6, 6, 0, 0]}>
                    {stats.volumeByCategory.map((entry) => (
                      <Cell key={`reg-${entry.categoria}`} fill={CATEGORY_COLORS[entry.categoria] || "#64748b"} />
                    ))}
                  </Bar>
                  <Bar dataKey="pos" name="POs Únicas" radius={[6, 6, 0, 0]}>
                    {stats.volumeByCategory.map((entry) => (
                      <Cell key={`pos-${entry.categoria}`} fill={CATEGORY_COLORS[entry.categoria] || "#64748b"} fillOpacity={0.45} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição de Valor por Categoria (Compra $)</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.volumeByCategory}
                    dataKey="valorCompra"
                    nameKey="categoria"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    strokeWidth={0}
                    label={(e: { categoria: string; valorCompra: number }) => `${e.categoria}: ${formatUSD(e.valorCompra)}`}
                    labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                  >
                    {stats.volumeByCategory.map((entry) => (
                      <Cell key={entry.categoria} fill={CATEGORY_COLORS[entry.categoria] || "#64748b"} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatUSD(v)}
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição de Valor por Categoria (Venda R$)</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.volumeByCategory}
                    dataKey="valorVenda"
                    nameKey="categoria"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    strokeWidth={0}
                    label={(e: { categoria: string; valorVenda: number }) => `${e.categoria}: ${formatBRL(e.valorVenda)}`}
                    labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                  >
                    {stats.volumeByCategory.map((entry) => (
                      <Cell key={entry.categoria} fill={CATEGORY_COLORS[entry.categoria] || "#64748b"} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatBRL(v)}
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Desempenho de Prazos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Desempenho de Prazos por Categoria (Status do Fornecedor)</CardTitle>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.performanceByCategory}>
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="categoria" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  formatter={(v: number) => `${v}%`}
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
                <Bar dataKey="No Prazo" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Em Andamento" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Atrasado" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Vendas vs Compras + Tipos de Embarque */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Vendas vs Compras por Mês</CardTitle>
            </CardHeader>
            <CardContent className="h-[340px]">
              {stats.monthlySeries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados de datas para gerar a série mensal.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.monthlySeries}>
                    <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${((v as number) / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v: number) => formatBRL(v)}
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
                    <Line type="monotone" dataKey="Vendas" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }} />
                    <Line type="monotone" dataKey="Compras" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tipos de Embarque</CardTitle>
            </CardHeader>
            <CardContent className="h-[340px] flex flex-col justify-center">
              {stats.shipmentSeries.every((s) => s.valor === 0) ? (
                <p className="text-sm text-muted-foreground">Sem dados de embarque.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.shipmentSeries}
                    layout="vertical"
                    margin={{ top: 16, right: 48, left: 8, bottom: 16 }}
                  >
                    <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" strokeOpacity={0.4} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="nome"
                      tick={{ fontSize: 12, fill: "hsl(var(--foreground))", fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={82}
                    />
                    <Tooltip
                      formatter={(v: number) => [v, "Pedidos"]}
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar dataKey="valor" name="Pedidos" radius={[0, 6, 6, 0]} maxBarSize={48}>
                      {stats.shipmentSeries.map((entry, i) => (
                        <Cell key={entry.nome} fill={SHIPMENT_COLORS[i % SHIPMENT_COLORS.length]} />
                      ))}
                      <LabelList
                        dataKey="valor"
                        position="right"
                        style={{ fontSize: 13, fontWeight: 700, fill: "hsl(var(--foreground))" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Relatório por dimensão */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Relatório por Dimensão
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Agrupe os dados por mês, fornecedor, cliente ou PO e exporte em CSV.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={reportDim} onValueChange={(v) => setReportDim(v as ReportDimension)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mes">Por Mês</SelectItem>
                    <SelectItem value="fornecedor">Por Fornecedor</SelectItem>
                    <SelectItem value="cliente">Por Cliente</SelectItem>
                    <SelectItem value="po">Por PO</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={downloadReportCsv} disabled={report.length === 0}>
                  <Download className="h-4 w-4 mr-2" /> Baixar CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {report.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhum dado disponível para esta dimensão.
              </p>
            ) : (
              <div className="overflow-auto rounded-lg border max-h-[500px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">
                        {reportDim === "mes" ? "Mês" : reportDim === "fornecedor" ? "Fornecedor" : reportDim === "cliente" ? "Cliente" : "PO"}
                      </th>
                      <th className="text-right px-3 py-2 font-semibold">Registros</th>
                      <th className="text-right px-3 py-2 font-semibold">POs Únicas</th>
                      <th className="text-right px-3 py-2 font-semibold">Valor Compra (USD)</th>
                      <th className="text-right px-3 py-2 font-semibold">Valor Venda (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.slice(0, 200).map((r) => (
                      <tr key={r.rawKey} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap font-medium">{r.chave}</td>
                        <td className="px-3 py-2 text-right">{r.registros}</td>
                        <td className="px-3 py-2 text-right">{r.pos}</td>
                        <td className="px-3 py-2 text-right">{formatUSD(r.valorCompra)}</td>
                        <td className="px-3 py-2 text-right">{formatBRL(r.valorVenda)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.length > 200 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Mostrando 200 de {report.length} resultados — baixe o CSV para ver todos.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Geral;
