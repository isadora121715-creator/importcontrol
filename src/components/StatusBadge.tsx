import { cn } from "@/lib/utils";

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  "No prazo": { bg: "bg-status-no-prazo/15", text: "text-status-no-prazo", label: "No Prazo" },
  "On time": { bg: "bg-status-on-time/15", text: "text-status-on-time", label: "On Time" },
  "Atrasado": { bg: "bg-status-atrasado/15", text: "text-status-atrasado", label: "Atrasado" },
  "Crítico": { bg: "bg-status-critico/15", text: "text-status-critico", label: "Crítico" },
  "Chegou": { bg: "bg-status-chegou/15", text: "text-status-chegou", label: "Chegou" },
  "Estoque": { bg: "bg-status-estoque/15", text: "text-status-estoque", label: "Estoque" },
  "Verificar aéreo": { bg: "bg-status-verificar/15", text: "text-status-verificar", label: "Verificar Aéreo" },
  "EM PRODUÇÃO": { bg: "bg-blue-500/15", text: "text-blue-600", label: "Em Produção" },
  "ENTREGUE EM DIA": { bg: "bg-status-on-time/15", text: "text-status-on-time", label: "Entregue em Dia" },
  "ENTREGUE ATRASADO": { bg: "bg-status-atrasado/15", text: "text-status-atrasado", label: "Entregue Atrasado" },
  "CANCELADO": { bg: "bg-status-critico/15", text: "text-status-critico", label: "Cancelado" },
  "Em viagem": { bg: "bg-blue-500/15", text: "text-blue-600", label: "Em Viagem" },
  "Em produção": { bg: "bg-amber-500/15", text: "text-amber-600", label: "Em Produção" },
  "Aguardando embarque": { bg: "bg-indigo-500/15", text: "text-indigo-600", label: "Aguard. Embarque" },
  "Em desembaraço": { bg: "bg-purple-500/15", text: "text-purple-600", label: "Desembaraço" },
  "Verificar": { bg: "bg-muted", text: "text-muted-foreground", label: "Verificar" },
};

export function StatusBadge({ status, className }: { status: string | null; className?: string }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  const config = statusConfig[status] || { bg: "bg-muted", text: "text-muted-foreground", label: status };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", config.bg, config.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.text, "bg-current")} />
      {config.label}
    </span>
  );
}
