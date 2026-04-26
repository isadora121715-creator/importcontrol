import { useMemo, useState } from "react";
import { DollarSign, Percent, Trash2, TrendingUp } from "lucide-react";
import { HeaderTabs } from "@/components/HeaderTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VENDA_STORAGE_KEY = "embarques.simulador_venda.v1";

interface VendaItem {
  id: string;
  descricao: string;
  precoCompraUSD: string;
  qtd: string;
  freteUSD: string;
  impostoPct: string;
  cambio: string;
  precoVendaBRL: string;
}

const FORM_EMPTY: Omit<VendaItem, "id"> = {
  descricao: "",
  precoCompraUSD: "",
  qtd: "1",
  freteUSD: "",
  impostoPct: "",
  cambio: "5.20",
  precoVendaBRL: "",
};

function calcVenda(item: VendaItem, margemPct: number) {
  const qtd       = Number(item.qtd)           || 1;
  const compra    = Number(item.precoCompraUSD) || 0;
  const frete     = Number(item.freteUSD)       || 0;
  const imposto   = Number(item.impostoPct)     || 0;
  const cambio    = Number(item.cambio)         || 5.20;
  const vendaUser = Number(item.precoVendaBRL)  || 0;

  const custoUnitUSD = compra + frete / qtd;
  const custoUnitBRL = custoUnitUSD * cambio * (1 + imposto / 100);
  const vendaMinBRL  = custoUnitBRL / (1 - margemPct / 100);
  const margemReal   = vendaUser > 0 ? ((vendaUser - custoUnitBRL) / vendaUser) * 100 : null;
  const abaixoMinimo = vendaUser > 0 && vendaUser < vendaMinBRL;

  return {
    qtd,
    custoUnitUSD,
    custoUnitBRL,
    custoTotalBRL: custoUnitBRL * qtd,
    vendaMinBRL,
    vendaTotalMinBRL: vendaMinBRL * qtd,
    margemReal,
    abaixoMinimo,
  };
}

export default function Precificacao() {
  const [vendaMargem, setVendaMargem] = useState("18");
  const [vendaItems, setVendaItems] = useState<VendaItem[]>(() => {
    try {
      const raw = window.localStorage.getItem(VENDA_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as VendaItem[]) : [];
    } catch {
      return [];
    }
  });
  const [vendaForm, setVendaForm] = useState<Omit<VendaItem, "id">>(FORM_EMPTY);

  const saveItems = (items: VendaItem[]) => {
    setVendaItems(items);
    window.localStorage.setItem(VENDA_STORAGE_KEY, JSON.stringify(items));
  };

  const addItem = () => {
    if (!vendaForm.descricao || !vendaForm.precoCompraUSD) return;
    saveItems([...vendaItems, { ...vendaForm, id: Date.now().toString() }]);
    setVendaForm(FORM_EMPTY);
  };

  const removeItem = (id: string) => saveItems(vendaItems.filter((i) => i.id !== id));

  // ── Calculadora de Margem ─────────────────────────────────────────────
  const [calcPrecoVenda,   setCalcPrecoVenda]   = useState("");
  const [calcPrecoCompra,  setCalcPrecoCompra]  = useState("");
  const [calcCambio,       setCalcCambio]       = useState("5.20");
  const [calcFrete,        setCalcFrete]        = useState("");
  const [calcImposto,      setCalcImposto]      = useState("");

  const calcMargem = useMemo(() => {
    const venda   = Number(calcPrecoVenda)  || 0;
    const compra  = Number(calcPrecoCompra) || 0;
    const cambio  = Number(calcCambio)      || 5.20;
    const frete   = Number(calcFrete)       || 0;
    const imposto = Number(calcImposto)     || 0;
    if (!venda || !compra) return null;

    const custoUSD = compra + frete;
    const custoBRL = custoUSD * cambio * (1 + imposto / 100);
    const lucro    = venda - custoBRL;
    const margemSV = (lucro / venda)  * 100;   // margem sobre venda
    const markup   = (lucro / custoBRL) * 100; // markup sobre custo
    const ok       = margemSV >= (Number(vendaMargem) || 18);
    return { custoBRL, lucro, margemSV, markup, ok };
  }, [calcPrecoVenda, calcPrecoCompra, calcCambio, calcFrete, calcImposto, vendaMargem]);

  const margem = Number(vendaMargem) || 18;
  const calcs  = vendaItems.map((item) => ({ item, c: calcVenda(item, margem) }));
  const totalCusto    = calcs.reduce((s, { c }) => s + c.custoTotalBRL, 0);
  const totalVendaMin = calcs.reduce((s, { c }) => s + c.vendaTotalMinBRL, 0);

  return (
    <div className="min-h-screen bg-background">
      <HeaderTabs />
      <main className="mx-auto max-w-[1400px] px-6 py-6 space-y-6">

        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Precificação</h1>
            <p className="text-sm text-muted-foreground">
              Simulador de preço de venda com margem mínima sobre materiais comprados
            </p>
          </div>
        </div>

        {/* ── Calculadora de Margem de Compra ────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Percent className="h-5 w-5" /> Calculadora de Margem de Compra
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Informe o preço de venda e os custos para calcular a margem obtida na compra
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Preço de Venda (R$/un)</label>
                <Input
                  type="number" min="0" placeholder="0,00"
                  value={calcPrecoVenda}
                  onChange={(e) => setCalcPrecoVenda(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Preço de Compra (USD/un)</label>
                <Input
                  type="number" min="0" placeholder="0.00"
                  value={calcPrecoCompra}
                  onChange={(e) => setCalcPrecoCompra(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Câmbio (R$/USD)</label>
                <Input
                  type="number" min="0" step="0.01" placeholder="5.20"
                  value={calcCambio}
                  onChange={(e) => setCalcCambio(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Frete (USD/un)</label>
                <Input
                  type="number" min="0" placeholder="0.00"
                  value={calcFrete}
                  onChange={(e) => setCalcFrete(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Impostos / Despesas (%)</label>
                <Input
                  type="number" min="0" placeholder="0"
                  value={calcImposto}
                  onChange={(e) => setCalcImposto(e.target.value)}
                />
              </div>
            </div>

            {calcMargem ? (
              <div className={cn(
                "grid grid-cols-2 md:grid-cols-4 gap-3 rounded-lg border p-4",
                calcMargem.ok ? "border-green-400 bg-green-50 dark:bg-green-950/20" : "border-red-400 bg-red-50 dark:bg-red-950/20"
              )}>
                <div>
                  <p className="text-xs text-muted-foreground">Custo total (R$/un)</p>
                  <p className="text-xl font-bold">
                    {calcMargem.custoBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lucro bruto (R$/un)</p>
                  <p className={cn("text-xl font-bold", calcMargem.lucro >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                    {calcMargem.lucro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Margem sobre venda</p>
                  <p className={cn("text-2xl font-bold", calcMargem.ok ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                    {calcMargem.margemSV.toFixed(2)}%
                    <span className="text-xs font-normal ml-1 text-muted-foreground">
                      (mín. {margem}%)
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Markup sobre custo</p>
                  <p className={cn("text-2xl font-bold", calcMargem.markup >= 0 ? "text-foreground" : "text-destructive")}>
                    {calcMargem.markup.toFixed(2)}%
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-3">
                Preencha o preço de venda e o preço de compra para calcular a margem
              </p>
            )}
          </CardContent>
        </Card>

        {/* KPI totais */}
        {vendaItems.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">Itens cadastrados</p>
                <p className="text-2xl font-bold">{vendaItems.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">Custo total (R$)</p>
                <p className="text-2xl font-bold">
                  {totalCusto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">Venda mínima total (R$)</p>
                <p className="text-2xl font-bold text-primary">
                  {totalVendaMin.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">Margem mínima definida</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{margem}%</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Configuração de margem */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5" /> Simulador de Preço de Venda
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Calcule o preço mínimo de venda com base no custo de compra e despesas
            </p>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Margem */}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm font-medium whitespace-nowrap">Margem mínima (%)</label>
              <Input
                type="number" min="1" max="99" className="w-28"
                value={vendaMargem}
                onChange={(e) => setVendaMargem(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">
                Margem calculada sobre o preço de venda — padrão 18%
              </span>
            </div>

            {/* Formulário */}
            <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Adicionar item
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Descrição / Código</label>
                  <Input
                    placeholder="Ex: Válvula DN50 PN16"
                    value={vendaForm.descricao}
                    onChange={(e) => setVendaForm((f) => ({ ...f, descricao: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addItem()}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Preço Compra (USD/un)</label>
                  <Input
                    type="number" min="0" placeholder="0.00"
                    value={vendaForm.precoCompraUSD}
                    onChange={(e) => setVendaForm((f) => ({ ...f, precoCompraUSD: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Quantidade</label>
                  <Input
                    type="number" min="1" placeholder="1"
                    value={vendaForm.qtd}
                    onChange={(e) => setVendaForm((f) => ({ ...f, qtd: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Frete Total (USD)</label>
                  <Input
                    type="number" min="0" placeholder="0.00"
                    value={vendaForm.freteUSD}
                    onChange={(e) => setVendaForm((f) => ({ ...f, freteUSD: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Impostos / Despesas (%)</label>
                  <Input
                    type="number" min="0" placeholder="0"
                    value={vendaForm.impostoPct}
                    onChange={(e) => setVendaForm((f) => ({ ...f, impostoPct: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Câmbio (R$/USD)</label>
                  <Input
                    type="number" min="0" step="0.01" placeholder="5.20"
                    value={vendaForm.cambio}
                    onChange={(e) => setVendaForm((f) => ({ ...f, cambio: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Preço Venda (R$/un){" "}
                    <span className="text-[10px]">opcional</span>
                  </label>
                  <Input
                    type="number" min="0" placeholder="deixe vazio para calcular"
                    value={vendaForm.precoVendaBRL}
                    onChange={(e) => setVendaForm((f) => ({ ...f, precoVendaBRL: e.target.value }))}
                  />
                </div>
              </div>
              <Button
                onClick={addItem}
                disabled={!vendaForm.descricao || !vendaForm.precoCompraUSD}
              >
                + Adicionar Item
              </Button>
            </div>

            {/* Tabela */}
            {calcs.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted border-b">
                      {[
                        "Descrição", "Qtd", "Custo Unit (USD)", "Frete/Un (USD)",
                        "Custo Unit (R$)", "Custo Total (R$)", "Venda Mín (R$/un)",
                        "Preço Venda (R$/un)", "Margem Real", "",
                      ].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap text-muted-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calcs.map(({ item, c }) => (
                      <tr
                        key={item.id}
                        className={cn(
                          "border-b last:border-0 hover:bg-muted/30 transition-colors",
                          c.abaixoMinimo && "bg-red-50 dark:bg-red-950/20",
                        )}
                      >
                        <td className="px-3 py-2 font-medium">{item.descricao}</td>
                        <td className="px-3 py-2 text-center">{c.qtd}</td>
                        <td className="px-3 py-2">$ {c.custoUnitUSD.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          $ {(Number(item.freteUSD) / c.qtd || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          {c.custoUnitBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                        <td className="px-3 py-2">
                          {c.custoTotalBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                        <td className="px-3 py-2 font-semibold text-primary">
                          {c.vendaMinBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                        <td className="px-3 py-2">
                          {item.precoVendaBRL ? (
                            <span
                              className={cn(
                                "font-semibold",
                                c.abaixoMinimo
                                  ? "text-destructive"
                                  : "text-green-600 dark:text-green-400",
                              )}
                            >
                              {Number(item.precoVendaBRL).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                              {c.abaixoMinimo && " ⚠"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {c.margemReal !== null ? (
                            <span
                              className={cn(
                                "font-bold",
                                c.margemReal >= margem
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-destructive",
                              )}
                            >
                              {c.margemReal.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Button size="sm" variant="ghost" onClick={() => removeItem(item.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 font-semibold text-xs border-t">
                      <td className="px-3 py-2" colSpan={5}>Total geral</td>
                      <td className="px-3 py-2">
                        {totalCusto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="px-3 py-2 text-primary">
                        {totalVendaMin.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Adicione itens para calcular o preço de venda mínimo
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
