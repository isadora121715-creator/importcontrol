import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OrderData {
  statusFornecedor: string | null;
  [key: string]: unknown;
}

export function FornecedorPieChart({ data }: { data: OrderData[] }) {
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach((d) => {
      const s = d.statusFornecedor || "N/A";
      counts[s] = (counts[s] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [data]);

  const colors: Record<string, string> = {
    "On time": "hsl(var(--status-on-time))",
    "Atrasado": "hsl(var(--status-atrasado))",
  };

  const hasData = chartData.length > 0 && !(chartData.length === 1 && chartData[0].name === "N/A");

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Status Fornecedor</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex items-center justify-center h-[280px]">
            <p className="text-sm text-muted-foreground">Sem dados de fornecedores</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={colors[entry.name] || "hsl(var(--muted-foreground))"} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
