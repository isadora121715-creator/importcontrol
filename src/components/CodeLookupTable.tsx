import { useState, useMemo } from "react";
import { Search, AlertTriangle, Truck, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "./StatusBadge";

interface OrderData {
  codigo: string | null;
  codigoCompra: string | null;
  po: string | null;
  fornecedor: string | null;
  precoCompra: number | null;
  precoVenda: number | null;
  statusFornecedor: string | null;
  statusCompraVenda: string | null;
  statusProducao: string | null;
  qtyCompra: number | null;
  descricao: string | null;
  pi: number | null;
  cliente: string | null;
  prazoCliente: string | null;
  chegadaHci: string | null;
  item: string | null;
  diasFaltam: number | null;
  diasAtraso: number | null;
  [key: string]: unknown;
}

function ResultAlerts({ results }: { results: OrderData[] }) {
  const alerts = useMemo(() => {
    const list: { item: OrderData; severity: "critical" | "warning" | "info"; message: string; action: string }[] = [];
    results.forEach((d) => {
      if (d.statusCompraVenda === "Crítico") {
        list.push({ item: d, severity: "critical", message: `PI ${d.pi} — ${d.descricao || d.codigo} está CRÍTICO`, action: "Considerar frete aéreo ou trocar fornecedor urgente" });
      } else if (d.statusCompraVenda === "Atrasado") {
        list.push({ item: d, severity: "warning", message: `PI ${d.pi} — ${d.descricao || d.codigo} está ATRASADO`, action: d.diasFaltam != null && d.diasFaltam < 5 ? "Acelerar frete — prazo muito curto" : "Contatar fornecedor para atualização de prazo" });
      } else if (d.statusFornecedor === "Atrasado" && d.statusCompraVenda !== "Chegou" && d.statusCompraVenda !== "Estoque") {
        list.push({ item: d, severity: "warning", message: `PI ${d.pi} — Fornecedor ${d.fornecedor} atrasado`, action: "Cobrar fornecedor ou buscar alternativa" });
      } else if (d.statusCompraVenda === "Verificar aéreo") {
        list.push({ item: d, severity: "info", message: `PI ${d.pi} — Verificar necessidade de frete aéreo`, action: "Comparar custo do aéreo vs impacto do atraso no cliente" });
      }
    });
    return list.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
  }, [results]);

  if (alerts.length === 0) return null;

  const severityStyles = {
    critical: "border-l-4 border-l-status-critico bg-status-critico/5",
    warning: "border-l-4 border-l-status-atrasado bg-status-atrasado/5",
    info: "border-l-4 border-l-status-verificar bg-status-verificar/5",
  };
  const severityIcon = {
    critical: <AlertTriangle className="h-4 w-4 text-status-critico" />,
    warning: <AlertTriangle className="h-4 w-4 text-status-atrasado" />,
    info: <Truck className="h-4 w-4 text-status-verificar" />,
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <h4 className="text-xs font-semibold">Alertas Inteligentes</h4>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
          {alerts.length} alerta{alerts.length !== 1 ? "s" : ""}
        </span>
      </div>
      {alerts.map((a, i) => (
        <div key={i} className={`rounded-lg p-3 ${severityStyles[a.severity]}`}>
          <div className="flex items-start gap-2">
            {severityIcon[a.severity]}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{a.message}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Ação:</span> {a.action}
              </p>
              <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                <span>PO: {a.item.po || "—"}</span>
                <span>Fornecedor: {a.item.fornecedor || "—"}</span>
                <span>Cliente: {a.item.cliente || "—"}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CodeLookupTable({ data, onPoSelect }: { data: OrderData[]; onPoSelect?: (po: string) => void }) {
  const [search, setSearch] = useState("");

  // Build unique codes and POs for suggestions
  const { codes, pos } = useMemo(() => {
    const codeSet = new Set<string>();
    const poSet = new Set<string>();
    data.forEach((d) => {
      if (d.codigo) codeSet.add(d.codigo);
      if (d.codigoCompra) codeSet.add(d.codigoCompra);
      if (d.po) poSet.add(d.po);
    });
    return { codes: Array.from(codeSet).sort(), pos: Array.from(poSet).sort() };
  }, [data]);

  const allKeys = useMemo(() => [...codes, ...pos], [codes, pos]);

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allKeys.filter((c) => c.toLowerCase().includes(q));
  }, [search, allKeys]);

  const selectedKey = filtered.length === 1
    ? filtered[0]
    : allKeys.includes(search.toUpperCase())
      ? search.toUpperCase()
      : allKeys.includes(search)
        ? search
        : null;

  const results = useMemo(() => {
    if (!selectedKey) return [];
    return data.filter(
      (d) => d.codigo === selectedKey || d.codigoCompra === selectedKey || d.po === selectedKey
    );
  }, [selectedKey, data]);

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Consulta por Código / PO</CardTitle>
        <p className="text-xs text-muted-foreground">Filtre por código do produto ou número da PO para ver todos os itens</p>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Digite o código do produto ou número da PO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 font-mono text-sm"
          />
        </div>

        {search && !selectedKey && filtered.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {filtered.slice(0, 20).map((c) => (
              <button
                key={c}
                onClick={() => setSearch(c)}
                className="rounded-md bg-secondary px-2.5 py-1 text-xs font-mono text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {c}
              </button>
            ))}
            {filtered.length > 20 && <span className="text-xs text-muted-foreground self-center">+{filtered.length - 20} mais...</span>}
          </div>
        )}

        {selectedKey && results.length > 0 && (
          <>
            <div className="overflow-auto max-h-[350px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">PO</TableHead>
                    <TableHead className="text-xs">Fornecedor</TableHead>
                    <TableHead className="text-xs">Item (Compra)</TableHead>
                    <TableHead className="text-xs">Descrição (Venda)</TableHead>
                    <TableHead className="text-xs">Qtd</TableHead>
                    <TableHead className="text-xs">Preço Compra</TableHead>
                    <TableHead className="text-xs">Preço Venda</TableHead>
                    <TableHead className="text-xs">Status Produção</TableHead>
                    <TableHead className="text-xs">Status Fornecedor</TableHead>
                    <TableHead className="text-xs">Status Compra/Venda</TableHead>
                    <TableHead className="text-xs">PI</TableHead>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs">Prazo Cliente</TableHead>
                    <TableHead className="text-xs">Chegada HCI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs font-medium">
                        {r.po ? (
                          <button
                            onClick={() => onPoSelect?.(r.po!)}
                            className="text-primary hover:text-primary/80 hover:underline flex items-center gap-1"
                          >
                            {r.po}
                          </button>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{r.fornecedor || "—"}</TableCell>
                      <TableCell className="text-xs">{r.item || "—"}</TableCell>
                      <TableCell className="text-xs">{r.descricao || "—"}</TableCell>
                      <TableCell className="text-xs text-center">{r.qtyCompra ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {r.precoCompra != null ? `$ ${r.precoCompra.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {r.precoVenda != null ? `R$ ${r.precoVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{r.statusProducao || "—"}</TableCell>
                      <TableCell><StatusBadge status={r.statusFornecedor} /></TableCell>
                      <TableCell><StatusBadge status={r.statusCompraVenda} /></TableCell>
                      <TableCell className="font-mono text-xs">{r.pi || "—"}</TableCell>
                      <TableCell className="text-xs">{r.cliente || "—"}</TableCell>
                      <TableCell className="text-xs">{r.prazoCliente || "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{r.chegadaHci || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ResultAlerts results={results} />
          </>
        )}

        {selectedKey && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado.</p>
        )}

        {!search && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Digite um código ou PO acima para consultar os itens.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
