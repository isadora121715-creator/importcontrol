import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, Package, Users, ShoppingCart, DollarSign, FileText } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { DashboardLoadingSkeleton, DashboardErrorState } from "@/components/dashboard/DashboardStates";

type PedidoSummary = {
  categoria: string | null;
  status_fornecedor: string | null;
  status_compra_venda: string | null;
  fornecedor: string | null;
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
  Conexões: "hsl(var(--primary))",
  Tubos: "hsl(217 91% 60%)",
  Válvulas: "hsl(38 92% 50%)",
};

const SHIPMENT_COLORS = ["hsl(217 91% 60%)", "hsl(38 92% 50%)", "hsl(var(--muted-foreground))"];

const STATUS_GROUPS = {
  noPrazo: ["no prazo", "entregue em dia", "chegou", "ok"],
  atrasado: ["atrasado", "entregue atrasado", "crítico", "critico", "verificar aéreo", "verificar aereo"],
  emAndamento: ["em produção", "em producao", "em viagem", "aguardando embarque", "em desembaraço", "em desembaraco", "estoque", "em andamento"],
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
      .select("categoria,status_fornecedor,status_compra_venda,fornecedor,preco_venda,preco_compra,qty_venda,qty_compra,po,embarque,prazo_cliente,emissao_pedido_sistema")
      .range(from, from + pageSize - 1);
    if (error) throw new Error("Erro ao carregar dados consolidados.");
    if (!data || data.length === 0) break;
    all.push(...(data as PedidoSummary[]));
    if (data.length < pageSize) break;
  }
  return all;
}

const Geral = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["pedidos-geral-summary"],
    queryFn: fetchAllCategoriesSummary,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
  });

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
      acc.valorCompra += pCompra * qCompra;
      acc.valorVenda += pVenda * qVenda;
      if (r.po) acc.pos.add(r.po);
      if (r.fornecedor) acc.fornecedores.add(r.fornecedor);

      const klass = classifyStatus(r.status_fornecedor);
      acc[klass] += 1;

      const monthKey = parseMonthKey(r.emissao_pedido_sistema) ?? parseMonthKey(r.prazo_cliente);
      if (monthKey) {
        if (!monthly.has(monthKey)) monthly.set(monthKey, { compras: 0, vendas: 0 });
        const m = monthly.get(monthKey)!;
        m.compras += pCompra * qCompra;
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

    const shipmentSeries = Array.from(shipments.entries())
      .filter(([k]) => k !== "Outro" || (shipments.get("Outro") ?? 0) > 0)
      .map(([nome, valor]) => ({ nome, valor }));

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

  const kpis = [
    { label: "Total de POs", value: stats.totals.pos.toLocaleString("pt-BR"), icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { label: "Valor Total de Compra", value: formatBRL(stats.totals.valorCompra), icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-500/10" },
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
              <Card key={k.label} className="border-none shadow-sm">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${k.bg}`}>
                    <Icon className={`h-6 w-6 ${k.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold leading-none truncate">{k.value}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{k.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Volume + Distribuição de Valor */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Volume por Categoria (Registros & POs)</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.volumeByCategory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="categoria" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="registros" name="Registros" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="pos" name="POs Únicas" fill="hsl(217 91% 60%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição de Valor por Categoria (Compra)</CardTitle>
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
                    outerRadius={110}
                    label={(e: { categoria: string; valorCompra: number }) => `${e.categoria}: ${formatBRL(e.valorCompra)}`}
                  >
                    {stats.volumeByCategory.map((entry) => (
                      <Cell key={entry.categoria} fill={CATEGORY_COLORS[entry.categoria] || "hsl(var(--muted-foreground))"} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatBRL(v)}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
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
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="categoria" className="text-xs" />
                <YAxis className="text-xs" unit="%" />
                <Tooltip
                  formatter={(v: number) => `${v}%`}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Legend />
                <Bar dataKey="No Prazo" stackId="a" fill="hsl(142 71% 45%)" />
                <Bar dataKey="Em Andamento" stackId="a" fill="hsl(217 91% 60%)" />
                <Bar dataKey="Atrasado" stackId="a" fill="hsl(0 84% 60%)" />
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
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="mes" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `R$ ${(v / 1000).toLocaleString("pt-BR")}k`} />
                    <Tooltip
                      formatter={(v: number) => formatBRL(v)}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="Vendas" stroke="hsl(142 71% 45%)" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Compras" stroke="hsl(217 91% 60%)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tipos de Embarque</CardTitle>
            </CardHeader>
            <CardContent className="h-[340px]">
              {stats.shipmentSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados de embarque.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.shipmentSeries}
                      dataKey="valor"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      label={(e: { nome: string; valor: number }) => `${e.nome}: ${e.valor}`}
                    >
                      {stats.shipmentSeries.map((entry, i) => (
                        <Cell key={entry.nome} fill={SHIPMENT_COLORS[i % SHIPMENT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Geral;
