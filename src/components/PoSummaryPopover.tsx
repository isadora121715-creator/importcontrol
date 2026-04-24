import { useState, useEffect, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, FileText, Package } from "lucide-react";
import { StatusBadge } from "./StatusBadge";

interface OrderData {
  po: string | null;
  fornecedor: string | null;
  statusFornecedor: string | null;
  statusCompraVenda: string | null;
  etd: string | null;
  eta: string | null;
  embarque: string | null;
  chegadaHci: string | null;
  followUp: string | null;
  [key: string]: unknown;
}

interface DocRecord {
  id: string;
  doc_type: string;
  file_name: string;
  file_url: string;
  created_at: string;
}

interface PoSummaryPopoverProps {
  po: string;
  categoria: string;
  items: OrderData[];
  children: React.ReactNode;
}

export function PoSummaryPopover({ po, categoria, items, children }: PoSummaryPopoverProps) {
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [open, setOpen] = useState(false);

  const fetchDocs = useCallback(async () => {
    const { data } = await supabase
      .from("po_documents")
      .select("id, doc_type, file_name, file_url, created_at")
      .eq("po", po)
      .eq("categoria", categoria)
      .order("created_at", { ascending: false });
    if (data) setDocs(data as DocRecord[]);
  }, [po, categoria]);

  useEffect(() => {
    if (open) fetchDocs();
  }, [open, fetchDocs]);

  const first = items[0];
  const statuses = [...new Set(items.map(d => d.statusCompraVenda).filter(Boolean))];
  const clientes = [...new Set(items.map(d => (d as any).cliente).filter(Boolean))];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">PO {po}</span>
          </div>
        </div>
        <div className="p-3 space-y-2 text-xs max-h-[300px] overflow-auto">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-muted-foreground">Fornecedor:</span> <span className="font-semibold">{first?.fornecedor || "—"}</span></div>
            <div><span className="text-muted-foreground">Itens:</span> <span className="font-semibold">{items.length}</span></div>
            <div><span className="text-muted-foreground">ETD:</span> <span className="font-mono">{first?.etd || "—"}</span></div>
            <div><span className="text-muted-foreground">ETA:</span> <span className="font-mono">{first?.eta || "—"}</span></div>
            <div><span className="text-muted-foreground">Embarque:</span> <span className="font-mono">{first?.embarque || "—"}</span></div>
            <div><span className="text-muted-foreground">Chegada HCI:</span> <span className="font-mono">{first?.chegadaHci || "—"}</span></div>
            <div><span className="text-muted-foreground">Data Compra:</span> <span className="font-mono">{(first as any)?.dataCompra || "—"}</span></div>
            <div><span className="text-muted-foreground">Entrega Forn.:</span> <span className="font-mono">{(first as any)?.entregaFornecedor || "—"}</span></div>
          </div>
          {clientes.length > 0 && (
            <div><span className="text-muted-foreground">Clientes:</span> <span className="font-semibold">{clientes.join(", ")}</span></div>
          )}
          <div className="flex flex-wrap gap-1">
            {statuses.map((s, i) => <StatusBadge key={i} status={s} />)}
          </div>
          {first?.followUp && (
            <div><span className="text-muted-foreground">Follow Up:</span> <span>{first.followUp}</span></div>
          )}

          {/* Attached docs */}
          {docs.length > 0 && (
            <div className="border-t pt-2 mt-2">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Documentos Anexados</p>
              <div className="space-y-1">
                {docs.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded border bg-card p-1.5 text-[10px] hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    <FileText className="h-3 w-3 text-primary shrink-0" />
                    <span className="flex-1 truncate text-primary hover:underline">{doc.file_name}</span>
                    <span className="text-muted-foreground shrink-0">{doc.doc_type}</span>
                    <ExternalLink className="h-2.5 w-2.5 text-primary shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {docs.length === 0 && (
            <p className="text-[10px] text-muted-foreground border-t pt-2 mt-2">Nenhum documento anexado.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
