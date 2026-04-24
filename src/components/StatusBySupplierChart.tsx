import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OrderData {
  fornecedor: string | null;
  statusCompraVenda: string | null;
  statusFornecedor: string | null;
  po: string | null;
  [key: string]: unknown;
}

const STATUS_KEYS = ["No prazo", "Atrasado", "Crítico", "Chegou", "Estoque", "Verificar aéreo"] as const;
const STATUS_COLORS: Record<string, string> = {
  "No prazo": "hsl(var(--status-no-prazo))",
  "Atrasado": "hsl(var(--status-atrasado))",
  "Crítico": "hsl(var(--status-critico))",
  "Chegou": "hsl(var(--status-chegou))",
  "Estoque": "hsl(var(--status-estoque))",
  "Verificar aéreo": "hsl(var(--status-verificar))",
};

interface Props {
  data: OrderData[];
  onStatusClick?: (status: string) => void;
  activeStatus?: string | null;
}

export function StatusBySupplierChart({ data, onStatusClick, activeStatus }: Props) {
  const chartData = useMemo(() => {
    const supplierMap: Record<string, Record<string, number>> = {};

    data.forEach((d) => {
      const forn = d.fornecedor || "N/A";
      const status = d.statusCompraVenda || "N/A";
      if (!supplierMap[forn]) supplierMap[forn] = {};
      supplierMap[forn][status] = (supplierMap[forn][status] || 0) + 1;
    });

    return Object.entries(supplierMap).map(([forn, statuses]) => ({
      fornecedor: forn,
      "No prazo": statuses["No prazo"] || 0,
      "Atrasado": statuses["Atrasado"] || 0,
      "Crítico": statuses["Crítico"] || 0,
      "Chegou": statuses["Chegou"] || 0,
      "Estoque": statuses["Estoque"] || 0,
      "Verificar aéreo": statuses["Verificar aéreo"] || 0,
    }));
  }, [data]);

  const handleBarClick = (status: string) => {
    if (onStatusClick) {
      onStatusClick(activeStatus === status ? "all" : status);
    }
  };

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Status Compra/Venda por Fornecedor</CardTitle>
          {activeStatus && activeStatus !== "all" && (
            <button
              onClick={() => onStatusClick?.("all")}
              className="text-xs text-primary hover:underline"
            >
              Limpar seleção
            </button>
          )}
        </div>
        {activeStatus && activeStatus !== "all" && (
          <p className="text-xs text-muted-foreground">
            Filtrando por: <span className="font-semibold text-foreground">{activeStatus}</span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        {chartData.length === 0 || (chartData.length === 1 && chartData[0].fornecedor === "N/A") ? (
          <div className="flex items-center justify-center h-[320px]">
            <p className="text-sm text-muted-foreground">Sem dados de fornecedores</p>
          </div>
        ) : (
        <>
        <p className="mb-2 text-[10px] text-muted-foreground">Clique na legenda para filtrar o dashboard</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="fornecedor" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
            <Legend
              wrapperStyle={{ fontSize: 11, cursor: "pointer" }}
              onClick={(e: any) => {
                if (e && e.value) {
                  handleBarClick(e.value);
                }
              }}
              formatter={(value: string) => (
                <span
                  style={{
                    textDecoration: activeStatus === value ? "underline" : "none",
                    fontWeight: activeStatus === value ? 700 : 400,
                    opacity: activeStatus && activeStatus !== "all" && activeStatus !== value ? 0.4 : 1,
                  }}
                >
                  {value}
                </span>
              )}
            />
            {STATUS_KEYS.map((status, i) => (
              <Bar
                key={status}
                dataKey={status}
                stackId="a"
                fill={STATUS_COLORS[status]}
                opacity={activeStatus && activeStatus !== "all" && activeStatus !== status ? 0.2 : 1}
                radius={i === STATUS_KEYS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        </>
        )}
      </CardContent>
    </Card>
  );
}
