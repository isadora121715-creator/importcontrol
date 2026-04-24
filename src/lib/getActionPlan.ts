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

interface ActionText {
  text: string;
  priority: "alta" | "média" | "baixa";
}

export function getActionTexts(order: OrderData): ActionText[] {
  const actions: ActionText[] = [];
  const status = order.statusCompraVenda;
  const statusForn = order.statusFornecedor;
  const diasFaltam = order.diasFaltam;
  const diasAtraso = order.diasAtraso;

  if (status === "Crítico") {
    actions.push({ text: "Entrar em contato URGENTE com o fornecedor para atualização de prazo", priority: "alta" });
    actions.push({ text: "Avaliar viabilidade de frete aéreo para este item", priority: "alta" });
    actions.push({ text: "Comunicar o cliente sobre possível atraso e negociar novo prazo", priority: "alta" });
    if (diasAtraso != null && diasAtraso > 15) {
      actions.push({ text: "Considerar trocar fornecedor — atraso superior a 15 dias", priority: "alta" });
    }
  }

  if (status === "Atrasado") {
    actions.push({ text: "Cobrar fornecedor para atualização de prazo de entrega", priority: "alta" });
    if (diasFaltam != null && diasFaltam < 5) {
      actions.push({ text: "Prazo muito curto — considerar acelerar frete", priority: "alta" });
    }
    if (diasFaltam != null && diasFaltam >= 5) {
      actions.push({ text: "Acompanhar diariamente o status com o fornecedor", priority: "média" });
    }
    actions.push({ text: "Verificar se há estoque alternativo disponível", priority: "média" });
  }

  if (status === "Verificar aéreo") {
    actions.push({ text: "Fazer cotação de frete aéreo e comparar com impacto do atraso", priority: "alta" });
    actions.push({ text: "Calcular custo do aéreo vs multa/perda por atraso ao cliente", priority: "média" });
  }

  if (statusForn === "Atrasado" && status !== "Chegou" && status !== "Estoque") {
    actions.push({ text: `Cobrar fornecedor ${order.fornecedor || ""} — status fornecedor atrasado`, priority: "alta" });
    actions.push({ text: "Buscar fornecedor alternativo caso não haja resposta em 48h", priority: "média" });
  }

  // Entrega Fornecedor step
  const entregaForn = (order as any).entregaFornecedor || (order as any).prazoInicialFornecedor;
  if (entregaForn) {
    actions.push({ text: `Entrega Forn. prevista: ${entregaForn} — Confirmar entrega ou solicitar atualização`, priority: "média" });
  } else {
    actions.push({ text: "Entrega Forn. — Solicitar ao fornecedor a data de entrega prevista", priority: "média" });
  }

  actions.push({ text: "Documentar follow-up e manter registro atualizado", priority: "baixa" });

  return actions;
}

export type { OrderData, ActionText };
