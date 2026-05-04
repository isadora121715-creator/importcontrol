import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles, Loader2, Ship, Plane, Package, Clock,
  TrendingDown, AlertTriangle, Lightbulb, CheckCircle2,
  XCircle, ArrowRight, RefreshCcw, Weight, Ruler,
} from "lucide-react";
import { analyzeFreight } from "@/server/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface FreightResult {
  recomendacao: "FCL" | "LCL" | "Aéreo";
  modal_adequado: boolean;
  volume_cbm: number;
  peso_taxavel: number;
  justificativa: string;
  tempo_transito: string;
  custo_relativo: "Baixo" | "Médio" | "Alto";
  alternativa_modal: string | null;
  alternativa_motivo: string | null;
  alerta: string | null;
  dica: string | null;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const MODAL_ICONS: Record<string, React.ElementType> = {
  FCL: Ship,
  LCL: Ship,
  "Aéreo": Plane,
};

const MODAL_COLORS: Record<string, string> = {
  FCL: "text-blue-500",
  LCL: "text-cyan-500",
  "Aéreo": "text-amber-500",
};

const CUSTO_COLOR: Record<string, string> = {
  Baixo: "text-emerald-500",
  Médio: "text-amber-500",
  Alto: "text-red-500",
};

const CUSTO_BG: Record<string, string> = {
  Baixo: "bg-emerald-500/10 border-emerald-500/30",
  Médio: "bg-amber-500/10 border-amber-500/30",
  Alto: "bg-red-500/10 border-red-500/30",
};

// ─────────────────────────────────────────────────────────────────
// Result display
// ─────────────────────────────────────────────────────────────────

function ResultCards({ result }: { result: FreightResult }) {
  const ModalIcon = MODAL_ICONS[result.recomendacao] ?? Package;
  const altIcon = result.alternativa_modal ? (MODAL_ICONS[result.alternativa_modal] ?? Package) : null;
  const AltIcon = altIcon;

  return (
    <div className="space-y-3 mt-4">
      {/* Main recommendation */}
      <div className={cn(
        "rounded-xl border p-4",
        result.modal_adequado
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-amber-500/30 bg-amber-500/5",
      )}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              result.modal_adequado ? "bg-emerald-500/10" : "bg-amber-500/10",
            )}>
              <ModalIcon className={cn("h-5 w-5", MODAL_COLORS[result.recomendacao] ?? "text-primary")} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold">Modal recomendado: {result.recomendacao}</p>
                {result.modal_adequado ? (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[10px] gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Adequado ao solicitado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-[10px] gap-1">
                    <XCircle className="h-2.5 w-2.5" /> Modal diferente do solicitado
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{result.justificativa}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border border-border/60 bg-card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Trânsito</span>
          </div>
          <p className="text-sm font-bold leading-tight">{result.tempo_transito || "—"}</p>
        </div>
        <div className={cn("rounded-lg border p-3", CUSTO_BG[result.custo_relativo] ?? "border-border/60 bg-card")}>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className={cn("h-3.5 w-3.5", CUSTO_COLOR[result.custo_relativo] ?? "text-primary")} />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Custo</span>
          </div>
          <p className={cn("text-sm font-bold leading-tight", CUSTO_COLOR[result.custo_relativo] ?? "text-foreground")}>
            {result.custo_relativo || "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Ruler className="h-3.5 w-3.5 text-violet-500" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Volume</span>
          </div>
          <p className="text-sm font-bold leading-tight">{result.volume_cbm ? `${Number(result.volume_cbm).toFixed(3)} m³` : "—"}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Weight className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Peso taxável</span>
          </div>
          <p className="text-sm font-bold leading-tight">{result.peso_taxavel ? `${result.peso_taxavel} kg` : "—"}</p>
        </div>
      </div>

      {/* Alternative modal */}
      {result.alternativa_modal && AltIcon && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 flex items-start gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
            <ArrowRight className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <AltIcon className={cn("h-3.5 w-3.5", MODAL_COLORS[result.alternativa_modal] ?? "text-muted-foreground")} />
              Alternativa: {result.alternativa_modal}
            </p>
            {result.alternativa_motivo && (
              <p className="text-xs text-muted-foreground mt-0.5">{result.alternativa_motivo}</p>
            )}
          </div>
        </div>
      )}

      {/* Alert */}
      {result.alerta && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs">{result.alerta}</p>
        </div>
      )}

      {/* Tip */}
      {result.dica && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 flex items-start gap-2">
          <Lightbulb className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs">{result.dica}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────

export function FreightAnalyzer() {
  const analyze = useServerFn(analyzeFreight);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FreightResult | null>(null);
  const [rawFallback, setRawFallback] = useState<string>("");
  const [form, setForm] = useState({
    peso: "",
    largura: "",
    altura: "",
    comprimento: "",
    modal: "LCL",
    origem: "",
    destino: "",
    incoterm: "",
  });

  const volumeCbm = form.largura && form.altura && form.comprimento
    ? ((Number(form.largura) * Number(form.altura) * Number(form.comprimento)) / 1_000_000).toFixed(4)
    : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setRawFallback("");
    try {
      const res = await analyze({
        data: {
          peso: Number(form.peso),
          largura: Number(form.largura),
          altura: Number(form.altura),
          comprimento: Number(form.comprimento),
          modal: form.modal,
          origem: form.origem || undefined,
          destino: form.destino || undefined,
          incoterm: form.incoterm || undefined,
        },
      });
      if (res.ok) {
        setResult(res.data as FreightResult);
      } else {
        setRawFallback((res as { ok: false; raw: string }).raw);
      }
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha ao analisar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setRawFallback("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Analisar Frete com IA
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Análise de Frete com IA
          </DialogTitle>
          <DialogDescription>
            Informe os dados da carga para receber a recomendação de modal mais adequado.
          </DialogDescription>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={submit} className="space-y-4">
          {/* Dimensões + peso */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Dados da Carga
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Peso (kg)</Label>
                <Input type="number" step="0.01" required placeholder="0.00"
                  value={form.peso} onChange={(e) => setForm({ ...form, peso: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Largura (cm)</Label>
                <Input type="number" step="0.01" required placeholder="0"
                  value={form.largura} onChange={(e) => setForm({ ...form, largura: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Altura (cm)</Label>
                <Input type="number" step="0.01" required placeholder="0"
                  value={form.altura} onChange={(e) => setForm({ ...form, altura: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Comprimento (cm)</Label>
                <Input type="number" step="0.01" required placeholder="0"
                  value={form.comprimento} onChange={(e) => setForm({ ...form, comprimento: e.target.value })} />
              </div>
            </div>
            {volumeCbm && (
              <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <Ruler className="h-3 w-3" />
                Volume calculado: <span className="font-semibold text-foreground">{volumeCbm} m³</span>
              </p>
            )}
          </div>

          {/* Modal + Incoterm */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Modal</Label>
              <Select value={form.modal} onValueChange={(v) => setForm({ ...form, modal: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FCL">FCL — Full Container</SelectItem>
                  <SelectItem value="LCL">LCL — Carga Consolidada</SelectItem>
                  <SelectItem value="Aéreo">Aéreo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Incoterm <span className="opacity-50">(opcional)</span></Label>
              <Select value={form.incoterm} onValueChange={(v) => setForm({ ...form, incoterm: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {["FOB", "CIF", "EXW", "DDP", "DAP", "CFR", "CPT"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Origem / Destino */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">País de Origem <span className="opacity-50">(opcional)</span></Label>
              <Input placeholder="Ex: China" value={form.origem}
                onChange={(e) => setForm({ ...form, origem: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">País de Destino <span className="opacity-50">(opcional)</span></Label>
              <Input placeholder="Ex: Brasil" value={form.destino}
                onChange={(e) => setForm({ ...form, destino: e.target.value })} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1 gap-2">
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Gerar análise</>
              )}
            </Button>
            {(result || rawFallback) && (
              <Button type="button" variant="outline" size="icon" onClick={reset} title="Nova análise">
                <RefreshCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>

        {/* Structured result */}
        {result && <ResultCards result={result} />}

        {/* Fallback raw text */}
        {rawFallback && (
          <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-4 max-h-64 overflow-auto">
            <pre className="whitespace-pre-wrap text-xs font-sans leading-relaxed">
              {rawFallback}
            </pre>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
