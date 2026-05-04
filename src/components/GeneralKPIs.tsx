import { Package, Cylinder, Settings2 } from "lucide-react";

interface GeneralKPIsProps {
  conexoesCount: number;
  tubosCount: number;
  valvulasCount: number;
}

interface KpiCardProps {
  label: string;
  count: number;
  icon: React.ElementType;
  accent: string;
  iconColor: string;
  iconBg: string;
  borderColor: string;
  bgFrom: string;
}

function KpiCard({ label, count, icon: Icon, accent, iconColor, iconBg, borderColor, bgFrom }: KpiCardProps) {
  return (
    <div className={`relative overflow-hidden rounded-xl border ${borderColor} bg-gradient-to-br ${bgFrom} via-card to-card shadow-sm card-lift`}>
      <div className={`absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r ${accent}`} />
      <div className="flex items-center gap-4 p-5 pt-6">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        <div>
          <p className="text-3xl font-bold leading-none num">{count.toLocaleString()}</p>
          <p className="mt-1 text-sm text-muted-foreground font-medium">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function GeneralKPIs({ conexoesCount, tubosCount, valvulasCount }: GeneralKPIsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        label="Total de Conexões"
        count={conexoesCount}
        icon={Package}
        accent="from-blue-500 to-indigo-500"
        iconColor="text-blue-500"
        iconBg="bg-blue-500/10"
        borderColor="border-blue-500/20"
        bgFrom="from-blue-500/5"
      />
      <KpiCard
        label="Total de Tubos"
        count={tubosCount}
        icon={Cylinder}
        accent="from-cyan-500 to-sky-500"
        iconColor="text-cyan-500"
        iconBg="bg-cyan-500/10"
        borderColor="border-cyan-500/20"
        bgFrom="from-cyan-500/5"
      />
      <KpiCard
        label="Total de Válvulas"
        count={valvulasCount}
        icon={Settings2}
        accent="from-amber-400 to-orange-500"
        iconColor="text-amber-500"
        iconBg="bg-amber-500/10"
        borderColor="border-amber-500/20"
        bgFrom="from-amber-500/5"
      />
    </div>
  );
}
