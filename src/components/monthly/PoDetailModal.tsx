import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, CalendarDays, CheckCircle, AlertTriangle } from "lucide-react";
import type { PedidoRow } from "@/lib/parseExcel";

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) return new Date(year, month, day);
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function formatBRL(v: number | null | undefined) {
  const num = v ?? 0;
  return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUSD(v: number | null | undefined) {
  const num = v ?? 0;
  return `$ ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format a date value that may be a dd/MM/yyyy string or an Excel serial number */
function formatDateValue(raw: unknown): string {
  if (!raw) return "-";
  if (typeof raw === "number") {
    const utcDays = Math.floor(raw - 25569);
    const date = new Date(utcDays * 86400000);
    const d = String(date.getUTCDate()).padStart(2, "0");
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const y = date.getUTCFullYear();
    return `${d}/${m}/${y}`;
  }
  return String(raw);
}

interface Props {
  po: string | null;
  data: PedidoRow[];
  onClose: () => void;
}

export function PoDetailModal({ po, data, onClose }: Props) {
  const items = useMemo(() => {
    if (!po) return [];
    return data.filter((d) => d.po === po);
  }, [po, data]);

  const summary = useMemo<{
    fornecedor: string; totalVenda: number; totalCompra: number; clientes: string;
    chegada: string; menorPrazo: string; dataCompra: string; entregaFornecedor: string;
    statusFornecedor: string; statusCompraVenda: string; onTime: boolean | null;
  }>(() => {
    let totalVenda = 0;
    let totalCompra = 0;
    let fornecedor = "-";
    const clientes = new Set<string>();
    let menorPrazoDate: Date | null = null;
    let menorPrazoRaw: string | null = null;

    items.forEach((d) => {
      if (d.precoVenda != null) totalVenda += d.precoVenda * (d.qtyVenda ?? 1);
      if (d.precoCompra != null) totalCompra += d.precoCompra * (d.qtyCompra ?? d.qtyVenda ?? 1);
      if (d.fornecedor && fornecedor === "-") fornecedor = d.fornecedor;
      if (d.cliente) clientes.add(d.cliente);

      // Find the earliest prazoCliente across all items
      const prazoDate = parseDate(d.prazoCliente);
      if (prazoDate && (!menorPrazoDate || prazoDate < menorPrazoDate)) {
        menorPrazoDate = prazoDate;
        menorPrazoRaw = d.prazoCliente;
      }
    });

    const chegadaRaw = items.find((d) => parseDate(d.chegadaHci))?.chegadaHci || null;
    const chegadaDate = parseDate(chegadaRaw);
    const onTime = chegadaDate && menorPrazoDate ? chegadaDate <= menorPrazoDate : null;

    return {
      fornecedor,
      totalVenda,
      totalCompra,
      clientes: Array.from(clientes).join(", ") || "-",
      chegada: chegadaRaw || "-",
      menorPrazo: menorPrazoRaw || "-",
      dataCompra: formatDateValue(items[0]?.dataCompra),
      entregaFornecedor: items[0]?.entregaFornecedor || "-",
      statusFornecedor: items[0]?.statusFornecedor || "-",
      statusCompraVenda: items[0]?.statusCompraVenda || "-",
      onTime,
    };
  }, [items]);

  if (!po) return null;

  return (
    <Dialog open={!!po} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            PO: {po}
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Fornecedor</p>
            <p className="font-medium">{summary.fornecedor}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Clientes</p>
            <p className="font-medium">{summary.clientes}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Status</p>
            <p className="font-medium">{summary.statusCompraVenda}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Data Compra</p>
            <p className="font-medium">{summary.dataCompra}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Entrega Fornecedor</p>
            <p className="font-medium">{summary.entregaFornecedor}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Menor Prazo Cliente</p>
            <p className="font-medium">{summary.menorPrazo}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Chegada HCI</p>
            <p className="font-medium">{summary.chegada}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Venda Total</p>
            <p className="font-bold text-emerald-600">{formatBRL(summary.totalVenda)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Compra Total</p>
            <p className="font-bold text-red-600">{formatUSD(summary.totalCompra)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Situação</p>
            {summary.onTime === null ? (
              <Badge variant="outline" className="text-xs">Sem dados</Badge>
            ) : summary.onTime ? (
              <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" /> No Prazo
              </Badge>
            ) : (
              <Badge className="bg-red-500/10 text-red-700 border-red-200 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" /> Em Atraso
              </Badge>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2">Itens ({items.length})</h4>
          <div className="max-h-[300px] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Material</TableHead>
                  <TableHead className="text-xs text-right">Qty Compra</TableHead>
                  <TableHead className="text-xs text-right">Preço Compra ($)</TableHead>
                  <TableHead className="text-xs text-right">Preço Venda (R$)</TableHead>
                  <TableHead className="text-xs">Prazo Cliente</TableHead>
                  <TableHead className="text-xs">Cliente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{item.descricao || "-"}</TableCell>
                    <TableCell className="text-xs text-right">{item.qtyCompra ?? item.qtyVenda ?? "-"}</TableCell>
                    <TableCell className="text-xs text-right">{item.precoCompra != null ? formatUSD(item.precoCompra) : "-"}</TableCell>
                    <TableCell className="text-xs text-right">{item.precoVenda != null ? formatBRL(item.precoVenda) : "-"}</TableCell>
                    <TableCell className="text-xs">{item.prazoCliente || "-"}</TableCell>
                    <TableCell className="text-xs">{item.cliente || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
