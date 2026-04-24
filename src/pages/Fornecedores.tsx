import { useMemo } from "react";
import { usePedidos } from "@/hooks/usePedidos";
import { Factory, Package, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

interface FornecedorStats {
  name: string;
  totalPOs: number;
  totalItems: number;
  atrasados: number;
  entregues: number;
}

export default function Fornecedores() {
  const { data, loading } = usePedidos("Conexões");

  const fornecedorList = useMemo((): FornecedorStats[] => {
    const map = new Map<string, FornecedorStats>();
    data.forEach((d) => {
      const name = d.fornecedor || "Sem fornecedor";
      if (!map.has(name)) {
        map.set(name, { name, totalPOs: 0, totalItems: 0, atrasados: 0, entregues: 0 });
      }
      const f = map.get(name)!;
      f.totalItems++;
      if (d.po) {
        // count unique POs per supplier - simplified
        f.totalPOs++;
      }
      if (["Atrasado", "Crítico"].includes(d.statusCompraVenda ?? "")) f.atrasados++;
      if (["Chegou", "Estoque", "ENTREGUE EM DIA"].includes(d.statusCompraVenda ?? "")) f.entregues++;
    });
    return Array.from(map.values()).sort((a, b) => b.totalItems - a.totalItems);
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
        <h1 className="text-2xl font-bold">Fornecedores</h1>
        <p className="text-sm text-muted-foreground">Resumo por fornecedor — dados de Conexões</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={Factory} label="Total Fornecedores" value={String(fornecedorList.length)} color="#1E5EFF" />
        <Card icon={Package} label="Total Itens" value={String(data.length)} color="#f59e0b" />
        <Card icon={AlertTriangle} label="Itens Atrasados" value={String(fornecedorList.reduce((s, f) => s + f.atrasados, 0))} color="#ef4444" />
        <Card icon={CheckCircle} label="Itens Entregues" value={String(fornecedorList.reduce((s, f) => s + f.entregues, 0))} color="#10b981" />
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Fornecedor</th>
              <th className="px-4 py-3 text-right font-medium">Itens</th>
              <th className="px-4 py-3 text-right font-medium">Atrasados</th>
              <th className="px-4 py-3 text-right font-medium">Entregues</th>
            </tr>
          </thead>
          <tbody>
            {fornecedorList.map((f, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2 font-medium">{f.name}</td>
                <td className="px-4 py-2 text-right">{f.totalItems}</td>
                <td className="px-4 py-2 text-right">{f.atrasados > 0 ? <span className="text-destructive font-medium">{f.atrasados}</span> : "0"}</td>
                <td className="px-4 py-2 text-right">{f.entregues > 0 ? <span className="text-green-600 font-medium">{f.entregues}</span> : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
