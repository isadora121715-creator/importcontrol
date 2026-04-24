import { Package, CheckCircle2, AlertTriangle, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useMemo } from "react";

interface OrderData {
  statusCompraVenda: string | null;
  statusFornecedor: string | null;
  po: string | null;
  [key: string]: unknown;
}

export function ValvulasDashboardCards({ data }: { data: OrderData[] }) {
  const metrics = useMemo(() => {
    let totalValves = 0;
    let onTimeCount = 0;
    let lateCount = 0;
    let maintenanceOrAlertCount = 0;

    data.forEach((d) => {
      // Contabilizando por PO vs item individual. O usuário solicitou "Total de válvulas". 
      // Em uma tabela de itens, podemos contar linhas ou qty. Assumiremos linhas = registros de válvulas
      totalValves++;

      const status = (d.statusCompraVenda || "").toUpperCase();
      const statusForn = (d.statusFornecedor || "").toUpperCase();

      if (status.includes("NO PRAZO") || status.includes("CHEGOU") || status.includes("ESTOQUE")) {
        onTimeCount++;
      } else if (status.includes("ATRASADO") || status.includes("CRÍTICO") || statusForn.includes("ATRASADO")) {
        lateCount++;
      }

      if (status.includes("MANUTENÇÃO") || status.includes("ALERTA") || status.includes("VERIFICAR")) {
        maintenanceOrAlertCount++;
      }
    });

    return {
      totalValves,
      onTimeCount,
      lateCount,
      maintenanceOrAlertCount
    };
  }, [data]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none">{metrics.totalValves}</p>
            <p className="mt-1 text-xs text-muted-foreground truncate">Total de Válvulas</p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none">{metrics.onTimeCount}</p>
            <p className="mt-1 text-xs text-muted-foreground truncate">Válvulas no Prazo</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none">{metrics.lateCount}</p>
            <p className="mt-1 text-xs text-muted-foreground truncate">Válvulas Atrasadas</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
            <Wrench className="h-5 w-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none">{metrics.maintenanceOrAlertCount}</p>
            <p className="mt-1 text-xs text-muted-foreground truncate">Manutenção/Alerta</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
