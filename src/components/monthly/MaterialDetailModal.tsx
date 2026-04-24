import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3 } from "lucide-react";
import type { PedidoRow } from "@/lib/parseExcel";

function formatUSD(v: number | null | undefined) {
  const num = v ?? 0;
  return `$ ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Props {
  material: string | null;
  data: PedidoRow[];
  onClose: () => void;
}

export function MaterialDetailModal({ material, data, onClose }: Props) {
  const rows = useMemo(() => {
    if (!material) return [];
    const filtered = data.filter((d) => {
      const name = d.descricao?.split(/\s+/)[0]?.toUpperCase() || "OUTROS";
      return name === material;
    });

    // Group by PO
    const poMap = new Map<string, { po: string; fornecedor: string; cliente: string; qty: number; value: number }>();
    filtered.forEach((d) => {
      const poKey = d.po || "SEM-PO";
      if (!poMap.has(poKey)) {
        poMap.set(poKey, { po: poKey, fornecedor: d.fornecedor || "-", cliente: d.cliente || "-", qty: 0, value: 0 });
      }
      const entry = poMap.get(poKey)!;
      entry.qty += d.qtyCompra ?? d.qtyVenda ?? 1;
      if (d.precoCompra != null) entry.value += d.precoCompra * (d.qtyCompra ?? d.qtyVenda ?? 1);
      if (d.cliente && entry.cliente === "-") entry.cliente = d.cliente;
      if (d.fornecedor && entry.fornecedor === "-") entry.fornecedor = d.fornecedor;
    });

    return Array.from(poMap.values()).sort((a, b) => b.value - a.value);
  }, [material, data]);

  if (!material) return null;

  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);

  return (
    <Dialog open={!!material} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Material: {material}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-6 text-sm mb-4">
          <div>
            <p className="text-muted-foreground text-xs">Total Quantidade</p>
            <p className="font-bold">{(totalQty ?? 0).toLocaleString("pt-BR")} un</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Total Valor</p>
            <p className="font-bold">{formatUSD(totalValue)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">POs</p>
            <p className="font-bold">{rows.length}</p>
          </div>
        </div>

        <div className="max-h-[400px] overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">PO</TableHead>
                <TableHead className="text-xs">Fornecedor</TableHead>
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs text-right">Quantidade</TableHead>
                <TableHead className="text-xs text-right">Valor ($)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.po}>
                  <TableCell className="text-xs font-medium">{r.po}</TableCell>
                  <TableCell className="text-xs">{r.fornecedor}</TableCell>
                  <TableCell className="text-xs">{r.cliente}</TableCell>
                  <TableCell className="text-xs text-right">{(r.qty ?? 0).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-xs text-right">{formatUSD(r.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
