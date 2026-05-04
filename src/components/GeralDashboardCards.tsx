import { useMemo } from "react";
import {
  AlertTriangle, CheckCircle, DollarSign,
  Plane, Ship, TrendingUp,
} from "lucide-react";

interface OrderData {
  statusCompraVenda: string | null;
  statusFornecedor: string | null;
  precoVenda: number | null;
  precoCompra: number | null;
  qtyVenda: number | null;
  qtyCompra: number | null;
  embarque: string | null;
  po: string | null;
  [key: string]: unknown;
}

function formatBRL(v: number | null | undefined) {
  const num = v ?? 0;
  return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUSD(v: number | null | undefined) {
  const num = v ?? 0;
  return `$ ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  icon: React.ElementType;
  accent: string;
  iconColor: string;
  iconBg: string;
  borderColor: string;
  bgFrom: string;
  isLarge?: boolean;
}

function MetricCard({
  label, value, subLabel, icon: Icon,
  accent, iconColor, iconBg, borderColor, bgFrom, isLarge,
}: MetricCardProps) {
  return (
    <div className={`relative overflow-hidden rounded-xl border ${borderColor} bg-gradient-to-br ${bgFrom} via-card to-card shadow-sm card-lift`}>
      <div className={`absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r ${accent}`} />
      <div className="flex items-center justify-between gap-3 p-4 pt-5">
        <div className="min-w-0">
          <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${iconColor} opacity-70`}>
            {label}
          </p>
          <p className={`font-bold leading-none num ${isLarge ? "text-3xl" : "text-base"} truncate text-foreground`}>
            {typeof value === "number" ? value : value}
          </p>
          {subLabel && (
            <p className="mt-0.5 text-[10px] text-muted-foreground/70">{subLabel}</p>
          )}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

export function GeralDashboardCards({ data }: { data: OrderData[] }) {
  const metrics = useMemo(() => {
    let valorVenda = 0;
    let valorCompra = 0;
    let embarqueAereo = 0;
    let embarqueMaritimo = 0;

    const poAtrasadas = new Set<string>();
    const poNoPrazo = new Set<string>();

    data.forEach((d) => {
      if (d.precoVenda != null) valorVenda += d.precoVenda * (d.qtyVenda ?? 1);
      if (d.precoCompra != null) valorCompra += d.precoCompra * (d.qtyCompra ?? 1);

      const embarque = (d.embarque || "").toUpperCase();
      if (embarque.includes("AER") || embarque.includes("AÉREO")) embarqueAereo++;
      else if (embarque.includes("MAR") || embarque.includes("MARÍTIMO")) embarqueMaritimo++;

      const status = (d.statusCompraVenda || "").toUpperCase();
      const statusForn = (d.statusFornecedor || "").toUpperCase();
      const po = d.po;
      if (po) {
        if (status.includes("ATRASADO") || status.includes("CRÍTICO") || statusForn.includes("ATRASADO")) {
          poAtrasadas.add(po as string);
        } else if (
          status.includes("NO PRAZO") || status.includes("CHEGOU") ||
          status.includes("ESTOQUE") || status.includes("DIA")
        ) {
          poNoPrazo.add(po as string);
        }
      }
    });

    return { valorVenda, valorCompra, embarqueAereo, embarqueMaritimo, poAtrasadas: poAtrasadas.size, poNoPrazo: poNoPrazo.size };
  }, [data]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
      <MetricCard
        label="POs Atrasadas"
        value={metrics.poAtrasadas}
        icon={AlertTriangle}
        accent="from-red-500 to-rose-600"
        iconColor="text-red-500"
        iconBg="bg-red-500/10"
        borderColor="border-red-500/20"
        bgFrom="from-red-500/5"
        isLarge
      />
      <MetricCard
        label="POs no Prazo"
        value={metrics.poNoPrazo}
        icon={CheckCircle}
        accent="from-emerald-500 to-teal-500"
        iconColor="text-emerald-500"
        iconBg="bg-emerald-500/10"
        borderColor="border-emerald-500/20"
        bgFrom="from-emerald-500/5"
        isLarge
      />
      <MetricCard
        label="Total Venda"
        value={formatBRL(metrics.valorVenda)}
        icon={TrendingUp}
        accent="from-emerald-500 to-teal-500"
        iconColor="text-emerald-500"
        iconBg="bg-emerald-500/10"
        borderColor="border-emerald-500/20"
        bgFrom="from-emerald-500/5"
      />
      <MetricCard
        label="Total Compra"
        value={formatUSD(metrics.valorCompra)}
        icon={DollarSign}
        accent="from-blue-500 to-indigo-500"
        iconColor="text-blue-500"
        iconBg="bg-blue-500/10"
        borderColor="border-blue-500/20"
        bgFrom="from-blue-500/5"
      />
      <MetricCard
        label="Aéreo (Itens)"
        value={metrics.embarqueAereo}
        icon={Plane}
        accent="from-amber-400 to-yellow-500"
        iconColor="text-amber-500"
        iconBg="bg-amber-500/10"
        borderColor="border-amber-500/20"
        bgFrom="from-amber-500/5"
        isLarge
      />
      <MetricCard
        label="Marítimo (Itens)"
        value={metrics.embarqueMaritimo}
        icon={Ship}
        accent="from-cyan-500 to-sky-500"
        iconColor="text-cyan-500"
        iconBg="bg-cyan-500/10"
        borderColor="border-cyan-500/20"
        bgFrom="from-cyan-500/5"
        isLarge
      />
    </div>
  );
}
