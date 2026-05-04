import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ship } from "lucide-react";

interface OrderData {
  embarque: string | null;
  [key: string]: unknown;
}

function classifyShipment(embarque: string | null): string {
  if (!embarque) return "Não definido";
  const lower = embarque.toLowerCase();
  if (lower.includes("aéreo") || lower.includes("aereo") || lower.includes("air")) return "Aéreo";
  if (lower.includes("marítimo") || lower.includes("maritimo") || lower.includes("sea") || lower.includes("navio") || lower.includes("ocean")) return "Marítimo";
  return "Outro";
}

const COLORS: Record<string, string> = {
  "Aéreo": "hsl(var(--status-verificar))",
  "Marítimo": "hsl(var(--status-chegou))",
  "Outro": "hsl(var(--muted-foreground))",
  "Não definido": "hsl(var(--border))",
};

export function ShipmentTypeChart({ data }: { data: OrderData[] }) {
  const chartData = useMemo(() => {
    const posByType: Record<string, Set<string>> = {};
    data.forEach((d) => {
      const type = classifyShipment(d.embarque);
      if (!posByType[type]) posByType[type] = new Set();
      if (d.po) posByType[type].add(d.po as string);
    });

    return Object.entries(posByType)
      .map(([name, poSet]) => ({ name, value: poSet.size }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data]);

  if (chartData.length === 0) return null;

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Ship className="h-4 w-4" />
          Tipo de Embarque (POs)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name] || "hsl(var(--muted-foreground))"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                color: "hsl(var(--card-foreground))",
                fontSize: 12,
              }}
              itemStyle={{ color: "hsl(var(--card-foreground))" }}
              labelStyle={{ color: "hsl(var(--card-foreground))", fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
