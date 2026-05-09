import { useState, useMemo, useRef } from "react";
import { usePageState } from "@/hooks/usePageState";
import staticCatalogo from "@/data/catalogo-static.json";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoHci from "@/assets/logo-hci.jpeg";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HeaderTabs } from "@/components/HeaderTabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Trash2, Download, RefreshCw, Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import {
  readCatalogoComPedidos,
  upsertCatalogoItems,
  deleteCatalogoItem,
  type CatalogoItem,
} from "@/lib/syncCatalogo";

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtPreco(val: number | null): string {
  if (val === null) return "—";
  return `$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtVenda(val: number | null): string {
  if (val === null) return "—";
  return `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Célula de preço: se houver múltiplos valores únicos, exibe todos empilhados. */
function PriceCell({
  primary,
  all,
  fmt,
  colorClass = "",
}: {
  primary: number | null;
  all?: number[];
  fmt: (v: number | null) => string;
  colorClass?: string;
}) {
  const unique = Array.from(new Set((all ?? []).filter((v) => v > 0))).sort((a, b) => a - b);

  if (unique.length <= 1) {
    return (
      <span className={`tabular-nums font-medium ${colorClass}`}>
        {fmt(primary)}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      {unique.map((v, idx) => (
        <span
          key={v}
          className={`tabular-nums ${
            idx === 0
              ? `font-semibold ${colorClass}`
              : "text-[11px] text-muted-foreground"
          }`}
        >
          {fmt(v)}
        </span>
      ))}
    </div>
  );
}

function makeKey(codigo: string, descricao: string): string {
  if (codigo) return codigo.trim().toUpperCase();
  return descricao.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 60);
}

const CATEGORY_ORDER = ["Conexões", "Tubos", "Válvulas"];

const CATEGORIA_COLORS: Record<string, string> = {
  "Conexões": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "Válvulas": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Tubos":    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

function catColor(cat: string) {
  return CATEGORIA_COLORS[cat] ?? "bg-muted text-muted-foreground";
}

function emptyItem(): Omit<CatalogoItem, "id" | "ultimaAtualizacao"> {
  return { codigo: "", descricao: "", precoCompra: null, precoVenda: null, fornecedores: [], categorias: [] };
}

// ── load image as base64 for jsPDF ───────────────────────────────────────────
async function imgToBase64(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(""); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg"));
    };
    img.onerror = () => resolve("");
    img.src = src;
  });
}

// ── Excel export (one sheet per category + "Todos") ──────────────────────────
function exportExcel(items: CatalogoItem[]) {
  const wb = XLSX.utils.book_new();
  const today = new Date().toISOString().slice(0, 10);

  const HEADER = ["Código", "Descrição", "Preço Compra (USD)", "Preço Venda (R$)", "Fornecedores", "Categorias", "Última Atualização"];
  const colWidths = [{ wch: 18 }, { wch: 52 }, { wch: 20 }, { wch: 18 }, { wch: 32 }, { wch: 18 }, { wch: 20 }];

  const toRows = (list: CatalogoItem[]) =>
    list.map((i) => {
      // Para Excel: se houver múltiplos preços, exibe todos separados por " | "
      const compraExcel = i.precosCompra && i.precosCompra.length > 1
        ? i.precosCompra.map((v) => `$ ${v.toFixed(2)}`).join(" | ")
        : (i.precoCompra ?? "");
      const vendaExcel = i.precosVenda && i.precosVenda.length > 1
        ? i.precosVenda.map((v) => `R$ ${v.toFixed(2)}`).join(" | ")
        : (i.precoVenda ?? "");
      return [
        i.codigo || "",
        i.descricao || "",
        compraExcel,
        vendaExcel,
        i.fornecedores.join(", ") || "",
        i.categorias.join(", ") || "",
        i.ultimaAtualizacao ? new Date(i.ultimaAtualizacao).toLocaleDateString("pt-BR") : "",
      ];
    });

  const addSheet = (name: string, list: CatalogoItem[]) => {
    const ws = XLSX.utils.aoa_to_sheet([HEADER, ...toRows(list)]);
    ws["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  // Aba "Todos"
  addSheet("Todos", items);

  // Uma aba por categoria (na ordem padrão + eventuais categorias extras)
  const allCats = CATEGORY_ORDER.concat(
    Array.from(new Set(items.flatMap((i) => i.categorias))).filter(
      (c) => !CATEGORY_ORDER.includes(c),
    ),
  );
  for (const cat of allCats) {
    const catItems = items.filter((i) => i.categorias.includes(cat));
    if (catItems.length > 0) addSheet(cat, catItems);
  }

  XLSX.writeFile(wb, `catalogo_materiais_${today}.xlsx`);
}

// ── PDF export ────────────────────────────────────────────────────────────────
async function exportPDF(items: CatalogoItem[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString("pt-BR");
  const BLUE: [number, number, number] = [30, 64, 175];
  const BLUE_LIGHT: [number, number, number] = [239, 246, 255];

  // Pre-load logo
  const logoB64 = await imgToBase64(logoHci);

  let firstPage = true;

  const drawHeader = (subtitle: string) => {
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, pageW, 22, "F");

    // Logo HCI (image)
    if (logoB64) {
      try {
        doc.addImage(logoB64, "JPEG", 6, 3, 16, 16);
      } catch {
        // fallback: text
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("HCI", 10, 14);
      }
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("HCI", 10, 14);
    }

    // Divider
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.4);
    doc.line(26, 4, 26, 18);

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Catálogo de Materiais — HCI", 29, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(subtitle, 29, 17);

    // Date
    doc.setFontSize(8);
    doc.text(`Gerado em: ${today}`, pageW - 8, 14, { align: "right" });
  };

  const drawFooter = (pageNum: number) => {
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `HCI Importcontrol — Catálogo de Materiais — ${today}  |  Pág. ${pageNum}`,
      pageW / 2,
      pageH - 4,
      { align: "center" },
    );
  };

  let pageCounter = 1;

  // Group items by category
  const allCats = CATEGORY_ORDER.concat(
    Array.from(new Set(items.flatMap((i) => i.categorias))).filter(
      (c) => !CATEGORY_ORDER.includes(c),
    ),
  );

  for (const cat of allCats) {
    const catItems = items.filter((i) => i.categorias.includes(cat));
    if (catItems.length === 0) continue;

    if (!firstPage) {
      doc.addPage();
      pageCounter++;
    }
    firstPage = false;

    drawHeader(cat);

    const tableBody = catItems.map((i) => {
      const compraPdf = i.precosCompra && i.precosCompra.length > 1
        ? i.precosCompra.map(fmtPreco).join("\n")
        : fmtPreco(i.precoCompra);
      const vendaPdf = i.precosVenda && i.precosVenda.length > 1
        ? i.precosVenda.map(fmtVenda).join("\n")
        : fmtVenda(i.precoVenda);
      return [
        i.codigo || "—",
        i.descricao || "—",
        compraPdf,
        vendaPdf,
        i.fornecedores.join("\n") || "—",
        new Date(i.ultimaAtualizacao).toLocaleDateString("pt-BR"),
      ];
    });

    autoTable(doc, {
      startY: 26,
      head: [["Código", "Descrição", "Preço Compra (USD)", "Preço Venda (R$)", "Fornecedores", "Atualização"]],
      body: tableBody,
      headStyles: {
        fillColor: BLUE,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: { fontSize: 7.5 },
      alternateRowStyles: { fillColor: BLUE_LIGHT },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 96 },
        2: { cellWidth: 30, halign: "right" },
        3: { cellWidth: 28, halign: "right" },
        4: { cellWidth: 52 },
        5: { cellWidth: 24, halign: "center" },
      },
      margin: { left: 8, right: 8 },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          pageCounter++;
          drawHeader(cat);
        }
        drawFooter(pageCounter);
      },
    });
  }

  doc.save(`catalogo_hci_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function Catalogo() {
  const queryClient = useQueryClient();
  const isRefetchingRef = useRef(false);

  // ── dados do Supabase (fallback no JSON estático quando vazio) ────────────
  const { data: rawCatalog, isLoading, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["catalogo"],
    queryFn:  readCatalogoComPedidos,
    staleTime: 0,
    gcTime:    10 * 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const catalog: CatalogoItem[] =
    rawCatalog && rawCatalog.length > 0
      ? rawCatalog
      : (staticCatalogo as unknown as CatalogoItem[]);

  // ── filters ───────────────────────────────────────────────────────────────
  const [search, setSearch] = usePageState<string>("catalogo.search", "");
  const [activeTab, setActiveTab] = usePageState<string>("catalogo.activeTab", "Todas");

  // ── dialog state ──────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen]       = useState(false);
  const [saving, setSaving]               = useState(false);
  const [editItem, setEditItem]           = useState<CatalogoItem | null>(null);
  const [form, setForm]                   = useState(emptyItem());
  const [formFornecedor, setFormFornecedor] = useState("");
  const [formCategoria, setFormCategoria]   = useState("");
  const [pdfExporting, setPdfExporting]     = useState(false);

  // ── derived data ──────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const fromData = new Set<string>();
    catalog.forEach((i) => i.categorias.forEach((c) => fromData.add(c)));
    // Keep canonical order
    return CATEGORY_ORDER.filter((c) => fromData.has(c)).concat(
      Array.from(fromData).filter((c) => !CATEGORY_ORDER.includes(c)).sort(),
    );
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((i) => {
      const matchSearch =
        !q ||
        i.codigo.toLowerCase().includes(q) ||
        i.descricao.toLowerCase().includes(q) ||
        i.fornecedores.some((f) => f.toLowerCase().includes(q));
      const matchCat = activeTab === "Todas" || i.categorias.includes(activeTab);
      return matchSearch && matchCat;
    });
  }, [catalog, search, activeTab]);

  // Items per category for stat badges
  const countByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    catalog.forEach((i) => i.categorias.forEach((c) => { map[c] = (map[c] ?? 0) + 1; }));
    return map;
  }, [catalog]);

  // ── reload ────────────────────────────────────────────────────────────────
  const handleReload = async () => {
    if (isRefetchingRef.current) return;
    isRefetchingRef.current = true;
    try {
      await queryClient.invalidateQueries({ queryKey: ["catalogo"] });
      await queryClient.refetchQueries({ queryKey: ["catalogo"] });
      toast.success("Catálogo recarregado com sucesso.");
    } finally {
      isRefetchingRef.current = false;
    }
  };

  // ── dialog helpers ────────────────────────────────────────────────────────
  function openAdd() {
    setEditItem(null);
    setForm(emptyItem());
    setFormFornecedor("");
    setFormCategoria("");
    setDialogOpen(true);
  }

  function openEdit(item: CatalogoItem) {
    setEditItem(item);
    setForm({
      codigo:       item.codigo,
      descricao:    item.descricao,
      precoCompra:  item.precoCompra,
      precoVenda:   item.precoVenda,
      fornecedores: [...item.fornecedores],
      categorias:   [...item.categorias],
    });
    setFormFornecedor("");
    setFormCategoria("");
    setDialogOpen(true);
  }

  function addFormFornecedor() {
    const v = formFornecedor.trim();
    if (!v || form.fornecedores.includes(v)) return;
    setForm((f) => ({ ...f, fornecedores: [...f.fornecedores, v] }));
    setFormFornecedor("");
  }

  function removeFormFornecedor(f: string) {
    setForm((prev) => ({ ...prev, fornecedores: prev.fornecedores.filter((x) => x !== f) }));
  }

  function addFormCategoria() {
    const v = formCategoria.trim();
    if (!v || form.categorias.includes(v)) return;
    setForm((f) => ({ ...f, categorias: [...f.categorias, v] }));
    setFormCategoria("");
  }

  function removeFormCategoria(c: string) {
    setForm((prev) => ({ ...prev, categorias: prev.categorias.filter((x) => x !== c) }));
  }

  async function saveDialog() {
    if (!form.codigo && !form.descricao) {
      toast.error("Informe ao menos o código ou a descrição.");
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const key = makeKey(form.codigo, form.descricao);
      const item: CatalogoItem = {
        id:                editItem?.id ?? key,
        codigo:            form.codigo,
        descricao:         form.descricao,
        precoCompra:       form.precoCompra,
        precoVenda:        form.precoVenda,
        fornecedores:      form.fornecedores,
        categorias:        form.categorias,
        ultimaAtualizacao: now,
      };
      await upsertCatalogoItems([item]);
      await queryClient.invalidateQueries({ queryKey: ["catalogo"] });
      await queryClient.refetchQueries({ queryKey: ["catalogo"] });
      setDialogOpen(false);
      toast.success(editItem ? "Item atualizado." : "Item adicionado.");
    } catch (e) {
      toast.error("Erro ao salvar item.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(id: string) {
    await deleteCatalogoItem(id);
    await queryClient.invalidateQueries({ queryKey: ["catalogo"] });
    await queryClient.refetchQueries({ queryKey: ["catalogo"] });
    toast.success("Item removido.");
  }

  const handleExportPDF = async () => {
    if (filtered.length === 0) { toast.info("Nenhum item para exportar."); return; }
    setPdfExporting(true);
    try {
      await exportPDF(filtered);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar PDF.");
    } finally {
      setPdfExporting(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <HeaderTabs />

      <main className="mx-auto max-w-[1600px] px-6 py-6 space-y-6">

        {/* ── Header row ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Catálogo de Materiais</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {catalog.length} {catalog.length === 1 ? "item" : "itens"} —
              sincronizado automaticamente ao importar Conexões, Válvulas e Tubos
              {dataUpdatedAt > 0 && (
                <span className="ml-2 opacity-70">
                  · atualizado às {new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReload}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Recarregar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportExcel(filtered)}
              disabled={filtered.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Exportar Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={filtered.length === 0 || pdfExporting}
            >
              {pdfExporting
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <FileDown className="h-4 w-4 mr-1" />}
              Exportar PDF
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Novo Item
            </Button>
          </div>
        </div>

        {/* ── KPI cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total de Itens</p>
            <p className="text-2xl font-bold mt-1">{catalog.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Com Preço</p>
            <p className="text-2xl font-bold mt-1">{catalog.filter((i) => i.precoCompra !== null).length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Fornecedores Únicos</p>
            <p className="text-2xl font-bold mt-1">
              {new Set(catalog.flatMap((i) => i.fornecedores)).size}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Categorias</p>
            <p className="text-2xl font-bold mt-1">{categories.length}</p>
          </div>
        </div>

        {/* ── Search + Category tabs ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar código, descrição ou fornecedor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {["Todas", ...categories].map((c) => (
              <button
                key={c}
                onClick={() => setActiveTab(c)}
                className={`relative px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                  activeTab === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-transparent hover:border-border"
                }`}
              >
                {c}
                {c !== "Todas" && countByCategory[c] != null && (
                  <span
                    className={`ml-1.5 inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${
                      activeTab === c ? "bg-white/25 text-white" : "bg-background text-muted-foreground"
                    }`}
                  >
                    {countByCategory[c]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando catálogo…</span>
          </div>
        )}

        {/* ── Content: if "Todas" show per-category sections, else single table */}
        {!isLoading && activeTab === "Todas" && !search && (
          <div className="space-y-8">
            {categories.length === 0 ? (
              <EmptyState />
            ) : (
              categories.map((cat) => {
                const catItems = catalog.filter((i) => i.categorias.includes(cat));
                if (catItems.length === 0) return null;
                return (
                  <CategorySection
                    key={cat}
                    cat={cat}
                    items={catItems}
                    onEdit={openEdit}
                    onDelete={handleDeleteItem}
                  />
                );
              })
            )}
          </div>
        )}

        {!isLoading && (activeTab !== "Todas" || !!search) && (
          <>
            {activeTab !== "Todas" && (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${catColor(activeTab)}`}>
                {activeTab} — {filtered.length} {filtered.length === 1 ? "item" : "itens"}
              </div>
            )}
            <CatalogTable
              items={filtered}
              onEdit={openEdit}
              onDelete={handleDeleteItem}
              emptyMessage={
                catalog.length === 0
                  ? "Nenhum item ainda. Importe uma planilha de Conexões, Válvulas ou Tubos para popular o catálogo."
                  : "Nenhum resultado para a busca atual."
              }
            />
          </>
        )}

        {filtered.length > 0 && !isLoading && (
          <p className="text-xs text-muted-foreground text-right">
            Exibindo {filtered.length} de {catalog.length} itens
          </p>
        )}
      </main>

      {/* ── Add / Edit Dialog ──────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Item" : "Novo Item"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Código</Label>
                <Input
                  placeholder="ex: TUB-001"
                  value={form.codigo}
                  onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Preço de Compra (USD)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={form.precoCompra ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      precoCompra: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Preço de Venda (R$) <span className="text-xs text-muted-foreground font-normal">opcional</span></Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0,00"
                  value={form.precoVenda ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      precoVenda: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input
                placeholder="Descrição do material"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Fornecedores</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do fornecedor"
                  value={formFornecedor}
                  onChange={(e) => setFormFornecedor(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFormFornecedor())}
                />
                <Button type="button" variant="outline" size="sm" onClick={addFormFornecedor}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 min-h-[28px]">
                {form.fornecedores.map((f) => (
                  <Badge
                    key={f}
                    variant="secondary"
                    className="cursor-pointer text-xs pr-1 gap-1"
                    onClick={() => removeFormFornecedor(f)}
                  >
                    {f}
                    <span className="text-muted-foreground hover:text-foreground">×</span>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Categorias</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Conexões / Válvulas / Tubos"
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFormCategoria())}
                />
                <Button type="button" variant="outline" size="sm" onClick={addFormCategoria}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 min-h-[28px]">
                {form.categorias.map((c) => (
                  <span
                    key={c}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${catColor(c)}`}
                    onClick={() => removeFormCategoria(c)}
                  >
                    {c}
                    <span>×</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={saveDialog} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editItem ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function CategorySection({
  cat,
  items,
  onEdit,
  onDelete,
}: {
  cat: string;
  items: CatalogoItem[];
  onEdit: (item: CatalogoItem) => void;
  onDelete: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-xl border overflow-hidden">
      {/* Section header */}
      <button
        className={`w-full flex items-center justify-between px-4 py-3 text-left font-semibold text-sm transition-colors hover:bg-muted/40 ${catColor(cat)} border-b`}
        onClick={() => setCollapsed((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${catColor(cat)}`}
          >
            {cat}
          </span>
          <span className="text-muted-foreground font-normal">
            {items.length} {items.length === 1 ? "item" : "itens"}
          </span>
        </span>
        <span className="text-muted-foreground text-xs">{collapsed ? "▼ Expandir" : "▲ Recolher"}</span>
      </button>

      {!collapsed && (
        <CatalogTable
          items={items}
          onEdit={onEdit}
          onDelete={onDelete}
          emptyMessage="Nenhum item nesta categoria."
          compact
        />
      )}
    </div>
  );
}

function CatalogTable({
  items,
  onEdit,
  onDelete,
  emptyMessage,
  compact = false,
}: {
  items: CatalogoItem[];
  onEdit: (item: CatalogoItem) => void;
  onDelete: (id: string) => void;
  emptyMessage: string;
  compact?: boolean;
}) {
  return (
    <div className={`${compact ? "" : "rounded-lg border overflow-hidden"}`}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-32">Código</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="w-32 text-right">Preço Compra</TableHead>
            <TableHead className="w-32 text-right">Preço Venda</TableHead>
            <TableHead>Fornecedores</TableHead>
            <TableHead>Categorias</TableHead>
            <TableHead className="w-32">Atualização</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => onEdit(item)}
              >
                <TableCell className="font-mono text-xs font-medium">
                  {item.codigo || <span className="text-muted-foreground italic">—</span>}
                </TableCell>
                <TableCell className="max-w-xs" title={item.descricao}>
                  <span className="line-clamp-2">{item.descricao || <span className="text-muted-foreground italic">—</span>}</span>
                </TableCell>
                <TableCell className="text-right">
                  <PriceCell
                    primary={item.precoCompra}
                    all={item.precosCompra}
                    fmt={fmtPreco}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <PriceCell
                    primary={item.precoVenda}
                    all={item.precosVenda}
                    fmt={fmtVenda}
                    colorClass="text-emerald-600 dark:text-emerald-400"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {item.fornecedores.length === 0 ? (
                      <span className="text-muted-foreground text-xs italic">—</span>
                    ) : (
                      item.fornecedores.map((f) => (
                        <Badge key={f} variant="secondary" className="text-xs">
                          {f}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {item.categorias.map((c) => (
                      <span
                        key={c}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${catColor(c)}`}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(item.ultimaAtualizacao).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border bg-muted/30 p-10 text-center space-y-2">
      <p className="text-base font-semibold">Nenhum item no catálogo</p>
      <p className="text-sm text-muted-foreground">
        Importe uma planilha de Conexões, Válvulas ou Tubos para popular o catálogo automaticamente.
      </p>
    </div>
  );
}
