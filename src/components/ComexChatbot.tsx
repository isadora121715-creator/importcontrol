import { useState, useRef, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  MessageCircle, X, Send, Loader2, Bot, Database,
  ChevronDown, Trash2, Sparkles,
} from "lucide-react";
import { chatComex } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

type Msg = {
  role: "user" | "assistant";
  content: string;
  hasContext?: boolean;        // message used dashboard data
};

// ─────────────────────────────────────────────────────────────────
// Dashboard data extraction helpers
// ─────────────────────────────────────────────────────────────────

/** Extract PO numbers — e.g. "PO 001.592", "PO001.592", "po1234" */
function extractPOs(text: string): string[] {
  const matches = text.matchAll(/\bPO[\s.:/-]*([\d./-]{3,})/gi);
  return [...new Set([...matches].map((m) => m[1].trim().replace(/\.$/, "")))].slice(0, 4);
}

/** Extract PI numbers — e.g. "PI 513573", "PI513573" */
function extractPIs(text: string): string[] {
  const matches = text.matchAll(/\bPI[\s.:/-]*(\d{4,})/gi);
  return [...new Set([...matches].map((m) => m[1].trim()))].slice(0, 4);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summariseRows(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "(nenhum registro encontrado)";

  // Group by PO
  const byPO = new Map<string, Record<string, unknown>[]>();
  rows.forEach((r) => {
    const key = (r.po as string) || "SEM-PO";
    if (!byPO.has(key)) byPO.set(key, []);
    byPO.get(key)!.push(r);
  });

  const lines: string[] = [];
  byPO.forEach((items, po) => {
    const first = items[0];
    const descricoes = [...new Set(items.map((r) => r.descricao).filter(Boolean))] as string[];
    const clientes  = [...new Set(items.map((r) => r.cliente).filter(Boolean))] as string[];

    lines.push([
      `PO: ${po}`,
      first.pi != null            ? `PI: ${first.pi}` : null,
      first.fornecedor            ? `Fornecedor: ${first.fornecedor}` : null,
      clientes.length             ? `Cliente(s): ${clientes.join(", ")}` : null,
      first.status_compra_venda   ? `Status: ${first.status_compra_venda}` : null,
      first.status_fornecedor     ? `Status Forn.: ${first.status_fornecedor}` : null,
      first.chegada_hci           ? `Chegada HCI: ${first.chegada_hci}` : null,
      first.eta                   ? `ETA: ${first.eta}` : null,
      first.etd                   ? `ETD: ${first.etd}` : null,
      first.prazo_cliente         ? `Prazo Cliente: ${first.prazo_cliente}` : null,
      first.entrega_fornecedor    ? `Entrega Forn.: ${first.entrega_fornecedor}` : null,
      first.embarque              ? `Modal: ${first.embarque}` : null,
      descricoes.length
        ? `Itens (${items.length}): ${descricoes.slice(0, 4).join(" | ")}${descricoes.length > 4 ? " ..." : ""}`
        : `Total de itens: ${items.length}`,
    ].filter(Boolean).join(" | "));
  });

  return lines.join("\n");
}

/** Query pedidos by PO (partial match) or PI (exact) and return formatted context */
async function fetchDashboardContext(pos: string[], pis: string[]): Promise<string> {
  if (!pos.length && !pis.length) return "";

  const SELECT = "po,pi,fornecedor,cliente,descricao,chegada_hci,eta,etd,prazo_cliente,status_compra_venda,status_fornecedor,entrega_fornecedor,embarque,categoria";
  const sections: string[] = [];

  // Fetch by PO (partial ilike)
  for (const po of pos) {
    const { data } = await supabase
      .from("pedidos")
      .select(SELECT)
      .ilike("po", `%${po}%`)
      .limit(20);
    if (data?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sections.push(`[ PO "${po}" — ${data.length} item(ns) encontrado(s) ]\n${summariseRows(data as any[])}`);
    } else {
      sections.push(`[ PO "${po}" — não encontrada no sistema ]`);
    }
  }

  // Fetch by PI (exact integer match)
  for (const pi of pis) {
    const piNum = parseInt(pi, 10);
    if (isNaN(piNum)) continue;
    const { data } = await supabase
      .from("pedidos")
      .select(SELECT)
      .eq("pi", piNum)
      .limit(20);
    if (data?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sections.push(`[ PI ${piNum} — ${data.length} item(ns) encontrado(s) ]\n${summariseRows(data as any[])}`);
    } else {
      sections.push(`[ PI ${piNum} — não encontrado no sistema ]`);
    }
  }

  return sections.length ? sections.join("\n\n") : "";
}

// ─────────────────────────────────────────────────────────────────
// Suggested questions
// ─────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Quando chega na HCI a PO 001.592?",
  "Qual o status da PO 001.592?",
  "Em qual PO está o PI 513573?",
  "O que é FOB e CIF?",
  "Qual a diferença entre LCL e FCL?",
];

// ─────────────────────────────────────────────────────────────────
// Message renderer — handles line breaks and bold
// ─────────────────────────────────────────────────────────────────

function MessageContent({ content }: { content: string }) {
  // Split by newlines and render paragraphs/lines
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        // Bold text between **...**
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="text-sm leading-snug">
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j}>{part.slice(2, -2)}</strong>
              ) : (
                <span key={j}>{part}</span>
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────

export function ComexChatbot() {
  const chat = useServerFn(chatComex);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Olá! Sou o assistente de Comex da HCI.\nPosso responder sobre fretes, INCOTERMS, custos logísticos e consultar dados das suas POs e PIs diretamente do sistema.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    const next: Msg[] = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setShowSuggestions(false);
    setLoading(true);

    try {
      // Detect PO/PI references and fetch context
      const pos = extractPOs(trimmed);
      const pis = extractPIs(trimmed);
      let context = "";

      if (pos.length || pis.length) {
        setFetchingData(true);
        try {
          context = await fetchDashboardContext(pos, pis);
        } catch {
          // If Supabase query fails, continue without context
        } finally {
          setFetchingData(false);
        }
      }

      const res = await chat({
        data: {
          messages: next.slice(-20).map(({ role, content }) => ({ role, content })),
          context: context || undefined,
        },
      });

      setMessages([
        ...next,
        { role: "assistant", content: res.reply, hasContext: !!context },
      ]);
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha no chat",
        variant: "destructive",
      });
      setLoading(false);
      setFetchingData(false);
    } finally {
      setLoading(false);
      setFetchingData(false);
    }
  }, [messages, loading, chat]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const clearChat = () => {
    setMessages([{
      role: "assistant",
      content: "Histórico limpo. Como posso ajudar?",
    }]);
    setShowSuggestions(true);
  };

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-glow flex items-center justify-center hover:scale-105 transition-transform"
          aria-label="Abrir assistente Comex"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex flex-col overflow-hidden",
            "w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-3rem)]",
            "rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-glow",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-primary/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Assistente Comex</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> IA com dados do sistema
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                title="Limpar histórico"
                className="h-7 w-7 rounded-md hover:bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                title="Fechar"
                className="h-7 w-7 rounded-md hover:bg-muted/50 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-3 space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center mr-1.5 mt-1 shrink-0">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm",
                  )}
                >
                  <MessageContent content={m.content} />
                  {m.hasContext && (
                    <div className="mt-1.5 flex items-center gap-1 opacity-60">
                      <Database className="h-2.5 w-2.5" />
                      <span className="text-[9px]">dados do sistema</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading state */}
            {loading && (
              <div className="flex justify-start">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center mr-1.5 mt-1 shrink-0">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <div className="bg-muted text-foreground max-w-[85%] rounded-2xl rounded-tl-sm px-3 py-2 text-sm flex items-center gap-2">
                  {fetchingData ? (
                    <>
                      <Database className="h-3 w-3 animate-pulse text-primary" />
                      <span className="text-xs">consultando dados...</span>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs">pensando...</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {showSuggestions && messages.length === 1 && (
              <div className="space-y-1.5 mt-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide px-1">Sugestões</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left text-xs px-3 py-2 rounded-xl border border-border/40 bg-card hover:bg-muted/60 hover:border-primary/30 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="px-3 pb-3 pt-2 border-t border-border/60 flex gap-2 shrink-0"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre PO, PI, fretes, INCOTERMS..."
              disabled={loading}
              className="h-9 text-sm"
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
