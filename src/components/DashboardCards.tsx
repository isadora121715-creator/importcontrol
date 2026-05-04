import {
  Package, AlertTriangle, CheckCircle, Archive, Plane,
  DollarSign, TrendingUp, ShoppingBag,
} from "lucide-react";
import { useMemo } from "react";

interface OrderData {
  statusCompraVenda: string | null;
  precoVenda: number | null;
  precoCompra: number | null;
  qtyVenda: number | null;
  qtyCompra: number | null;
  [key: string]: unknown;
}

// ── card configs ──────────────────────────────────────────────────────────────

interface CardCfg {
  key: string;
  label: string;
  icon: React.ElementType;
  accent: string;      // tailwind gradient classes  for the top strip
  iconColor: string;
  iconBg: string;
  showPoCount?: boolean;
}

const cardConfigConexoes: CardCfg[] = [
  { key: "No prazo",        label: "No Prazo",     icon: CheckCircle,   accent: "from-emerald-500 to-teal-500",  iconColor: "text-emerald-500",  iconBg: "bg-emerald-500/10",  },
  { key: "Atrasado",        label: "Atrasado",     icon: AlertTriangle, accent: "from-red-500 to-rose-600",      iconColor: "text-red-500",       iconBg: "bg-red-500/10",      },
  { key: "Crítico",         label: "Crítico",      icon: AlertTriangle, accent: "from-orange-500 to-amber-500",  iconColor: "text-orange-500",    iconBg: "bg-orange-500/10",   },
  { key: "Chegou",          label: "Chegou",       icon: Package,       accent: "from-blue-500 to-indigo-500",   iconColor: "text-blue-500",      iconBg: "bg-blue-500/10",     showPoCount: true },
  { key: "Estoque",         label: "Estoque",      icon: Archive,       accent: "from-slate-400 to-slate-500",   iconColor: "text-slate-500",     iconBg: "bg-slate-500/10",    },
  { key: "Verificar aéreo", label: "Verif. Aéreo", icon: Plane,         accent: "from-amber-400 to-yellow-500",  iconColor: "text-amber-500",     iconBg: "bg-amber-500/10",    },
];

const cardConfigValvulas: CardCfg[] = [
  { key: "On time",  label: "No Prazo", icon: CheckCircle,   accent: "from-emerald-500 to-teal-500", iconColor: "text-emerald-500", iconBg: "bg-emerald-500/10" },
  { key: "Atrasado", label: "Atrasado", icon: AlertTriangle, accent: "from-red-500 to-rose-600",     iconColor: "text-red-500",     iconBg: "bg-red-500/10"     },
];

const cardConfigTubos: CardCfg[] = [
  { key: "No prazo",        label: "No Prazo",     icon: CheckCircle,   accent: "from-emerald-500 to-teal-500",  iconColor: "text-emerald-500",  iconBg: "bg-emerald-500/10",  },
  { key: "Atrasado",        label: "Atrasado",     icon: AlertTriangle, accent: "from-red-500 to-rose-600",      iconColor: "text-red-500",       iconBg: "bg-red-500/10",      },
  { key: "Crítico",         label: "Crítico",      icon: AlertTriangle, accent: "from-orange-500 to-amber-500",  iconColor: "text-orange-500",    iconBg: "bg-orange-500/10",   },
  { key: "Chegou",          label: "Chegou",       icon: Package,       accent: "from-blue-500 to-indigo-500",   iconColor: "text-blue-500",      iconBg: "bg-blue-500/10",     showPoCount: true },
  { key: "Estoque",         label: "Estoque",      icon: Archive,       accent: "from-slate-400 to-slate-500",   iconColor: "text-slate-500",     iconBg: "bg-slate-500/10",    },
  { key: "Verificar aéreo", label: "Verif. Aéreo", icon: Plane,         accent: "from-amber-400 to-yellow-500",  iconColor: "text-amber-500",     iconBg: "bg-amber-500/10",    },
];

const cardConfigEmbarques: CardCfg[] = cardConfigTubos;

// ── helpers ───────────────────────────────────────────────────────────────────

function formatUSD(v: number | null | undefined) {
  const num = v ?? 0;
  return `$ ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatBRL(v: number | null | undefined) {
  const num = v ?? 0;
  return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── component ─────────────────────────────────────────────────────────────────

export function DashboardCards({
  data,
  categoria = "Conexões",
}: {
  data: OrderData[];
  categoria?: string;
}) {
  // status counts
  const counts: Record<string, number> = {};
  data.forEach((d) => {
    const s = d.statusCompraVenda || "N/A";
    counts[s] = (counts[s] || 0) + 1;
  });

  // distinct PO counts per status
  const poCountsByStatus = useMemo(() => {
    const map = new Map<string, Set<string>>();
    data.forEach((d) => {
      const s = d.statusCompraVenda || "N/A";
      const po = d.po as string | null;
      if (po) {
        if (!map.has(s)) map.set(s, new Set());
        map.get(s)!.add(po);
      }
    });
    const result: Record<string, number> = {};
    map.forEach((set, key) => { result[key] = set.size; });
    return result;
  }, [data]);

  const totalPOs = useMemo(() => {
    const poSet = new Set<string>();
    data.forEach((d) => { if (d.po) poSet.add(d.po as string); });
    return poSet.size;
  }, [data]);

  const totals = useMemo(() => {
    let totalVenda = 0;
    let totalCompra = 0;
    data.forEach((d) => {
      if (d.precoVenda != null) totalVenda += d.precoVenda * (d.qtyVenda ?? 1);
      if (d.precoCompra != null) totalCompra += d.precoCompra * (d.qtyCompra ?? 1);
    });
    return { totalVenda, totalCompra };
  }, [data]);

  const cardConfig =
    categoria === "Válvulas" ? cardConfigValvulas
    : categoria === "Tubos" ? cardConfigTubos
    : categoria === "Embarques" ? cardConfigEmbarques
    : cardConfigConexoes;

  return (
    <div className="space-y-3">
      {/* ── status chips ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {cardConfig.map((c) => {
          const Icon = c.icon;
          const isChegou = !!c.showPoCount;
          const itemCount = counts[c.key] || 0;
          const poCount = poCountsByStatus[c.key] || 0;

          return (
            <div
              key={c.key}
              className="relative overflow-hidden rounded-xl bg-card border border-border/60 shadow-sm card-lift"
            >
              {/* gradient top accent */}
              <div className={`absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r ${c.accent}`} />

              <div className="flex items-center gap-3 p-4 pt-5">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.iconBg}`}>
                  <Icon className={`h-4 w-4 ${c.iconColor}`} />
                </div>
                <div className="min-w-0">
                  {isChegou ? (
                    <>
                      <p className="text-2xl font-bold leading-none num">{poCount}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-muted-foreground truncate">
                        {c.label} <span className="opacity-60">(POs)</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">{itemCount} itens</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold leading-none num">{itemCount}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-muted-foreground truncate">{c.label}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Preço Venda Total */}
        <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-card shadow-sm card-lift">
          <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-emerald-500 to-teal-400" />
          <div className="flex items-center justify-between gap-3 p-4 pt-5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70 mb-1">
                Preço Venda Total
              </p>
              <p
                className="text-base font-bold leading-tight num truncate text-foreground"
                title={formatBRL(totals.totalVenda)}
              >
                {formatBRL(totals.totalVenda)}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
        </div>

        {/* Preço Compra Total */}
        <div className="relative overflow-hidden rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-card to-card shadow-sm card-lift">
          <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-blue-500 to-indigo-400" />
          <div className="flex items-center justify-between gap-3 p-4 pt-5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-600/70 dark:text-blue-400/70 mb-1">
                Preço Compra Total
              </p>
              <p
                className="text-base font-bold leading-tight num truncate text-foreground"
                title={formatUSD(totals.totalCompra)}
              >
                {formatUSD(totals.totalCompra)}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
              <ShoppingBag className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        {/* POs Compradas */}
        <div className="relative overflow-hidden rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-card to-card shadow-sm card-lift">
          <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-violet-500 to-purple-400" />
          <div className="flex items-center justify-between gap-3 p-4 pt-5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-600/70 dark:text-violet-400/70 mb-1">
                POs Compradas
              </p>
              <p className="text-3xl font-bold leading-none num text-foreground">{totalPOs}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
              <DollarSign className="h-5 w-5 text-violet-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
