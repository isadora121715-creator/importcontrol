import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle, ClipboardList, Plus, Trash2, Truck, Clock, Phone, RefreshCw, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "./StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OrderData {
  pi: number | null;
  cliente: string | null;
  codigo: string | null;
  descricao: string | null;
  precoVenda: number | null;
  precoCompra: number | null;
  qtyVenda: number | null;
  qtyCompra: number | null;
  fornecedor: string | null;
  statusCompraVenda: string | null;
  statusFornecedor: string | null;
  diasFaltam: number | null;
  diasAtraso: number | null;
  po: string | null;
  chegadaHci: string | null;
  prazoCliente: string | null;
  [key: string]: unknown;
}

interface ActionPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderData | null;
  categoria?: string;
}

interface ActionSuggestion {
  icon: React.ReactNode;
  text: string;
  priority: "alta" | "média" | "baixa";
}

function getAutoActions(order: OrderData): ActionSuggestion[] {
  const actions: ActionSuggestion[] = [];
  const status = order.statusCompraVenda;
  const statusForn = order.statusFornecedor;
  const diasFaltam = order.diasFaltam;
  const diasAtraso = order.diasAtraso;

  if (status === "Crítico") {
    actions.push({ icon: <AlertTriangle className="h-4 w-4 text-status-critico" />, text: "🚨 Entrar em contato URGENTE com o fornecedor para atualização de prazo", priority: "alta" });
    actions.push({ icon: <Truck className="h-4 w-4 text-status-critico" />, text: "Avaliar viabilidade de frete aéreo para este item", priority: "alta" });
    actions.push({ icon: <Phone className="h-4 w-4 text-status-critico" />, text: "Comunicar o cliente sobre possível atraso e negociar novo prazo", priority: "alta" });
    if (diasAtraso != null && diasAtraso > 15) {
      actions.push({ icon: <RefreshCw className="h-4 w-4 text-destructive" />, text: "Considerar trocar fornecedor — atraso superior a 15 dias", priority: "alta" });
    }
  }

  if (status === "Atrasado") {
    actions.push({ icon: <Phone className="h-4 w-4 text-status-atrasado" />, text: "Cobrar fornecedor para atualização de prazo de entrega", priority: "alta" });
    if (diasFaltam != null && diasFaltam < 5) {
      actions.push({ icon: <Truck className="h-4 w-4 text-status-atrasado" />, text: "Prazo muito curto — considerar acelerar frete", priority: "alta" });
    }
    if (diasFaltam != null && diasFaltam >= 5) {
      actions.push({ icon: <Clock className="h-4 w-4 text-status-atrasado" />, text: "Acompanhar diariamente o status com o fornecedor", priority: "média" });
    }
    actions.push({ icon: <ClipboardList className="h-4 w-4 text-status-atrasado" />, text: "Verificar se há estoque alternativo disponível", priority: "média" });
  }

  if (status === "Verificar aéreo") {
    actions.push({ icon: <Truck className="h-4 w-4 text-status-verificar" />, text: "Fazer cotação de frete aéreo e comparar com impacto do atraso", priority: "alta" });
    actions.push({ icon: <ClipboardList className="h-4 w-4 text-status-verificar" />, text: "Calcular custo do aéreo vs multa/perda por atraso ao cliente", priority: "média" });
  }

  if (statusForn === "Atrasado" && status !== "Chegou" && status !== "Estoque") {
    actions.push({ icon: <Phone className="h-4 w-4 text-status-atrasado" />, text: `Cobrar fornecedor ${order.fornecedor || ""} — status fornecedor atrasado`, priority: "alta" });
    actions.push({ icon: <RefreshCw className="h-4 w-4 text-muted-foreground" />, text: "Buscar fornecedor alternativo caso não haja resposta em 48h", priority: "média" });
  }

  // Entrega Fornecedor step
  const entregaForn = (order as any).entregaFornecedor || (order as any).prazoInicialFornecedor;
  if (entregaForn) {
    actions.push({ icon: <PackageCheck className="h-4 w-4 text-primary" />, text: `Entrega Forn. prevista: ${entregaForn} — Confirmar se a entrega foi realizada ou solicitar atualização`, priority: "média" });
  } else {
    actions.push({ icon: <PackageCheck className="h-4 w-4 text-muted-foreground" />, text: "Entrega Forn. — Solicitar ao fornecedor a data de entrega prevista", priority: "média" });
  }

  actions.push({ icon: <ClipboardList className="h-4 w-4 text-muted-foreground" />, text: "Documentar follow-up e manter registro atualizado", priority: "baixa" });

  return actions;
}

const priorityStyles = {
  alta: "border-l-status-critico bg-status-critico/5",
  média: "border-l-status-atrasado bg-status-atrasado/5",
  baixa: "border-l-muted bg-muted/30",
};

const priorityLabels = {
  alta: "Alta",
  média: "Média",
  baixa: "Baixa",
};

export function ActionPlanModal({ open, onOpenChange, order, categoria = "Conexões" }: ActionPlanModalProps) {
  const [manualActions, setManualActions] = useState<{ id: string; text: string }[]>([]);
  const [newAction, setNewAction] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchSavedActions = useCallback(async () => {
    if (!order) return;
    const query = supabase
      .from("action_plans")
      .select("id, action_text")
      .eq("categoria", categoria);

    if (order.pi != null) {
      query.eq("pi", order.pi);
    }
    if (order.po) {
      query.eq("po", order.po);
    }

    const { data } = await query.order("created_at", { ascending: true });
    if (data) {
      setManualActions(data.map((d: { id: string; action_text: string }) => ({ id: d.id, text: d.action_text })));
    }
  }, [order, categoria]);

  useEffect(() => {
    if (open && order) {
      fetchSavedActions();
    }
  }, [open, order, fetchSavedActions]);

  if (!order) return null;

  const autoActions = getAutoActions(order);

  const addManualAction = async () => {
    if (!newAction.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("action_plans").insert({
      pi: order.pi,
      po: order.po,
      categoria,
      action_text: newAction.trim(),
    }).select("id, action_text").single();

    if (error) {
      toast.error("Erro ao salvar ação.");
    } else if (data) {
      setManualActions((prev) => [...prev, { id: data.id, text: data.action_text }]);
      toast.success("Ação salva!");
    }
    setNewAction("");
    setSaving(false);
  };

  const removeManualAction = async (id: string) => {
    await supabase.from("action_plans").delete().eq("id", id);
    setManualActions((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setNewAction(""); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5 text-primary" />
            Plano de Ação — PI {order.pi || "—"}
          </DialogTitle>
        </DialogHeader>

        {/* Order summary */}
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-xs">
          <div><span className="text-muted-foreground">PO:</span> <span className="font-mono font-semibold">{order.po || "—"}</span></div>
          <div><span className="text-muted-foreground">Fornecedor:</span> <span className="font-semibold">{order.fornecedor || "—"}</span></div>
          <div><span className="text-muted-foreground">Cliente:</span> <span className="font-semibold">{order.cliente || "—"}</span></div>
          <div><span className="text-muted-foreground">Código:</span> <span className="font-mono">{order.codigo || "—"}</span></div>
          <div><span className="text-muted-foreground">ETD:</span> <span className="font-mono">{(order as any).etd || "—"}</span></div>
          <div><span className="text-muted-foreground">ETA:</span> <span className="font-mono">{(order as any).eta || "—"}</span></div>
          <div><span className="text-muted-foreground">Prazo Cliente:</span> <span className="font-mono">{order.prazoCliente || "—"}</span></div>
          <div><span className="text-muted-foreground">Chegada HCI:</span> <span className="font-mono">{order.chegadaHci || "—"}</span></div>
          <div><span className="text-muted-foreground">Data Compra:</span> <span className="font-mono">{(order as any).dataCompra || "—"}</span></div>
          <div><span className="text-muted-foreground">Entrega Forn.:</span> <span className="font-mono">{(order as any).entregaFornecedor || "—"}</span></div>
          <div className="flex items-center gap-2"><span className="text-muted-foreground">Status C/V:</span><StatusBadge status={order.statusCompraVenda} /></div>
          <div className="flex items-center gap-2"><span className="text-muted-foreground">Status Forn.:</span><StatusBadge status={order.statusFornecedor} /></div>
          {(() => {
            const entregaForn = (order as any).entregaFornecedor;
            const prazoInicialForn = (order as any).prazoInicialFornecedor;
            if (entregaForn && prazoInicialForn) {
              const d1 = new Date(entregaForn.split("/").reverse().join("-"));
              const d2 = new Date(prazoInicialForn.split("/").reverse().join("-"));
              if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
                const diff = Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div><span className="text-muted-foreground">Dias Atraso Forn.:</span> <span className={`font-mono font-semibold ${diff > 0 ? "text-destructive" : "text-emerald-600"}`}>{diff > 0 ? `+${diff}` : diff}</span></div>
                );
              }
            }
            return null;
          })()}
          {(() => {
            const emissao = (order as any).emissaoPedidoSistema;
            const recebimento = (order as any).dataRecebimentoCompra;
            if (emissao && recebimento) {
              const d1 = new Date(recebimento.split("/").reverse().join("-"));
              const d2 = new Date(emissao.split("/").reverse().join("-"));
              if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
                const diff = Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div><span className="text-muted-foreground">Dias Atraso PI x Receb.:</span> <span className={`font-mono font-semibold ${diff > 0 ? "text-destructive" : "text-emerald-600"}`}>{diff > 0 ? `+${diff}` : diff}</span></div>
                );
              }
            }
            return null;
          })()}
        </div>

        {/* Auto-generated actions */}
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <CheckCircle className="h-4 w-4 text-primary" />
            Ações Sugeridas
          </h4>
          <div className="space-y-2">
            {autoActions.map((action, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-lg border-l-4 p-3 ${priorityStyles[action.priority]}`}>
                {action.icon}
                <div className="flex-1"><p className="text-xs">{action.text}</p></div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  action.priority === "alta" ? "bg-status-critico/20 text-status-critico" :
                  action.priority === "média" ? "bg-status-atrasado/20 text-status-atrasado" :
                  "bg-muted text-muted-foreground"
                }`}>{priorityLabels[action.priority]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Manual actions (persisted) */}
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Plus className="h-4 w-4 text-primary" />
            Suas Ações (salvas)
          </h4>

          {manualActions.length > 0 && (
            <div className="mb-3 space-y-2">
              {manualActions.map((action) => (
                <div key={action.id} className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
                  <ClipboardList className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs flex-1">{action.text}</span>
                  <button onClick={() => removeManualAction(action.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Textarea
              placeholder="Escreva uma ação personalizada..."
              value={newAction}
              onChange={(e) => setNewAction(e.target.value)}
              className="min-h-[60px] text-xs"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addManualAction(); } }}
            />
            <Button size="sm" onClick={addManualAction} disabled={!newAction.trim() || saving} className="shrink-0 self-end">
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
