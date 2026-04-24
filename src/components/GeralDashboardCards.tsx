import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, DollarSign, Plane, Ship } from "lucide-react";

interface OrderData {
  statusCompraVenda: string | null;
  statusFornecedor: string | null;
  precoVenda: number | null;
  precoCompra: number | null;
  qtyVenda: number | null;
  qtyCompra: number | null;
  embarque: string | null;
  po: string | null;
  [key: string]: unknown;
}

function formatBRL(v: number | null | undefined) {
  const num = v ?? 0;
  return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUSD(v: number | null | undefined) {
  const num = v ?? 0;
  return `$ ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function GeralDashboardCards({ data }: { data: OrderData[] }) {
  const metrics = useMemo(() => {
    let valorVenda = 0;
    let valorCompra = 0;
    let embarqueAereo = 0;
    let embarqueMaritimo = 0;

    const poAtrasadas = new Set<string>();
    const poNoPrazo = new Set<string>();

    data.forEach((d) => {
      // Valores
      if (d.precoVenda != null) {
        valorVenda += d.precoVenda * (d.qtyVenda ?? 1);
      }
      if (d.precoCompra != null) {
        valorCompra += d.precoCompra * (d.qtyCompra ?? d.qtyVenda ?? 1);
      }

      // Tipos de embarque
      const embarque = (d.embarque || "").toUpperCase();
      if (embarque.includes("AER") || embarque.includes("AÉREO")) {
        embarqueAereo++;
      } else if (embarque.includes("MAR") || embarque.includes("MARÍTIMO")) {
        embarqueMaritimo++;
      }

      // POs Atrasadas vs No Prazo
      const status = (d.statusCompraVenda || "").toUpperCase();
      const statusForn = (d.statusFornecedor || "").toUpperCase();
      
      const po = d.po;
      if (po) {
        if (status.includes("ATRASADO") || status.includes("CRÍTICO") || statusForn.includes("ATRASADO")) {
          poAtrasadas.add(po);
        } else if (status.includes("NO PRAZO") || status.includes("CHEGOU") || status.includes("ESTOQUE") || status.includes("DIA")) {
          poNoPrazo.add(po);
        }
      }
    });

    return {
      valorVenda,
      valorCompra,
      embarqueAereo,
      embarqueMaritimo,
      poAtrasadas: poAtrasadas.size,
      poNoPrazo: poNoPrazo.size
    };
  }, [data]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
      <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none">{metrics.poAtrasadas}</p>
            <p className="mt-1 text-xs text-muted-foreground truncate">POs Atrasadas</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none">{metrics.poNoPrazo}</p>
            <p className="mt-1 text-xs text-muted-foreground truncate">POs no Prazo</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight truncate" title={formatBRL(metrics.valorVenda)}>{formatBRL(metrics.valorVenda)}</p>
            <p className="mt-1 text-xs text-muted-foreground truncate">Total Venda</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
            <DollarSign className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight truncate" title={formatUSD(metrics.valorCompra)}>{formatUSD(metrics.valorCompra)}</p>
            <p className="mt-1 text-xs text-muted-foreground truncate">Total Compra</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
            <Plane className="h-5 w-5 text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none">{metrics.embarqueAereo}</p>
            <p className="mt-1 text-xs text-muted-foreground truncate">Aéreo (Itens)</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
            <Ship className="h-5 w-5 text-cyan-600" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none">{metrics.embarqueMaritimo}</p>
            <p className="mt-1 text-xs text-muted-foreground truncate">Marítimo (Itens)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
