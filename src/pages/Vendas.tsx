import { useMemo } from "react";
import { usePedidos } from "@/hooks/usePedidos";
import { TrendingUp, Users, DollarSign, Package, Loader2 } from "lucide-react";

export default function Vendas() {
  const { data, loading } = usePedidos("Conexões");

  const stats = useMemo(() => {
    const totalClientes = new Set(data.filter(d => d.cliente).map(d => d.cliente)).size;
    const totalValue = data.reduce((s, d) => s + (d.precoVenda ?? 0) * (d.qtyVenda ?? 0), 0);
    const totalItems = data.length;
    const delivered = data.filter(d => ["Chegou", "Estoque", "ENTREGUE EM DIA"].includes(d.statusCompraVenda ?? "")).length;
    return { totalClientes, totalValue, totalItems, delivered };
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
        <h1 className="text-2xl font-bold">Vendas</h1>
        <p className="text-sm text-muted-foreground">Visão geral de vendas — dados de Conexões</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={Users} label="Total Clientes" value={String(stats.totalClientes)} color="#1E5EFF" />
        <Card icon={DollarSign} label="Valor Total Vendas" value={`$ ${stats.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} color="#10b981" />
        <Card icon={Package} label="Total Itens" value={String(stats.totalItems)} color="#f59e0b" />
        <Card icon={TrendingUp} label="Entregues" value={String(stats.delivered)} color="#8b5cf6" />
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Cliente</th>
              <th className="px-4 py-3 text-left font-medium">PO</th>
              <th className="px-4 py-3 text-left font-medium">Código</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Qtd Venda</th>
              <th className="px-4 py-3 text-right font-medium">Preço Venda</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 50).map((d, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2">{d.cliente || "—"}</td>
                <td className="px-4 py-2 font-mono text-xs">{d.po || "—"}</td>
                <td className="px-4 py-2 font-mono text-xs">{d.codigo || "—"}</td>
                <td className="px-4 py-2">{d.statusCompraVenda || "—"}</td>
                <td className="px-4 py-2 text-right">{d.qtyVenda ?? "—"}</td>
                <td className="px-4 py-2 text-right">{d.precoVenda != null ? `$ ${d.precoVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</td>
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
