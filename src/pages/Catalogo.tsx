import { useState, useMemo } from "react";
import staticCatalogo from "@/data/catalogo-static.json";
import * as XLSX from "xlsx";
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
import { Search, Plus, Trash2, Download, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  readCatalogo,
  upsertCatalogoItems,
  deleteCatalogoItem,
  type CatalogoItem,
} from "@/lib/syncCatalogo";

// ---------- helpers ----------
function fmtPreco(val: number | null): string {
  if (val === null) return "—";
  return val.toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function exportExcel(items: CatalogoItem[]) {
  const headerRow = [
    "Código",
    "Descrição",
    "Preço Compra (USD)",
    "Fornecedores",
    "Categorias",
    "Última Atualização",
  ];

  const dataRows = items.map((i) => [
    i.codigo || "",
    i.descricao || "",
    i.precoCompra ?? "",
    i.fornecedores.join("\n") || "",
    i.categorias.join("\n") || "",
    i.ultimaAtualizacao
      ? new Date(i.ultimaAtualizacao).toLocaleDateString("pt-BR")
      : "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

  ws["!cols"] = [
    { wch: 18 },
    { wch: 52 },
    { wch: 20 },
    { wch: 30 },
    { wch: 18 },
    { wch: 20 },
  ];

  const rowHeights: XLSX.RowInfo[] = [{ hpt: 28 }];
  dataRows.forEach((row) => {
    const maxLines = Math.max(
      String(row[3]).split("\n").length,
      String(row[4]).split("\n").length,
      1,
    );
    rowHeights.push({ hpt: Math.max(18, maxLines * 16) });
  });
  ws["!rows"] = rowHeights;

  const totalCols = headerRow.length;
  for (let c = 0; c < totalCols; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font:      { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
      fill:      { fgColor: { rgb: "1E3A5F" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border:    { bottom: { style: "thin", color: { rgb: "AAAAAA" } } },
    };
  }

  for (let r = 1; r <= dataRows.length; r++) {
    const bgRgb = r % 2 === 0 ? "F3F6FB" : "FFFFFF";
    for (let c = 0; c < totalCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "z", v: "" };
      const isPrice = c === 2;
      ws[addr].s = {
        font:      { sz: 10 },
        fill:      { fgColor: { rgb: bgRgb } },
        alignment: { horizontal: isPrice ? "right" : "left", vertical: "center", wrapText: true },
        border:    { bottom: { style: "hair", color: { rgb: "DDDDDD" } } },
      };
      if (isPrice && typeof ws[addr].v === "number") ws[addr].z = '#,##0.00 "USD"';
    }
  }

  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activeCell: "A2" };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Catálogo");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `catalogo_materiais_${date}.xlsx`);
}

const CATEGORIA_COLORS: Record<string, string> = {
  "Conexões": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "Válvulas": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Tubos":    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

function catColor(cat: string) {
  return CATEGORIA_COLORS[cat] ?? "bg-muted text-muted-foreground";
}

function emptyItem(): Omit<CatalogoItem, "id" | "ultimaAtualizacao"> {
  return { codigo: "", descricao: "", precoCompra: null, fornecedores: [], categorias: [] };
}

function makeKey(codigo: string, descricao: string): string {
  if (codigo) return codigo.trim().toUpperCase();
  return descricao.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 60);
}

export default function Catalogo() {
  const queryClient = useQueryClient();

  // ── dados do Supabase (fallback no JSON estático quando vazio) ───────────
  const { data: rawCatalog, isLoading, refetch } = useQuery({
    queryKey: ["catalogo"],
    queryFn:  readCatalogo,
    staleTime: 0,              // always consider stale — re-fetch on every mount
    gcTime:    10 * 60_000,
    refetchOnMount: "always",  // fetch fresh every time the page is opened
    refetchOnWindowFocus: false,
  });
  // Supabase tem prioridade; se retornar vazio usa os dados embutidos no app
  const catalog: CatalogoItem[] =
    rawCatalog && rawCatalog.length > 0
      ? rawCatalog
      : (staticCatalogo as unknown as CatalogoItem[]);

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("Todas");

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editItem, setEditItem] = useState<CatalogoItem | null>(null);
  const [form, setForm] = useState(emptyItem());
  const [formFornecedor, setFormFornecedor] = useState("");
  const [formCategoria, setFormCategoria] = useState("");

  // derived
  const categories = useMemo(() => {
    const s = new Set<string>();
    catalog.forEach((i) => i.categorias.forEach((c) => s.add(c)));
    return Array.from(s).sort();
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((i) => {
      const matchSearch =
        !q ||
        i.codigo.toLowerCase().includes(q) ||
        i.descricao.toLowerCase().includes(q) ||
        i.fornecedores.some((f) => f.toLowerCase().includes(q));
      const matchCat = filterCat === "Todas" || i.categorias.includes(filterCat);
      return matchSearch && matchCat;
    });
  }, [catalog, search, filterCat]);

  // ---------- dialog helpers ----------
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
        fornecedores:      form.fornecedores,
        categorias:        form.categorias,
        ultimaAtualizacao: now,
      };
      await upsertCatalogoItems([item]);
      await queryClient.invalidateQueries({ queryKey: ["catalogo"] });
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
    toast.success("Item removido.");
  }

  // ---------- render ----------
  return (
    <div className="min-h-screen bg-background">
      <HeaderTabs />

      <main className="mx-auto max-w-[1600px] px-6 py-6 space-y-6">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Catálogo de Materiais</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {catalog.length} {catalog.length === 1 ? "item" : "itens"} —
              sincronizado automaticamente ao importar Conexões, Válvulas e Tubos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              Recarregar
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportExcel(filtered)} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-1" />
              Exportar Excel
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Novo Item
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total de Itens</p>
            <p className="text-2xl font-bold mt-1">{catalog.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Com Preço</p>
            <p className="text-2xl font-bold mt-1">
              {catalog.filter((i) => i.precoCompra !== null).length}
            </p>
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

        {/* Filters */}
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
                onClick={() => setFilterCat(c)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  filterCat === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-transparent hover:border-border"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando catálogo…</span>
          </div>
        )}

        {/* Table */}
        {!isLoading && (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-32">Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-36 text-right">Preço Compra</TableHead>
                  <TableHead>Fornecedores</TableHead>
                  <TableHead>Categorias</TableHead>
                  <TableHead className="w-36">Última Atualização</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      {catalog.length === 0
                        ? "Nenhum item ainda. Importe uma planilha de Conexões, Válvulas ou Tubos para popular o catálogo."
                        : "Nenhum resultado para a busca atual."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => openEdit(item)}
                    >
                      <TableCell className="font-mono text-xs font-medium">
                        {item.codigo || <span className="text-muted-foreground italic">—</span>}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={item.descricao}>
                        {item.descricao || <span className="text-muted-foreground italic">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {fmtPreco(item.precoCompra)}
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
                          onClick={() => handleDeleteItem(item.id)}
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
        )}

        {filtered.length > 0 && !isLoading && (
          <p className="text-xs text-muted-foreground text-right">
            Exibindo {filtered.length} de {catalog.length} itens
          </p>
        )}
      </main>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Item" : "Novo Item"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
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
            </div>

            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input
                placeholder="Descrição do material"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>

            {/* Fornecedores */}
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

            {/* Categorias */}
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
