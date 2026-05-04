import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { BarChart2 } from "lucide-react";

interface OrderData {
  fornecedor: string | null;
  statusCompraVenda: string | null;
  statusFornecedor: string | null;
  po: string | null;
  [key: string]: unknown;
}

const STATUS_KEYS = ["No prazo", "Atrasado", "Crítico", "Chegou", "Estoque", "Verificar aéreo"] as const;

const STATUS_COLORS: Record<string, string> = {
  "No prazo":        "#10b981",
  "Atrasado":        "#ef4444",
  "Crítico":         "#f97316",
  "Chegou":          "#3b82f6",
  "Estoque":         "#64748b",
  "Verificar aéreo": "#f59e0b",
};

interface Props {
  data: OrderData[];
  onStatusClick?: (status: string) => void;
  activeStatus?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p: any) => p.value > 0);
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-xl p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-foreground mb-2 pb-1.5 border-b border-border/40 truncate">{label}</p>
      {items.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 mt-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: p.fill }} />
            <span className="text-muted-foreground">{p.dataKey}</span>
          </div>
          <span className="font-bold text-foreground num">{p.value}</span>
        </div>
      ))}
    </div>
  );
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
      "No prazo":        statuses["No prazo"]        || 0,
      "Atrasado":        statuses["Atrasado"]        || 0,
      "Crítico":         statuses["Crítico"]         || 0,
      "Chegou":          statuses["Chegou"]          || 0,
      "Estoque":         statuses["Estoque"]         || 0,
      "Verificar aéreo": statuses["Verificar aéreo"] || 0,
    }));
  }, [data]);

  const handleBarClick = (status: string) => {
    if (onStatusClick) onStatusClick(activeStatus === status ? "all" : status);
  };

  const isEmpty =
    chartData.length === 0 || (chartData.length === 1 && chartData[0].fornecedor === "N/A");

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-blue-500 to-indigo-500" />
      <div className="p-5 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
              <BarChart2 className="h-4 w-4 text-blue-500" />
            </div>
            <h3 className="text-sm font-semibold">Status Compra/Venda por Fornecedor</h3>
          </div>
          {activeStatus && activeStatus !== "all" && (
            <button
              onClick={() => onStatusClick?.("all")}
              className="text-xs text-primary hover:underline whitespace-nowrap"
            >
              Limpar seleção
            </button>
          )}
        </div>
        {activeStatus && activeStatus !== "all" && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Filtrando: <span className="font-semibold text-foreground">{activeStatus}</span>
          </p>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          Clique na legenda para filtrar o dashboard
        </p>
      </div>
      <div className="px-2 pb-4">
        {isEmpty ? (
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-sm text-muted-foreground">Sem dados de fornecedores</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="4 4"
                stroke="hsl(var(--border))"
                strokeOpacity={0.5}
                vertical={false}
              />
              <XAxis
                dataKey="fornecedor"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
              <Legend
                iconType="square"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, cursor: "pointer", paddingTop: 8 }}
                onClick={(e: any) => { if (e?.value) handleBarClick(e.value); }}
                formatter={(value: string) => (
                  <span
                    style={{
                      color: "hsl(var(--muted-foreground))",
                      textDecoration: activeStatus === value ? "underline" : "none",
                      fontWeight: activeStatus === value ? 700 : 400,
                      opacity: activeStatus && activeStatus !== "all" && activeStatus !== value ? 0.35 : 1,
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
                  opacity={activeStatus && activeStatus !== "all" && activeStatus !== status ? 0.15 : 1}
                  radius={i === STATUS_KEYS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
