import { Package, Cylinder, Settings2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface GeneralKPIsProps {
  conexoesCount: number;
  tubosCount: number;
  valvulasCount: number;
}

export function GeneralKPIs({ conexoesCount, tubosCount, valvulasCount }: GeneralKPIsProps) {
  const items = [
    { label: "Total de Conexões", count: conexoesCount, icon: Package, color: "text-primary", bg: "bg-primary/10" },
    { label: "Total de Tubos", count: tubosCount, icon: Cylinder, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "Total de Válvulas", count: valvulasCount, icon: Settings2, color: "text-amber-600", bg: "bg-amber-500/10" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.bg}`}>
                <Icon className={`h-6 w-6 ${item.color}`} />
              </div>
              <div>
                <p className="text-3xl font-bold leading-none">{item.count}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
