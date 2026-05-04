import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface OrderData {
  statusFornecedor: string | null;
  [key: string]: unknown;
}

const PALETTE: Record<string, string> = {
  "On time":  "#10b981",
  "Atrasado": "#ef4444",
};

const FALLBACK_COLORS = ["#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#64748b"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-xl p-3 text-xs min-w-[130px]">
      <div className="flex items-center gap-2 mb-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.payload.fill }} />
        <span className="font-semibold text-foreground">{p.name}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Qtd</span>
        <span className="font-bold text-foreground num">{p.value}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">%</span>
        <span className="font-semibold text-foreground num">
          {((p.value / p.payload.total) * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export function FornecedorPieChart({ data }: { data: OrderData[] }) {
  const { chartData, total } = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach((d) => {
      const s = d.statusFornecedor || "N/A";
      counts[s] = (counts[s] || 0) + 1;
    });
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    const items = Object.entries(counts).map(([name, value], i) => ({
      name,
      value,
      total,
      fill: PALETTE[name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    }));
    return { chartData: items, total };
  }, [data]);

  const hasData = chartData.length > 0 && !(chartData.length === 1 && chartData[0].name === "N/A");

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-emerald-500 to-teal-400" />
      <div className="p-5 pb-2">
        <h3 className="text-sm font-semibold">Status Fornecedor</h3>
      </div>
      <div className="px-4 pb-5">
        {!hasData ? (
          <div className="flex items-center justify-center h-[240px]">
            <p className="text-sm text-muted-foreground">Sem dados de fornecedores</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Custom legend */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-1">
              {chartData.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: item.fill }} />
                  <span className="text-[11px] text-muted-foreground">
                    {item.name}
                    <span className="ml-1 font-semibold text-foreground num">{item.value}</span>
                  </span>
                </div>
              ))}
              <div className="w-full text-center mt-1">
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">
                  Total: <span className="font-bold text-foreground num">{total}</span>
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
