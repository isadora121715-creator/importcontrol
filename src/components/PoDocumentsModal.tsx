import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Paperclip, Trash2, Upload, FileText, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const DOC_TYPES = [
  "Commercial Invoice",
  "Packing List",
  "Certificado de Qualidade",
  "Certificado de Origem",
  "BL (Bill of Lading)",
  "AWB (Air Waybill)",
  "Outro",
];

const ACCEPTED_FILES = ".pdf,.xlsx,.xls";

interface PoDocumentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: string;
  categoria: string;
}

interface DocRecord {
  id: string;
  po: string;
  doc_type: string;
  file_name: string;
  file_url: string;
  created_at: string;
}

export function PoDocumentsModal({ open, onOpenChange, po, categoria }: PoDocumentsModalProps) {
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [docType, setDocType] = useState("Commercial Invoice");
  const [uploading, setUploading] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    const { data, error } = await supabase
      .from("po_documents")
      .select("*")
      .eq("po", po)
      .eq("categoria", categoria)
      .order("created_at", { ascending: false });
    if (!error && data) setDocs(data as DocRecord[]);
  }, [po, categoria]);

  useEffect(() => {
    if (open) fetchDocs();
  }, [open, fetchDocs]);

  const uploadFile = async (file: File, docTypeOverride?: string, replaceDoc?: DocRecord) => {
    setUploading(true);
    try {
      const safeCat = categoria.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      const safePo = po.replace(/[^a-zA-Z0-9._-]/g, "_");
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${safeCat}/${safePo}/${Date.now()}_${safeFileName}`;
      const { error: upErr } = await supabase.storage
        .from("po-documents")
        .upload(path, file);
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("po-documents")
        .getPublicUrl(path);

      if (replaceDoc) {
        // Delete old record and insert new one
        await supabase.from("po_documents").delete().eq("id", replaceDoc.id);
        const { error: insErr } = await supabase.from("po_documents").insert({
          po,
          categoria,
          doc_type: replaceDoc.doc_type,
          file_name: file.name,
          file_url: urlData.publicUrl,
        });
        if (insErr) throw insErr;
        toast.success("Documento substituído com sucesso!");
      } else {
        const { error: insErr } = await supabase.from("po_documents").insert({
          po,
          categoria,
          doc_type: docTypeOverride || docType,
          file_name: file.name,
          file_url: urlData.publicUrl,
        });
        if (insErr) throw insErr;
        toast.success("Documento anexado com sucesso!");
      }

      fetchDocs();
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erro ao fazer upload do documento.");
    }
    setUploading(false);
    setReplacingId(null);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    e.target.value = "";
  };

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>, doc: DocRecord) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file, undefined, doc);
    e.target.value = "";
  };

  const handleDelete = async (doc: DocRecord) => {
    setLoading(true);
    await supabase.from("po_documents").delete().eq("id", doc.id);
    toast.success("Documento removido.");
    fetchDocs();
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-5 w-5 text-primary" />
            Documentos — PO {po}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload section */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo de Documento</label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10">
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "Enviando..." : "Anexar PDF/Excel"}
              <input type="file" accept={ACCEPTED_FILES} onChange={handleUpload} className="hidden" disabled={uploading} />
            </label>
          </div>
          <p className="text-[10px] text-muted-foreground">Formatos aceitos: PDF, Excel (.xlsx, .xls)</p>

          {/* Document list */}
          {docs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum documento anexado a esta PO.</p>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium truncate block text-primary hover:underline cursor-pointer">
                      {doc.file_name}
                    </a>
                    <p className="text-[10px] text-muted-foreground">{doc.doc_type} • {new Date(doc.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 px-2">
                      <ExternalLink className="h-3 w-3" /> Abrir
                    </Button>
                  </a>
                  <label className="cursor-pointer text-primary hover:text-primary/80" title="Substituir arquivo">
                    <RefreshCw className="h-3.5 w-3.5" />
                    <input type="file" accept={ACCEPTED_FILES} onChange={(e) => handleReplace(e, doc)} className="hidden" disabled={uploading} />
                  </label>
                  <button onClick={() => handleDelete(doc)} disabled={loading} className="text-muted-foreground hover:text-destructive" title="Remover">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
