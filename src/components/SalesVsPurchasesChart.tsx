import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
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

function formatBRL(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function formatUSD(v: number) {
  return `$ ${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-xl p-3 text-xs min-w-[170px]">
      <p className="font-semibold text-foreground mb-2 pb-1.5 border-b border-border/40">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mt-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.stroke }} />
            <span className="text-muted-foreground">{p.dataKey === "vendas" ? "Vendas" : "Compras"}</span>
          </div>
          <span className="font-semibold text-foreground num">
            {p.dataKey === "vendas" ? formatBRL(p.value) : formatUSD(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SalesVsPurchasesChart({ data }: { data: PedidoRow[] }) {
  const chartData = useMemo(() => {
    const monthMap = new Map<string, { vendas: number; compras: number; label: string; order: string }>();
    data.forEach((d) => {
      const date = parseDate(d.chegadaHci);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = `${MONTH_NAMES[date.getMonth()].slice(0, 3)}/${date.getFullYear().toString().slice(-2)}`;
      if (!monthMap.has(key)) monthMap.set(key, { vendas: 0, compras: 0, label, order: key });
      const entry = monthMap.get(key)!;
      if (d.precoVenda != null) entry.vendas += d.precoVenda * (d.qtyVenda ?? 1);
      if (d.precoCompra != null) entry.compras += d.precoCompra * (d.qtyCompra ?? d.qtyVenda ?? 1);
    });
    return Array.from(monthMap.values()).sort((a, b) => a.order.localeCompare(b.order));
  }, [data]);

  if (chartData.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm h-full">
      <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-emerald-500 via-blue-500 to-indigo-500" />
      <div className="p-5 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-semibold">Vendas vs Compras por Mês</h3>
        </div>
      </div>
      <div className="px-2 pb-4">
        <ResponsiveContainer width="100%" height={270}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-vendas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-compras" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="hsl(var(--border))"
              strokeOpacity={0.5}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${((v as number) / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(value) => (
                <span style={{ color: "hsl(var(--muted-foreground))" }}>
                  {value === "vendas" ? "Vendas (R$)" : "Compras ($)"}
                </span>
              )}
            />
            <Area
              type="monotone"
              dataKey="vendas"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#grad-vendas)"
              dot={false}
              activeDot={{ r: 5, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
              name="vendas"
            />
            <Area
              type="monotone"
              dataKey="compras"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#grad-compras)"
              dot={false}
              activeDot={{ r: 5, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
              name="compras"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
