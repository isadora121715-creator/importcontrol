import { Package, AlertTriangle, CheckCircle, Archive, Plane, DollarSign, Ship, Clock, Anchor } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useMemo } from "react";

interface OrderData {
  statusCompraVenda: string | null;
  precoVenda: number | null;
  precoCompra: number | null;
  qtyVenda: number | null;
  qtyCompra: number | null;
  [key: string]: unknown;
}

const cardConfigConexoes = [
  { key: "No prazo", label: "No Prazo", icon: CheckCircle, color: "text-status-no-prazo", bgColor: "bg-status-no-prazo/10" },
  { key: "Atrasado", label: "Atrasado", icon: AlertTriangle, color: "text-status-atrasado", bgColor: "bg-status-atrasado/10" },
  { key: "Crítico", label: "Crítico", icon: AlertTriangle, color: "text-status-critico", bgColor: "bg-status-critico/10" },
  { key: "Chegou", label: "Chegou", icon: Package, color: "text-status-chegou", bgColor: "bg-status-chegou/10", showPoCount: true },
  { key: "Estoque", label: "Estoque", icon: Archive, color: "text-status-estoque", bgColor: "bg-status-estoque/10" },
  { key: "Verificar aéreo", label: "Verif. Aéreo", icon: Plane, color: "text-status-verificar", bgColor: "bg-status-verificar/10" },
];

const cardConfigValvulas = [
  { key: "On time", label: "No Prazo", icon: CheckCircle, color: "text-status-no-prazo", bgColor: "bg-status-no-prazo/10" },
  { key: "Atrasado", label: "Atrasado", icon: AlertTriangle, color: "text-status-atrasado", bgColor: "bg-status-atrasado/10" },
];

const cardConfigTubos = [
  { key: "No prazo", label: "No Prazo", icon: CheckCircle, color: "text-status-no-prazo", bgColor: "bg-status-no-prazo/10" },
  { key: "Atrasado", label: "Atrasado", icon: AlertTriangle, color: "text-status-atrasado", bgColor: "bg-status-atrasado/10" },
  { key: "Crítico", label: "Crítico", icon: AlertTriangle, color: "text-status-critico", bgColor: "bg-status-critico/10" },
  { key: "Chegou", label: "Chegou", icon: Package, color: "text-status-chegou", bgColor: "bg-status-chegou/10", showPoCount: true },
  { key: "Estoque", label: "Estoque", icon: Archive, color: "text-status-estoque", bgColor: "bg-status-estoque/10" },
  { key: "Verificar aéreo", label: "Verif. Aéreo", icon: Plane, color: "text-status-verificar", bgColor: "bg-status-verificar/10" },
];

const cardConfigEmbarques = [
  { key: "No prazo", label: "No Prazo", icon: CheckCircle, color: "text-status-no-prazo", bgColor: "bg-status-no-prazo/10" },
  { key: "Atrasado", label: "Atrasado", icon: AlertTriangle, color: "text-status-atrasado", bgColor: "bg-status-atrasado/10" },
  { key: "Crítico", label: "Crítico", icon: AlertTriangle, color: "text-status-critico", bgColor: "bg-status-critico/10" },
  { key: "Chegou", label: "Chegou", icon: Package, color: "text-status-chegou", bgColor: "bg-status-chegou/10", showPoCount: true },
  { key: "Estoque", label: "Estoque", icon: Archive, color: "text-status-estoque", bgColor: "bg-status-estoque/10" },
  { key: "Verificar aéreo", label: "Verif. Aéreo", icon: Plane, color: "text-status-verificar", bgColor: "bg-status-verificar/10" },
];

function formatUSD(v: number | null | undefined) {
  const num = v ?? 0;
  return `$ ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatBRL(v: number | null | undefined) {
  const num = v ?? 0;
  return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function DashboardCards({ data, categoria = "Conexões" }: { data: OrderData[]; categoria?: string }) {
  const counts: Record<string, number> = {};
  data.forEach((d) => {
    const s = d.statusCompraVenda || "N/A";
    counts[s] = (counts[s] || 0) + 1;
  });

  // Distinct PO counts per status
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
      if (d.precoCompra != null) totalCompra += d.precoCompra * (d.qtyCompra ?? d.qtyVenda ?? 1);
    });
    return { totalVenda, totalCompra };
  }, [data]);

  const cardConfig = categoria === "Válvulas" ? cardConfigValvulas : categoria === "Tubos" ? cardConfigTubos : categoria === "Embarques" ? cardConfigEmbarques : cardConfigConexoes;

  return (
    <div className="space-y-4">
      {/* Status cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {cardConfig.map((c) => {
          const Icon = c.icon;
          const isChegou = "showPoCount" in c && (c as any).showPoCount;
          const itemCount = counts[c.key] || 0;
          const poCount = poCountsByStatus[c.key] || 0;

          return (
            <Card key={c.key} className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.bgColor}`}>
                  <Icon className={`h-5 w-5 ${c.color}`} />
                </div>
                <div className="min-w-0">
                  {isChegou ? (
                    <>
                      <p className="text-2xl font-bold leading-none">{poCount}</p>
                      <p className="mt-1 text-xs text-muted-foreground truncate">{c.label} (POs)</p>
                      <p className="text-[10px] text-muted-foreground">{itemCount} itens</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold leading-none">{itemCount}</p>
                      <p className="mt-1 text-xs text-muted-foreground truncate">{c.label}</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold leading-tight truncate" title={formatBRL(totals.totalVenda)}>{formatBRL(totals.totalVenda)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Preço Venda Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold leading-tight truncate" title={formatUSD(totals.totalCompra)}>{formatUSD(totals.totalCompra)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Preço Compra Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{totalPOs}</p>
              <p className="mt-1 text-xs text-muted-foreground">POs Compradas</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
