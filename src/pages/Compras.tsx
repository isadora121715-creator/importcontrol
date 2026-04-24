import { useMemo } from "react";
import { usePedidos } from "@/hooks/usePedidos";
import { ShoppingCart, Package, DollarSign, Clock, Loader2 } from "lucide-react";

export default function Compras() {
  const { data, loading } = usePedidos("Conexões");

  const stats = useMemo(() => {
    const totalPOs = new Set(data.filter(d => d.po).map(d => d.po)).size;
    const totalValue = data.reduce((s, d) => s + (d.precoCompra ?? 0) * (d.qtyCompra ?? 0), 0);
    const avgDays = data.filter(d => d.vendaEmDias != null).reduce((s, d, _, a) => s + (d.vendaEmDias ?? 0) / a.length, 0);
    const pending = data.filter(d => d.statusCompraVenda && !["Chegou", "Estoque", "ENTREGUE EM DIA", "ENTREGUE ATRASADO"].includes(d.statusCompraVenda)).length;
    return { totalPOs, totalValue, avgDays: Math.round(avgDays), pending };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Compras</h1>
        <p className="text-sm text-muted-foreground">Visão geral de compras — dados de Conexões</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={ShoppingCart} label="Total POs" value={String(stats.totalPOs)} color="#1E5EFF" />
        <Card icon={DollarSign} label="Valor Total Compras" value={`$ ${(stats.totalValue ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} color="#10b981" />
        <Card icon={Clock} label="Prazo Médio (dias)" value={String(stats.avgDays)} color="#f59e0b" />
        <Card icon={Package} label="Itens Pendentes" value={String(stats.pending)} color="#ef4444" />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">PO</th>
              <th className="px-4 py-3 text-left font-medium">Fornecedor</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Qtd</th>
              <th className="px-4 py-3 text-right font-medium">Preço Compra</th>
              <th className="px-4 py-3 text-left font-medium">Prazo Cliente</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 50).map((d, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2 font-mono text-xs">{d.po || "—"}</td>
                <td className="px-4 py-2">{d.fornecedor || "—"}</td>
                <td className="px-4 py-2">{d.statusCompraVenda || "—"}</td>
                <td className="px-4 py-2 text-right">{d.qtyCompra ?? "—"}</td>
                <td className="px-4 py-2 text-right">{d.precoCompra != null ? `$ ${d.precoCompra.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</td>
                <td className="px-4 py-2">{d.prazoCliente || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 50 && <p className="px-4 py-2 text-xs text-muted-foreground">Exibindo 50 de {data.length} registros</p>}
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${color}15` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}
