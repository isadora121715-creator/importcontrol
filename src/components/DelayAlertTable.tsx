import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "./StatusBadge";
import { ActionPlanModal } from "./ActionPlanModal";

interface OrderData {
  pi: number | null;
  cliente: string | null;
  codigo: string | null;
  descricao: string | null;
  prazoCliente: string | null;
  statusCompraVenda: string | null;
  statusFornecedor: string | null;
  diasAtraso: number | null;
  diasFaltam: number | null;
  po: string | null;
  fornecedor: string | null;
  vendaEmDias: number | null;
  chegadaHci: string | null;
  precoVenda: number | null;
  precoCompra: number | null;
  qtyVenda: number | null;
  qtyCompra: number | null;
  categoria?: string;
  [key: string]: unknown;
}

interface Props {
  data: OrderData[];
  onPoClick?: (po: string) => void;
  activePo?: string | null;
  categoria?: string;
  isRefreshing?: boolean;
  statusMessage?: string | null;
}

const INITIAL_ROWS = 30;

export function DelayAlertTable({ data, onPoClick, activePo, categoria = "Conexões", isRefreshing = false, statusMessage }: Props) {
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS);

  const delayed = useMemo(() => {
    return data
      .filter((d) => d.statusCompraVenda === "Atrasado" || d.statusCompraVenda === "Crítico" || (d.statusFornecedor === "Atrasado" && d.statusCompraVenda !== "Chegou" && d.statusCompraVenda !== "Estoque"))
      .sort((a, b) => {
        if (a.statusCompraVenda === "Crítico" && b.statusCompraVenda !== "Crítico") return -1;
        if (b.statusCompraVenda === "Crítico" && a.statusCompraVenda !== "Crítico") return 1;
        return (a.diasFaltam ?? 999) - (b.diasFaltam ?? 999);
      });
  }, [data]);

  useEffect(() => {
    setVisibleCount(INITIAL_ROWS);
  }, [delayed.length, activePo]);

  const visibleRows = delayed.slice(0, visibleCount);

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-status-atrasado" />
          <CardTitle className="text-base font-semibold">Pedidos com Risco de Atraso</CardTitle>
          <span className="ml-auto rounded-full bg-status-atrasado/15 px-2.5 py-0.5 text-xs font-semibold text-status-atrasado">{delayed.length}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">PI</TableHead>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Código</TableHead>
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-xs">Prazo Cliente</TableHead>
                  <TableHead className="text-xs">PO</TableHead>
                  <TableHead className="text-xs">Fornecedor</TableHead>
                  <TableHead className="text-xs">Chegada HCI</TableHead>
                  <TableHead className="text-xs">Status Fornecedor</TableHead>
                  <TableHead className="text-xs">Status Compra/Venda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length > 0 ? visibleRows.map((r, i) => (
                  <TableRow key={i} className={`cursor-pointer hover:bg-primary/5 ${r.statusCompraVenda === "Crítico" ? "bg-status-critico/5" : r.statusCompraVenda === "Atrasado" ? "bg-status-atrasado/5" : ""} ${activePo === r.po ? "ring-1 ring-primary/30" : ""}`} onClick={() => setSelectedOrder(r)}>
                    <TableCell className="font-mono text-xs font-medium">{r.pi || "—"}</TableCell>
                    <TableCell className="text-xs">{r.cliente || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.codigo || "—"}</TableCell>
                    <TableCell className="text-xs">{(r as any).item || "—"}</TableCell>
                    <TableCell className="text-xs">{r.prazoCliente || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.po ? (
                        <button
                          onClick={() => onPoClick?.(r.po!)}
                          className="flex cursor-pointer items-center gap-1 text-primary hover:underline"
                          title="Clique para filtrar por esta PO"
                        >
                          {r.po}
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{r.fornecedor || "—"}</TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap">{r.chegadaHci || "—"}</TableCell>
                    <TableCell><StatusBadge status={r.statusFornecedor} /></TableCell>
                    <TableCell><StatusBadge status={r.statusCompraVenda} /></TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum pedido crítico ou atrasado no momento.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {isRefreshing && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/70 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {statusMessage || "Atualizando pedidos..."}
              </div>
            </div>
          )}
        </div>

        {delayed.length > visibleCount && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => setVisibleCount((current) => current + INITIAL_ROWS)}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
            >
              Carregar mais ({delayed.length - visibleCount} restantes)
            </button>
          </div>
        )}
      </CardContent>
      <ActionPlanModal
        open={!!selectedOrder}
        onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}
        order={selectedOrder}
        categoria={selectedOrder?.categoria || categoria}
      />
    </Card>
  );
}
