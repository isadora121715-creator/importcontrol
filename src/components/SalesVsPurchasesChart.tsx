import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function formatBRL(v: number | null | undefined) {
  const num = v ?? 0;
  return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUSD(v: number | null | undefined) {
  const num = v ?? 0;
  return `$ ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function SalesVsPurchasesChart({ data }: { data: PedidoRow[] }) {
  const monthlyChartData = useMemo(() => {
    const monthMap = new Map<string, { vendas: number; compras: number; label: string; order: string }>();

    data.forEach((d) => {
      const date = parseDate(d.chegadaHci);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = `${MONTH_NAMES[date.getMonth()].slice(0, 3)}/${date.getFullYear().toString().slice(-2)}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, { vendas: 0, compras: 0, label, order: key });
      }
      const entry = monthMap.get(key)!;
      if (d.precoVenda != null) entry.vendas += d.precoVenda * (d.qtyVenda ?? 1);
      if (d.precoCompra != null) entry.compras += d.precoCompra * (d.qtyCompra ?? d.qtyVenda ?? 1);
    });

    return Array.from(monthMap.values()).sort((a, b) => a.order.localeCompare(b.order));
  }, [data]);

  if (monthlyChartData.length === 0) return null;

  return (
    <Card className="border-none shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Vendas vs Compras por Mês
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={monthlyChartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v != null ? (v / 1000).toFixed(0) : 0)}k`} />
            <Tooltip
              formatter={(value: number, name: string) => [
                name === "vendas" ? formatBRL(value) : formatUSD(value),
                name === "vendas" ? "Vendas (R$)" : "Compras ($)",
              ]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line type="monotone" dataKey="vendas" stroke="hsl(145, 63%, 42%)" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} name="vendas" />
            <Line type="monotone" dataKey="compras" stroke="hsl(0, 72%, 51%)" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} name="compras" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
