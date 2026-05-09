import { useEffect, useMemo, useState } from "react";
import { Package, ExternalLink, Loader2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "./StatusBadge";
import { ActionPlanModal } from "./ActionPlanModal";
import { downloadValvulasDashboard } from "@/lib/downloadValvulasDashboard";
import { toast } from "sonner";

interface OrderData {
  pi: number | null;
  cliente: string | null;
  codigo: string | null;
  descricao: string | null;
  precoVenda: number | null;
  precoCompra: number | null;
  qtyVenda: number | null;
  qtyCompra: number | null;
  prazoCliente: string | null;
  statusCompraVenda: string | null;
  statusFornecedor: string | null;
  diasFaltam: number | null;
  diasAtraso: number | null;
  po: string | null;
  fornecedor: string | null;
  chegadaHci: string | null;
  [key: string]: unknown;
}

interface Props {
  data: OrderData[];
  onPoClick?: (po: string) => void;
  activePo?: string | null;
  isRefreshing?: boolean;
  statusMessage?: string | null;
}

const INITIAL_ROWS = 30;

export function ValvulasTable({ data, onPoClick, activePo, isRefreshing = false, statusMessage }: Props) {
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS);

  const displayData = useMemo(() => {
    return [...data].sort((a, b) => {
      if (a.statusCompraVenda === "Crítico" && b.statusCompraVenda !== "Crítico") return -1;
      if (b.statusCompraVenda === "Crítico" && a.statusCompraVenda !== "Crítico") return 1;
      return 0;
    });
  }, [data]);

  useEffect(() => {
    setVisibleCount(INITIAL_ROWS);
  }, [displayData.length, activePo]);

  const visibleRows = displayData.slice(0, visibleCount);

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">Lista de Válvulas</CardTitle>
          <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{displayData.length}</span>
          
          <button
            onClick={() => {
              const ok = downloadValvulasDashboard(displayData as any, "Válvulas");
              if (!ok) toast.info("Nenhum dado para exportar.");
            }}
            className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 ml-2"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar Planilha
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tipo de Válvula</TableHead>
                  <TableHead className="text-xs">Fornecedor</TableHead>
                  <TableHead className="text-xs">Cliente (Responsável)</TableHead>
                  <TableHead className="text-xs">PO</TableHead>
                  <TableHead className="text-xs">Status Geral</TableHead>
                  <TableHead className="text-xs">Última Atualização (Chegada)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length > 0 ? visibleRows.map((r, i) => (
                  <TableRow key={i} className={`cursor-pointer hover:bg-primary/5 ${activePo === r.po ? "ring-1 ring-primary/30" : ""}`} onClick={() => setSelectedOrder(r)}>
                    <TableCell className="text-xs max-w-[200px] truncate" title={r.descricao || ""}>
                      {r.descricao || (r as any).item || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{r.fornecedor || "—"}</TableCell>
                    <TableCell className="text-xs">{r.cliente || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.po ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPoClick?.(r.po!);
                          }}
                          className="flex cursor-pointer items-center gap-1 text-primary hover:underline"
                          title="Clique para filtrar por esta PO"
                        >
                          {r.po}
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      ) : "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={r.statusCompraVenda} /></TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap">{r.chegadaHci || r.prazoCliente || "—"}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma válvula encontrada.
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

        {displayData.length > visibleCount && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => setVisibleCount((current) => current + INITIAL_ROWS)}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
            >
              Carregar mais ({displayData.length - visibleCount} restantes)
            </button>
          </div>
        )}
      </CardContent>
      <ActionPlanModal
        open={!!selectedOrder}
        onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}
        order={selectedOrder}
      />
    </Card>
  );
}
