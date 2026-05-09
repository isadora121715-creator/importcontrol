import { useDeferredValue, useMemo, useRef, useState, useEffect } from "react";
import { usePageState } from "@/hooks/usePageState";
import { useLocation } from "react-router-dom";
import { Package, Upload, FileSpreadsheet, Loader2, Download, Clock, BarChart2, Eye, FileDown } from "lucide-react";
import logoHci from "@/assets/logo-hci.jpeg";
import logoFluxo from "@/assets/logo-fluxo.jpeg";
import { usePedidos } from "@/hooks/usePedidos";
import { DashboardCards } from "@/components/DashboardCards";
import { SupplierStatusTable } from "@/components/SupplierStatusTable";
import { DelayAlertTable } from "@/components/DelayAlertTable";
import { FilterSidebar } from "@/components/FilterSidebar";
import { HeaderTabs } from "@/components/HeaderTabs";
import { downloadDashboard } from "@/lib/downloadDashboard";
import { downloadValvulasDashboard } from "@/lib/downloadValvulasDashboard";
import { downloadTubosDashboard } from "@/lib/downloadTubosDashboard";
import { downloadEmbarquesDashboard } from "@/lib/downloadEmbarquesDashboard";
import { downloadPedidosXLSX, downloadPedidosPDF } from "@/lib/downloadPedidosReport";
import { toast } from "sonner";
import { DashboardErrorState, DashboardLoadingSkeleton } from "@/components/dashboard/DashboardStates";
import { DashboardChartsSection, DashboardInsightsSection } from "@/components/dashboard/LazyDashboardSections";
import { MonthlyAnalysis } from "@/components/MonthlyAnalysis";

const CONEXOES_STATUS_OPTIONS = ["No prazo", "Atrasado", "Crítico", "Chegou", "Estoque", "Verificar aéreo"];

const Index = () => {
  const location = useLocation();
  const path = location.pathname.toLowerCase();
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isValvula = path.startsWith("/valvulas") || hostname.includes("valvula");
  const isTubos = path.startsWith("/tubos") || hostname.includes("tubos");
  const isEmbarques = path.startsWith("/embarques") || hostname.includes("embarques");
  const activeCategory = isValvula ? "Válvulas" : isTubos ? "Tubos" : isEmbarques ? "Embarques" : "Conexões";
  
  const {
    data,
    loading,
    fileName,
    handleFileUpload,
    lastUpdated,
    isRefreshing,
    isUpdating,
    updateProgress,
    updateMessage,
    errorMessage,
    retry,
  } = usePedidos(activeCategory);

  const [activeTab, setActiveTab] = usePageState<"overview" | "monthly">("conexoes.activeTab", "overview");
  const [statusFilter, setStatusFilter] = usePageState<string>("conexoes.statusFilter", "all");
  const [clienteFilter, setClienteFilter] = usePageState<string>("conexoes.clienteFilter", "all");
  const [fornecedorFilter, setFornecedorFilter] = usePageState<string>("conexoes.fornecedorFilter", "all");
  const [poFilter, setPoFilter] = usePageState<string>("conexoes.poFilter", "all");
  const [tipoFilter, setTipoFilter] = usePageState<string>("conexoes.tipoFilter", "all");

  const delayRef = useRef<HTMLDivElement>(null);
  const deferredData = useDeferredValue(data);

  const clientes = useMemo(() => {
    const set = new Set<string>();
    deferredData.forEach((d) => { if (d.cliente) set.add(d.cliente); });
    return Array.from(set).sort();
  }, [deferredData]);

  const fornecedores = useMemo(() => {
    const set = new Set<string>();
    deferredData.forEach((d) => { if (d.fornecedor) set.add(d.fornecedor); });
    return Array.from(set).sort();
  }, [deferredData]);

  const poList = useMemo(() => {
    const set = new Set<string>();
    deferredData.forEach((d) => { if (d.po) set.add(d.po); });
    return Array.from(set).sort();
  }, [deferredData]);

  const tiposMaterial = useMemo(() => {
    const set = new Set<string>();
    deferredData.forEach((d) => {
      if (d.descricao) {
        const match = d.descricao.match(/^[0-9"'/-\s]*([A-ZÇÃÕÁÉÍÓÚÂÊÔ]+)/i);
        if (match && match[1]) {
          set.add(match[1].toUpperCase());
        }
      }
    });
    return Array.from(set).sort();
  }, [deferredData]);

  const statusOptions = useMemo(() => {
    if (activeCategory === "Conexões") return CONEXOES_STATUS_OPTIONS;
    const set = new Set<string>();
    deferredData.forEach((d) => { if (d.statusCompraVenda) set.add(d.statusCompraVenda); });
    return Array.from(set).sort();
  }, [deferredData, activeCategory]);

  const filteredData = useMemo(() => {
    return deferredData.filter((d) => {
      if (statusFilter !== "all" && d.statusCompraVenda !== statusFilter) return false;
      if (clienteFilter !== "all" && d.cliente !== clienteFilter) return false;
      if (fornecedorFilter !== "all" && d.fornecedor !== fornecedorFilter) return false;
      if (poFilter !== "all" && d.po !== poFilter) return false;
      if (tipoFilter !== "all") {
        if (!d.descricao) return false;
        const match = d.descricao.match(/^[0-9"'/-\s]*([A-ZÇÃÕÁÉÍÓÚÂÊÔ]+)/i);
        if (!match || match[1].toUpperCase() !== tipoFilter) return false;
      }
      return true;
    });
  }, [deferredData, statusFilter, clienteFilter, fornecedorFilter, poFilter, tipoFilter]);

  const handleStatusClick = (status: string) => {
    setStatusFilter(status);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePoClick = (po: string) => {
    setPoFilter(po);
  };

  const hasActiveFilter = statusFilter !== "all" || clienteFilter !== "all" || fornecedorFilter !== "all" || poFilter !== "all" || tipoFilter !== "all";

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <HeaderTabs />
        <main className="mx-auto max-w-[1600px] p-6">
          <DashboardLoadingSkeleton />
        </main>
      </div>
    );
  }

  if (errorMessage && filteredData.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <HeaderTabs />
        <main className="mx-auto max-w-[1600px] p-6">
          <DashboardErrorState message={errorMessage} onRetry={() => void retry()} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <HeaderTabs />
      <main className="mx-auto max-w-[1600px] p-6 space-y-8">
        {/* View Tabs */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === "overview"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="h-4 w-4" />
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab("monthly")}
              className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === "monthly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart2 className="h-4 w-4" />
              Análise Mensal
            </button>
          </div>
        </div>

        {activeTab === "overview" ? (
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Dashboard
            </h2>
            <div className="flex gap-4">
              <FilterSidebar
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                clienteFilter={clienteFilter}
                setClienteFilter={setClienteFilter}
                fornecedorFilter={fornecedorFilter}
                setFornecedorFilter={setFornecedorFilter}
                poFilter={poFilter}
                setPoFilter={setPoFilter}
                tipoFilter={tipoFilter}
                setTipoFilter={setTipoFilter}
                statusOptions={statusOptions}
                clientes={clientes}
                fornecedores={fornecedores}
                poList={poList}
                tiposMaterial={tiposMaterial}
                hasActiveFilter={hasActiveFilter}
              />

              <div className="flex-1 min-w-0 space-y-6">
                <div className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-sm">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {fileName && (
                      <span className="flex items-center gap-1">
                        <FileSpreadsheet className="h-3 w-3" />
                        {fileName}
                      </span>
                    )}
                    {lastUpdated && (
                      <span className="flex items-center gap-1 text-xs">
                        <Clock className="h-3 w-3" />
                        Atualizado: {new Date(lastUpdated).toLocaleDateString("pt-BR")} às {new Date(lastUpdated).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    {isRefreshing && !isUpdating && (
                      <span className="flex items-center gap-1 text-xs">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        Sincronizando em background...
                      </span>
                    )}
                    {updateMessage && (
                      <span className="flex items-center gap-1 text-xs">
                        <Loader2 className={`h-3 w-3 ${isUpdating ? "animate-spin text-primary" : "text-primary"}`} />
                        {updateMessage}{isUpdating ? ` ${updateProgress}%` : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        let ok = false;
                        if (activeCategory === "Válvulas") {
                          ok = downloadValvulasDashboard(filteredData as any, activeCategory);
                        } else if (activeCategory === "Tubos") {
                          ok = downloadTubosDashboard(filteredData as any, activeCategory);
                        } else if (activeCategory === "Embarques") {
                          ok = downloadEmbarquesDashboard(filteredData as any, activeCategory);
                        } else {
                          ok = downloadDashboard(filteredData as any, activeCategory);
                        }
                        if (!ok) toast.info("Nenhum dado para exportar.");
                      }}
                      disabled={isUpdating}
                      className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Baixar Excel
                    </button>
                    <button
                      onClick={() => { if (!downloadPedidosXLSX(filteredData as any, activeCategory)) toast.info("Nenhum dado para exportar."); }}
                      disabled={isUpdating || filteredData.length === 0}
                      className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      Exportar Excel
                    </button>
                    <button
                      onClick={() => { if (!downloadPedidosPDF(filteredData as any, activeCategory)) toast.info("Nenhum dado para exportar."); }}
                      disabled={isUpdating || filteredData.length === 0}
                      className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      Exportar PDF
                    </button>
                    <label className={`flex items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 ${isUpdating ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
                      <Upload className="h-3.5 w-3.5" />
                      {isUpdating ? "Atualizando..." : `Atualizar Planilha ${activeCategory}`}
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={isUpdating}
                      />
                    </label>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{filteredData.length}</p>
                      <p className="text-xs text-muted-foreground">registros</p>
                    </div>
                  </div>
                </div>

                <DashboardCards data={filteredData as any} categoria={activeCategory} />

                <div ref={delayRef}>
                  <DelayAlertTable
                    data={filteredData as any}
                    onPoClick={handlePoClick}
                    activePo={poFilter}
                    categoria={activeCategory}
                    isRefreshing={isUpdating}
                    statusMessage={updateMessage}
                  />
                </div>
                
                <DashboardChartsSection data={filteredData as any} onStatusClick={handleStatusClick} activeStatus={statusFilter} />
                
                <SupplierStatusTable
                  data={filteredData as any}
                  onPoClick={handlePoClick}
                  activePo={poFilter}
                  categoria={activeCategory}
                  isRefreshing={isUpdating}
                  statusMessage={updateMessage}
                />
                <DashboardInsightsSection data={filteredData as any} activePo={poFilter} onPoSelect={(po) => setPoFilter(po)} />
              </div>
            </div>
          </div>
        ) : (
          <MonthlyAnalysis data={filteredData as any} />
        )}
      </main>
    </div>
  );
};



export default Index;
