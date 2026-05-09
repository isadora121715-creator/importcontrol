import { Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";

interface FilterSidebarProps {
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  clienteFilter: string;
  setClienteFilter: (v: string) => void;
  fornecedorFilter: string;
  setFornecedorFilter: (v: string) => void;
  poFilter: string;
  setPoFilter: (v: string) => void;
  tipoFilter: string;
  setTipoFilter: (v: string) => void;
  statusOptions: string[];
  clientes: string[];
  fornecedores: string[];
  poList: string[];
  tiposMaterial: string[];
  hasActiveFilter: boolean;
}

function FilterContent({
  statusFilter, setStatusFilter,
  clienteFilter, setClienteFilter,
  fornecedorFilter, setFornecedorFilter,
  poFilter, setPoFilter,
  tipoFilter, setTipoFilter,
  statusOptions, clientes, fornecedores, poList, tiposMaterial,
  hasActiveFilter,
}: FilterSidebarProps) {
  return (
    <div className="space-y-3 p-3">
      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Status Compra/Venda</label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-full text-xs mt-1">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Cliente</label>
        <Select value={clienteFilter} onValueChange={setClienteFilter}>
          <SelectTrigger className="h-8 w-full text-xs mt-1">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {clientes.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Fornecedor</label>
        <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
          <SelectTrigger className="h-8 w-full text-xs mt-1">
            <SelectValue placeholder="Fornecedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {fornecedores.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tipo de Material</label>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="h-8 w-full text-xs mt-1">
            <SelectValue placeholder="Tipo de Material" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {tiposMaterial.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">PO</label>
        <input
          type="text"
          placeholder="Digitar PO..."
          className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const val = (e.target as HTMLInputElement).value.trim();
              if (val && poList.includes(val)) {
                setPoFilter(val);
              } else if (val === "") {
                setPoFilter("all");
              } else {
                toast.error("PO não encontrada");
              }
            }
          }}
        />
        <Select value={poFilter} onValueChange={setPoFilter}>
          <SelectTrigger className="h-8 w-full text-xs mt-1">
            <SelectValue placeholder="PO" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {poList.map((po) => (
              <SelectItem key={po} value={po}>{po}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilter && (
        <button
          onClick={() => { setStatusFilter("all"); setClienteFilter("all"); setFornecedorFilter("all"); setPoFilter("all"); setTipoFilter("all"); }}
          className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed py-1.5 text-xs text-primary hover:bg-primary/5"
        >
          <X className="h-3 w-3" />
          Limpar filtros
        </button>
      )}
    </div>
  );
}

export function FilterSidebar(props: FilterSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Desktop sidebar (lg+) ─────────────────────────────────── */}
      <div className={`hidden lg:block shrink-0 transition-all duration-300 ${collapsed ? "w-10" : "w-[220px]"}`}>
        <div className="sticky top-[65px] rounded-lg border bg-card shadow-sm">
          <div className="flex items-center justify-between p-3 border-b">
            {!collapsed && (
              <div className="flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold">Filtros</span>
              </div>
            )}
            <button onClick={() => setCollapsed((c) => !c)} className="text-muted-foreground hover:text-foreground">
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          {!collapsed && <FilterContent {...props} />}
        </div>
      </div>

      {/* ── Mobile trigger button (< lg) ──────────────────────────── */}
      <div className="lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted transition-colors"
        >
          <Filter className="h-4 w-4 text-muted-foreground" />
          Filtros
          {props.hasActiveFilter && (
            <span className="h-2 w-2 rounded-full bg-primary" />
          )}
        </button>

        {/* Mobile overlay drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            {/* Drawer panel */}
            <div className="relative z-10 w-72 max-w-[85vw] bg-background shadow-2xl overflow-y-auto flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-background z-10">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Filtros</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <FilterContent {...props} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
