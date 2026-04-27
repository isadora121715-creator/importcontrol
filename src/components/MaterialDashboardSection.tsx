import { useDeferredValue, useMemo } from "react";
import { Upload, FileSpreadsheet, Loader2, Clock, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePedidos } from "@/hooks/usePedidos";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardCards } from "@/components/DashboardCards";
import { downloadDashboard } from "@/lib/downloadDashboard";
import { toast } from "sonner";
import { DashboardLoadingSkeleton } from "@/components/dashboard/DashboardStates";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["#1E5EFF", "#4DA3FF", "#0A2540", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

interface MaterialDashboardSectionProps {
  categoria: "Tubos" | "Válvulas";
  title: string;
  onCountUpdate?: (count: number) => void;
}

export function MaterialDashboardSection({ categoria, title }: MaterialDashboardSectionProps) {
  const { user } = useAuth();
  const {
    data,
    loading,
    fileName,
    handleFileUpload,
    lastUpdated,
    isUpdating,
    updateProgress,
    updateMessage,
  } = usePedidos(categoria);

  const deferredData = useDeferredValue(data);

  // Detect columns dynamically from data
  const detectedColumns = useMemo(() => {
    if (deferredData.length === 0) return [];
    const cols: { key: string; label: string }[] = [];
    const sample = deferredData[0];
    
    const columnOrder: { key: string; label: string }[] = [
      { key: "pi", label: "Pedido" },
      { key: "item", label: "Item" },
      { key: "cliente", label: "Cliente" },
      { key: "codigo", label: "Código" },
      { key: "descricao", label: "Descrição" },
      { key: "fornecedor", label: "Fornecedor" },
      { key: "po", label: "PO" },
      { key: "qtyVenda", label: "Qtd Venda" },
      { key: "qtyCompra", label: "Qtd Compra" },
      { key: "statusCompraVenda", label: "Status" },
      { key: "prazoCliente", label: "Prazo Cliente" },
      { key: "diasAtraso", label: "Dias Atraso" },
    ];

    for (const col of columnOrder) {
      const hasData = deferredData.some((r) => {
        const v = r[col.key];
        return v !== null && v !== undefined && v !== "";
      });
      if (hasData) cols.push(col);
    }
    return cols;
  }, [deferredData]);

  // KPIs
  const kpis = useMemo(() => {
    const uniquePedidos = new Set<string>();
    let totalQty = 0;
    const statusCounts: Record<string, number> = {};
    
    deferredData.forEach((row) => {
      if (row.pi) uniquePedidos.add(String(row.pi));
      const qty = (row.qtyCompra ?? row.qtyVenda ?? 0) as number;
      if (typeof qty === "number") totalQty += qty;
      const status = (row.statusCompraVenda as string) || "N/A";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return {
      totalPedidos: uniquePedidos.size,
      totalQty: Math.round(totalQty),
      totalLinhas: deferredData.length,
      statusCounts,
    };
  }, [deferredData]);

  // Chart 1: Distribution by fornecedor
  const fornecedorChart = useMemo(() => {
    const counts: Record<string, number> = {};
    deferredData.forEach((row) => {
      const f = (row.fornecedor as string) || "Sem fornecedor";
      counts[f] = (counts[f] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [deferredData]);

  // Chart 2: Distribution by status
  const statusChart = useMemo(() => {
    return Object.entries(kpis.statusCounts)
      .filter(([k]) => k !== "N/A")
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [kpis.statusCounts]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <DashboardLoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
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
                {new Date(lastUpdated).toLocaleDateString("pt-BR")} às {new Date(lastUpdated).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {updateMessage && (
              <span className="flex items-center gap-1 text-xs">
                <Loader2 className={`h-3 w-3 ${isUpdating ? "animate-spin text-primary" : ""}`} />
                {updateMessage}{isUpdating ? ` ${updateProgress}%` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const ok = downloadDashboard(deferredData as any, categoria);
              if (!ok) toast.info("Nenhum dado para exportar.");
            }}
            disabled={isUpdating || deferredData.length === 0}
            className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar Excel
          </button>
          {user && (
            <label className={`flex items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 ${isUpdating ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
              <Upload className="h-3.5 w-3.5" />
              {isUpdating ? "Atualizando..." : `Atualizar Planilha ${categoria}`}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUpdating}
              />
            </label>
          )}
          <div className="text-right">
            <p className="text-sm font-semibold">{deferredData.length}</p>
            <p className="text-xs text-muted-foreground">registros</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <DashboardCards data={deferredData as any} categoria={categoria} />

      {deferredData.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum dado de {categoria.toLowerCase()} carregado.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Faça o upload da planilha de {categoria.toLowerCase()} para visualizar os dados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Distribuição por Fornecedor</CardTitle>
              </CardHeader>
              <CardContent>
                {fornecedorChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={fornecedorChart}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} (${(percent != null ? (percent * 100).toFixed(0) : 0)}%)`}
                        labelLine={false}
                      >
                        {fornecedorChart.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sem dados de fornecedor</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Distribuição por Status</CardTitle>
              </CardHeader>
              <CardContent>
                {statusChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={statusChart} layout="vertical" margin={{ left: 10 }}>
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {statusChart.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sem dados de status</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Data Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Tabela de {categoria}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {detectedColumns.map((col) => (
                      <TableHead key={col.key} className="whitespace-nowrap text-xs">{col.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deferredData.slice(0, 100).map((row, idx) => (
                    <TableRow key={idx}>
                      {detectedColumns.map((col) => (
                        <TableCell key={col.key} className="whitespace-nowrap text-xs">
                          {row[col.key] != null ? String(row[col.key]) : "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {deferredData.length > 100 && (
                <p className="mt-2 text-xs text-muted-foreground text-center">
                  Mostrando 100 de {deferredData.length} registros
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
