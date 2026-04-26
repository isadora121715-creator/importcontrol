import { useState, useMemo } from "react";
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
import { Search, Plus, Trash2, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  readCatalogo,
  writeCatalogo,
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

function exportCSV(items: CatalogoItem[]) {
  const header = ["Código", "Descrição", "Preço Compra (USD)", "Fornecedores", "Categorias", "Última Atualização"];
  const rows = items.map((i) => [
    i.codigo,
    i.descricao,
    i.precoCompra ?? "",
    i.fornecedores.join("; "),
    i.categorias.join("; "),
    i.ultimaAtualizacao,
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "catalogo_materiais.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const CATEGORIA_COLORS: Record<string, string> = {
  "Conexões":  "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "Válvulas":  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Tubos":     "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

function catColor(cat: string) {
  return CATEGORIA_COLORS[cat] ?? "bg-muted text-muted-foreground";
}

// ---------- empty item factory ----------
function emptyItem(): Omit<CatalogoItem, "id" | "ultimaAtualizacao"> {
  return { codigo: "", descricao: "", precoCompra: null, fornecedores: [], categorias: [] };
}

export default function Catalogo() {
  const [catalog, setCatalog] = useState<CatalogoItem[]>(() => readCatalogo());
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("Todas");

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<CatalogoItem | null>(null);
  const [form, setForm] = useState(emptyItem());
  const [formFornecedor, setFormFornecedor] = useState("");
  const [formCategoria, setFormCategoria] = useState("");

  // re-load from LS
  function reload() {
    setCatalog(readCatalogo());
    toast.success("Catálogo recarregado.");
  }

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
      const matchCat =
        filterCat === "Todas" || i.categorias.includes(filterCat);
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
      codigo: item.codigo,
      descricao: item.descricao,
      precoCompra: item.precoCompra,
      fornecedores: [...item.fornecedores],
      categorias: [...item.categorias],
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

  function saveDialog() {
    if (!form.codigo && !form.descricao) {
      toast.error("Informe ao menos o código ou a descrição.");
      return;
    }
    const now = new Date().toISOString();
    const key = form.codigo
      ? form.codigo.trim().toUpperCase()
      : form.descricao.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 60);

    const current = readCatalogo();
    const byKey = new Map(current.map((i) => [i.id, i]));

    if (editItem) {
      const item = byKey.get(editItem.id);
      if (item) {
        item.codigo = form.codigo;
        item.descricao = form.descricao;
        item.precoCompra = form.precoCompra;
        item.fornecedores = form.fornecedores;
        item.categorias = form.categorias;
        item.ultimaAtualizacao = now;
      }
    } else {
      if (byKey.has(key)) {
        toast.error("Já existe um item com esse código/descrição.");
        return;
      }
      byKey.set(key, {
        id: key,
        codigo: form.codigo,
        descricao: form.descricao,
        precoCompra: form.precoCompra,
        fornecedores: form.fornecedores,
        categorias: form.categorias,
        ultimaAtualizacao: now,
      });
    }

    const updated = Array.from(byKey.values());
    writeCatalogo(updated);
    setCatalog(updated);
    setDialogOpen(false);
    toast.success(editItem ? "Item atualizado." : "Item adicionado.");
  }

  function deleteItem(id: string) {
    const updated = catalog.filter((i) => i.id !== id);
    writeCatalogo(updated);
    setCatalog(updated);
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
            <Button variant="outline" size="sm" onClick={reload}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Recarregar
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCSV(filtered)}>
              <Download className="h-4 w-4 mr-1" />
              Exportar CSV
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

        {/* Table */}
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
                        onClick={() => deleteItem(item.id)}
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

        {filtered.length > 0 && (
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveDialog}>{editItem ? "Salvar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
