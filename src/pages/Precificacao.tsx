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

  // ── Calculadora de Margem — Modo A: tenho o preço de VENDA ───────────
  const [modoA_venda,   setModoA_venda]   = useState(""); // R$/un
  const [modoA_cambio,  setModoA_cambio]  = useState("5.20");
  const [modoA_frete,   setModoA_frete]   = useState("");
  const [modoA_imposto, setModoA_imposto] = useState("");

  const resultA = useMemo(() => {
    const venda   = Number(modoA_venda)   || 0;
    const cambio  = Number(modoA_cambio)  || 5.20;
    const frete   = Number(modoA_frete)   || 0;
    const imposto = Number(modoA_imposto) || 0;
    const mg      = Number(vendaMargem)   || 18;
    if (!venda) return null;

    // Custo máximo em BRL para atingir a margem alvo
    const custoMaxBRL = venda * (1 - mg / 100);
    // Custo máximo em USD antes de impostos e frete
    const custoMaxUSD = custoMaxBRL / (cambio * (1 + imposto / 100));
    // Preço de compra máximo descontando frete
    const compraMaxUSD = custoMaxUSD - frete;
    const lucro = venda - custoMaxBRL;
    return { venda, custoMaxBRL, custoMaxUSD, compraMaxUSD, lucro, mg };
  }, [modoA_venda, modoA_cambio, modoA_frete, modoA_imposto, vendaMargem]);

  // ── Calculadora de Margem — Modo B: tenho o preço de COMPRA ──────────
  const [modoB_compra,  setModoB_compra]  = useState(""); // USD/un
  const [modoB_cambio,  setModoB_cambio]  = useState("5.20");
  const [modoB_frete,   setModoB_frete]   = useState("");
  const [modoB_imposto, setModoB_imposto] = useState("");

  const resultB = useMemo(() => {
    const compra  = Number(modoB_compra)  || 0;
    const cambio  = Number(modoB_cambio)  || 5.20;
    const frete   = Number(modoB_frete)   || 0;
    const imposto = Number(modoB_imposto) || 0;
    const mg      = Number(vendaMargem)   || 18;
    if (!compra) return null;

    const custoBRL    = (compra + frete) * cambio * (1 + imposto / 100);
    const vendaMinBRL = custoBRL / (1 - mg / 100);
    const lucro       = vendaMinBRL - custoBRL;
    return { compra, custoBRL, vendaMinBRL, lucro, mg };
  }, [modoB_compra, modoB_cambio, modoB_frete, modoB_imposto, vendaMargem]);

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

        {/* ── Calculadora de Margem ───────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* MODO A — Sei o preço de VENDA, quero saber o máximo de compra */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Percent className="h-4 w-4 text-blue-500" />
                Tenho o preço de venda
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Por quanto posso comprar para ter {margem}% de margem?
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Preço de Venda (R$/un)</label>
                  <Input type="number" min="0" placeholder="Ex: 10,00"
                    value={modoA_venda}
                    onChange={(e) => setModoA_venda(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Câmbio (R$/USD)</label>
                  <Input type="number" min="0" step="0.01" placeholder="5.20"
                    value={modoA_cambio}
                    onChange={(e) => setModoA_cambio(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Frete (USD/un)</label>
                  <Input type="number" min="0" placeholder="0.00"
                    value={modoA_frete}
                    onChange={(e) => setModoA_frete(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Impostos / Despesas (%)</label>
                  <Input type="number" min="0" placeholder="0"
                    value={modoA_imposto}
                    onChange={(e) => setModoA_imposto(e.target.value)}
                  />
                </div>
              </div>

              {resultA ? (
                <div className="rounded-lg border border-blue-400 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Custo máximo (R$/un)</span>
                    <span className="font-semibold">
                      {resultA.custoMaxBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Custo máximo (USD/un)</span>
                    <span className="font-semibold">
                      $ {resultA.custoMaxUSD.toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t pt-2 flex justify-between items-baseline">
                    <span className="text-xs font-semibold text-muted-foreground">Compra máxima (USD/un)</span>
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      $ {resultA.compraMaxUSD > 0 ? resultA.compraMaxUSD.toFixed(2) : "—"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center pt-1">
                    Lucro estimado:{" "}
                    {resultA.lucro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    {" "}· margem {resultA.mg}%
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Preencha o preço de venda para calcular
                </p>
              )}
            </CardContent>
          </Card>

          {/* MODO B — Sei o preço de COMPRA, quero saber o mínimo de venda */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Percent className="h-4 w-4 text-green-500" />
                Tenho o preço de compra
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Por quanto preciso vender para ter {margem}% de margem?
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Preço de Compra (USD/un)</label>
                  <Input type="number" min="0" placeholder="Ex: 10.00"
                    value={modoB_compra}
                    onChange={(e) => setModoB_compra(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Câmbio (R$/USD)</label>
                  <Input type="number" min="0" step="0.01" placeholder="5.20"
                    value={modoB_cambio}
                    onChange={(e) => setModoB_cambio(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Frete (USD/un)</label>
                  <Input type="number" min="0" placeholder="0.00"
                    value={modoB_frete}
                    onChange={(e) => setModoB_frete(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Impostos / Despesas (%)</label>
                  <Input type="number" min="0" placeholder="0"
                    value={modoB_imposto}
                    onChange={(e) => setModoB_imposto(e.target.value)}
                  />
                </div>
              </div>

              {resultB ? (
                <div className="rounded-lg border border-green-400 bg-green-50 dark:bg-green-950/20 p-4 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Custo total (R$/un)</span>
                    <span className="font-semibold">
                      {resultB.custoBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Lucro estimado (R$/un)</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {resultB.lucro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <div className="border-t pt-2 flex justify-between items-baseline">
                    <span className="text-xs font-semibold text-muted-foreground">Venda mínima (R$/un)</span>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      {resultB.vendaMinBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center pt-1">
                    Margem sobre venda: {resultB.mg}%
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Preencha o preço de compra para calcular
                </p>
              )}
            </CardContent>
          </Card>
        </div>

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
