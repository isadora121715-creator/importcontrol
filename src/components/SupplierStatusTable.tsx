import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "./StatusBadge";
import { PoDocumentsModal } from "./PoDocumentsModal";
import { PoSummaryPopover } from "./PoSummaryPopover";
import { ExternalLink, Loader2, Paperclip } from "lucide-react";

interface OrderData {
  po: string | null;
  fornecedor: string | null;
  statusFornecedor: string | null;
  statusCompraVenda: string | null;
  diasFaltam: number | null;
  followUp: string | null;
  chegadaHci: string | null;
  eta: string | null;
  etd: string | null;
  embarque: string | null;
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

export function SupplierStatusTable({ data, onPoClick, activePo, categoria = "Conexões", isRefreshing = false, statusMessage }: Props) {
  const [poFilter, setPoFilter] = useState<string>("all");
  const [docsPo, setDocsPo] = useState<{ po: string; categoria: string } | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS);

  const poList = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d) => { if (d.po) set.add(d.po); });
    return Array.from(set).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    if (poFilter === "all") return data;
    return data.filter((d) => d.po === poFilter);
  }, [data, poFilter]);

  // Group by PO + Fornecedor
  const poMap: Record<string, { po: string; fornecedor: string; statusFornecedor: string; statusCompraVenda: string; items: number; chegadaHci: string | null; followUp: string | null; eta: string | null; etd: string | null; embarque: string | null; entregaFornecedor: string | null; rowCategoria: string }> = {};

  filteredData.forEach((d) => {
    if (!d.po) return;
    const key = `${d.po}|${d.fornecedor}`;
    if (!poMap[key]) {
      poMap[key] = {
        po: d.po,
        fornecedor: d.fornecedor || "—",
        statusFornecedor: d.statusFornecedor || "—",
        statusCompraVenda: d.statusCompraVenda || "—",
        items: 0,
        chegadaHci: d.chegadaHci,
        followUp: d.followUp,
        eta: d.eta,
        etd: d.etd,
        embarque: d.embarque,
        entregaFornecedor: (d as any).entregaFornecedor ?? null,
        rowCategoria: d.categoria || categoria,
      };
    }
    poMap[key].items += 1;
    if (d.statusCompraVenda === "Crítico" || d.statusCompraVenda === "Atrasado") {
      poMap[key].statusCompraVenda = d.statusCompraVenda;
    }
    if (d.statusFornecedor === "Atrasado") {
      poMap[key].statusFornecedor = "Atrasado";
    }
  });

  const rows = Object.values(poMap).sort((a, b) => {
    const order: Record<string, number> = { "Crítico": 0, "Atrasado": 1, "Verificar aéreo": 2, "No prazo": 3, "Chegou": 4, "Estoque": 5 };
    return (order[a.statusCompraVenda] ?? 9) - (order[b.statusCompraVenda] ?? 9);
  });

  useEffect(() => {
    setVisibleCount(INITIAL_ROWS);
  }, [poFilter, activePo, rows.length]);

  const visibleRows = rows.slice(0, visibleCount);

  const handlePoClick = (po: string) => {
    if (onPoClick) {
      // Never toggle off — keeping the PO filter active preserves the dashboard view.
      // The user can clear it via the "Limpar" button above the table or the FilterSidebar.
      onPoClick(po);
    }
  };

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold">Relação PO × Fornecedor × Status</CardTitle>
            {activePo && activePo !== "all" && (
              <p className="text-xs text-muted-foreground mt-1">
                Filtrando por PO: <span className="font-semibold text-foreground">{activePo}</span>
                <button
                  onClick={() => onPoClick?.("all")}
                  className="ml-2 text-primary hover:underline"
                >
                  Limpar
                </button>
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">Clique na PO para filtrar o dashboard</p>
          </div>
          <Select value={poFilter} onValueChange={setPoFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Filtrar por PO" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as POs</SelectItem>
              {poList.map((po) => (
                <SelectItem key={po} value={po}>{po}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">PO</TableHead>
                  <TableHead className="text-xs">Fornecedor</TableHead>
                  <TableHead className="text-xs">Itens</TableHead>
                  <TableHead className="text-xs">Status Fornecedor</TableHead>
                  <TableHead className="text-xs">Status Compra/Venda</TableHead>
                  <TableHead className="text-xs">ETD</TableHead>
                  <TableHead className="text-xs">ETA</TableHead>
                  <TableHead className="text-xs">Embarque</TableHead>
                  <TableHead className="text-xs">Entrega Forn.</TableHead>
                  <TableHead className="text-xs">Chegada HCI</TableHead>
                  <TableHead className="text-xs">Follow Up</TableHead>
                  <TableHead className="text-xs">Docs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length > 0 ? visibleRows.map((r) => (
                  <TableRow
                    key={`${r.po}-${r.fornecedor}`}
                    className={activePo === r.po ? "bg-primary/5" : ""}
                  >
                    <TableCell className="font-mono text-xs font-medium">
                      <PoSummaryPopover po={r.po} categoria={categoria} items={filteredData.filter(d => d.po === r.po)}>
                        <button
                          onClick={() => handlePoClick(r.po)}
                          className="flex cursor-pointer items-center gap-1 text-primary hover:underline"
                          title="Clique para ver resumo da PO"
                        >
                          {r.po}
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </PoSummaryPopover>
                    </TableCell>
                    <TableCell className="text-xs">{r.fornecedor}</TableCell>
                    <TableCell className="text-xs text-center">{r.items}</TableCell>
                    <TableCell><StatusBadge status={r.statusFornecedor} /></TableCell>
                    <TableCell><StatusBadge status={r.statusCompraVenda} /></TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap">{r.etd || "—"}</TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap">{r.eta || "—"}</TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap">{r.embarque || "—"}</TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap">{r.entregaFornecedor || "—"}</TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap">{r.chegadaHci || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">{r.followUp || "—"}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => setDocsPo({ po: r.po, categoria: r.rowCategoria })}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                        title="Anexar documentos"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={12} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma PO encontrada para os filtros atuais.
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

        {rows.length > visibleCount && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => setVisibleCount((current) => current + INITIAL_ROWS)}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
            >
              Carregar mais ({rows.length - visibleCount} restantes)
            </button>
          </div>
        )}
      </CardContent>
      {docsPo && (
        <PoDocumentsModal
          open={!!docsPo}
          onOpenChange={(open) => { if (!open) setDocsPo(null); }}
          po={docsPo.po}
          categoria={docsPo.categoria}
        />
      )}
    </Card>
  );
}
