import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2 } from "lucide-react";
import { analyzeFreight } from "@/server/ai.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

export function FreightAnalyzer() {
  const analyze = useServerFn(analyzeFreight);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [form, setForm] = useState({
    peso: "",
    largura: "",
    altura: "",
    comprimento: "",
    modal: "FCL",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult("");
    try {
      const res = await analyze({
        data: {
          peso: Number(form.peso),
          largura: Number(form.largura),
          altura: Number(form.altura),
          comprimento: Number(form.comprimento),
          modal: form.modal,
        },
      });
      setResult(res.result);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Analisar Frete com IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Análise Inteligente de Frete
          </DialogTitle>
          <DialogDescription>
            Informe peso, dimensões e modal para receber a melhor recomendação.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Peso (kg)</Label>
            <Input
              type="number"
              step="0.01"
              required
              value={form.peso}
              onChange={(e) => setForm({ ...form, peso: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Modal</Label>
            <Select
              value={form.modal}
              onValueChange={(v) => setForm({ ...form, modal: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FCL">FCL</SelectItem>
                <SelectItem value="LCL">LCL</SelectItem>
                <SelectItem value="Aéreo">Aéreo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Largura (cm)</Label>
            <Input
              type="number"
              step="0.01"
              required
              value={form.largura}
              onChange={(e) => setForm({ ...form, largura: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Altura (cm)</Label>
            <Input
              type="number"
              step="0.01"
              required
              value={form.altura}
              onChange={(e) => setForm({ ...form, altura: e.target.value })}
            />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Comprimento (cm)</Label>
            <Input
              type="number"
              step="0.01"
              required
              value={form.comprimento}
              onChange={(e) =>
                setForm({ ...form, comprimento: e.target.value })
              }
            />
          </div>
          <Button type="submit" disabled={loading} className="col-span-2 gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Gerar análise
              </>
            )}
          </Button>
        </form>

        {result && (
          <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-4 max-h-80 overflow-auto">
            <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
              {result}
            </pre>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
