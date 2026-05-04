import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  DollarSign, Percent, Trash2, TrendingUp, Search, BookmarkPlus,
  ChevronDown, ChevronUp, Building2, Package, Clock, Star, X,
  FileText, Calculator, History, AlertCircle, CheckCircle2,
} from "lucide-react";
import { HeaderTabs } from "@/components/HeaderTabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CatalogoItem {
  id: string;
  codigo: string;
  descricao: string;
  preco_compra: number | null;
  preco_venda: number | null;
  fornecedores: string[];
  categorias: string[];
}

interface CotacaoSalva {
  id: string;
  criadoEm: string;
  produto: string;
  codigo: string;
  fornecedor: string;
  precoCompraUSD: number | null;
  precoVendaBRL: number | null;
  qtd: number;
  freteUSD: number;
  impostoPct: number;
  cambio: number;
  custoUnitBRL: number;
  vendaMinBRL: number;
  margemReal: number | null;
  margem: number;
  observacao: string;
}

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

// ─────────────────────────────────────────────
// Constants / helpers
// ─────────────────────────────────────────────

const VENDA_STORAGE_KEY = "embarques.simulador_venda.v1";

const FORM_EMPTY: Omit<VendaItem, "id"> = {
  descricao: "",
  precoCompraUSD: "",
  qtd: "1",
  freteUSD: "",
  impostoPct: "",
  cambio: "5.20",
  precoVendaBRL: "",
};

function cotacoesKey(userId: string) {
  return `importcontrol.cotacoes.v2.${userId}`;
}

function readCotacoes(userId: string): CotacaoSalva[] {
  try {
    const raw = localStorage.getItem(cotacoesKey(userId));
    return raw ? (JSON.parse(raw) as CotacaoSalva[]) : [];
  } catch {
    return [];
  }
}

function saveCotacoes(userId: string, items: CotacaoSalva[]) {
  localStorage.setItem(cotacoesKey(userId), JSON.stringify(items));
}

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

  return { qtd, custoUnitUSD, custoUnitBRL, custoTotalBRL: custoUnitBRL * qtd, vendaMinBRL, vendaTotalMinBRL: vendaMinBRL * qtd, margemReal, abaixoMinimo };
}

function calcCotacao(
  precoCompraUSD: number,
  precoVendaBRL: number,
  qtd: number,
  freteUSD: number,
  impostoPct: number,
  cambio: number,
  margem: number,
) {
  const custoUnitUSD = precoCompraUSD + freteUSD / Math.max(qtd, 1);
  const custoUnitBRL = custoUnitUSD * cambio * (1 + impostoPct / 100);
  const vendaMinBRL  = custoUnitBRL / (1 - margem / 100);
  const margemReal   = precoVendaBRL > 0 ? ((precoVendaBRL - custoUnitBRL) / precoVendaBRL) * 100 : null;
  const abaixoMinimo = precoVendaBRL > 0 && precoVendaBRL < vendaMinBRL;
  const lucro        = precoVendaBRL > 0 ? precoVendaBRL - custoUnitBRL : vendaMinBRL - custoUnitBRL;
  return { custoUnitUSD, custoUnitBRL, vendaMinBRL, margemReal, abaixoMinimo, lucro };
}

// ─────────────────────────────────────────────
// Product search hook
// ─────────────────────────────────────────────

function useProductSearch(query: string) {
  const [results, setResults] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 2) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("catalogo_materiais")
          .select("id, codigo, descricao, preco_compra, fornecedores, categorias")
          .or(`codigo.ilike.%${query}%,descricao.ilike.%${query}%`)
          .order("ultima_atualizacao", { ascending: false })
          .limit(12);
        setResults(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((data ?? []) as any[]).map((r) => ({
            id: r.id as string,
            codigo: r.codigo as string ?? "",
            descricao: r.descricao as string ?? "",
            preco_compra: r.preco_compra != null ? Number(r.preco_compra) : null,
            preco_venda: null,
            fornecedores: (r.fornecedores as string[]) ?? [],
            categorias: (r.categorias as string[]) ?? [],
          })),
        );
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  return { results, loading };
}

// ─────────────────────────────────────────────
// Current user hook
// ─────────────────────────────────────────────

function useCurrentUser() {
  const [userId, setUserId] = useState<string>("anonymous");
  const [displayName, setDisplayName] = useState<string>("Usuário");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUserId(data.session.user.id);
        setDisplayName(data.session.user.email?.split("@")[0] ?? "Usuário");
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        setDisplayName(session.user.email?.split("@")[0] ?? "Usuário");
      } else {
        setUserId("anonymous");
        setDisplayName("Usuário");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return { userId, displayName };
}

// ─────────────────────────────────────────────
// CotacaoForm component
// ─────────────────────────────────────────────

interface CotacaoFormState {
  produto: string;
  codigo: string;
  fornecedor: string;
  precoCompraUSD: string;
  precoVendaBRL: string;
  qtd: string;
  freteUSD: string;
  impostoPct: string;
  cambio: string;
  observacao: string;
}

const COTACAO_EMPTY: CotacaoFormState = {
  produto: "", codigo: "", fornecedor: "",
  precoCompraUSD: "", precoVendaBRL: "",
  qtd: "1", freteUSD: "", impostoPct: "", cambio: "5.20", observacao: "",
};

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function Precificacao() {
  const { userId, displayName } = useCurrentUser();
  const [margem, setMargem] = useState("18");
  const margemNum = Number(margem) || 18;

  // ── Simulador de itens ──────────────────────────────────────────────
  const [vendaItems, setVendaItems] = useState<VendaItem[]>(() => {
    try {
      const raw = window.localStorage.getItem(VENDA_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as VendaItem[]) : [];
    } catch { return []; }
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

  const calcs   = vendaItems.map((item) => ({ item, c: calcVenda(item, margemNum) }));
  const totalCusto    = calcs.reduce((s, { c }) => s + c.custoTotalBRL, 0);
  const totalVendaMin = calcs.reduce((s, { c }) => s + c.vendaTotalMinBRL, 0);

  // ── Calculadoras rápidas ────────────────────────────────────────────
  const [modoA_venda,   setModoA_venda]   = useState("");
  const [modoA_cambio,  setModoA_cambio]  = useState("5.20");
  const [modoA_frete,   setModoA_frete]   = useState("");
  const [modoA_imposto, setModoA_imposto] = useState("");

  const resultA = useMemo(() => {
    const venda   = Number(modoA_venda)   || 0;
    const cambio  = Number(modoA_cambio)  || 5.20;
    const frete   = Number(modoA_frete)   || 0;
    const imposto = Number(modoA_imposto) || 0;
    const mg      = margemNum;
    if (!venda) return null;
    const custoMaxBRL  = venda * (1 - mg / 100);
    const custoMaxUSD  = custoMaxBRL / (cambio * (1 + imposto / 100));
    const compraMaxUSD = custoMaxUSD - frete;
    return { venda, custoMaxBRL, custoMaxUSD, compraMaxUSD, lucro: venda - custoMaxBRL, mg };
  }, [modoA_venda, modoA_cambio, modoA_frete, modoA_imposto, margemNum]);

  const [modoB_compra,  setModoB_compra]  = useState("");
  const [modoB_cambio,  setModoB_cambio]  = useState("5.20");
  const [modoB_frete,   setModoB_frete]   = useState("");
  const [modoB_imposto, setModoB_imposto] = useState("");

  const resultB = useMemo(() => {
    const compra  = Number(modoB_compra)  || 0;
    const cambio  = Number(modoB_cambio)  || 5.20;
    const frete   = Number(modoB_frete)   || 0;
    const imposto = Number(modoB_imposto) || 0;
    const mg      = margemNum;
    if (!compra) return null;
    const custoBRL    = (compra + frete) * cambio * (1 + imposto / 100);
    const vendaMinBRL = custoBRL / (1 - mg / 100);
    return { compra, custoBRL, vendaMinBRL, lucro: vendaMinBRL - custoBRL, mg };
  }, [modoB_compra, modoB_cambio, modoB_frete, modoB_imposto, margemNum]);

  // ── Cotação por produto ─────────────────────────────────────────────
  const [searchQuery, setSearchQuery]     = useState("");
  const [showDropdown, setShowDropdown]   = useState(false);
  const [cotacaoForm, setCotacaoForm]     = useState<CotacaoFormState>(COTACAO_EMPTY);
  const [selectedProduct, setSelectedProduct] = useState<CatalogoItem | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const { results: searchResults, loading: searchLoading } = useProductSearch(searchQuery);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectProduct = useCallback((item: CatalogoItem) => {
    setSelectedProduct(item);
    setSearchQuery(item.codigo ? `${item.codigo} - ${item.descricao}` : item.descricao);
    setShowDropdown(false);
    setCotacaoForm((f) => ({
      ...f,
      produto: item.descricao,
      codigo: item.codigo,
      fornecedor: item.fornecedores[0] ?? "",
      precoCompraUSD: item.preco_compra != null ? String(item.preco_compra) : f.precoCompraUSD,
    }));
  }, []);

  const handleClearSearch = () => {
    setSearchQuery("");
    setSelectedProduct(null);
    setCotacaoForm(COTACAO_EMPTY);
  };

  const cotacaoCalc = useMemo(() => {
    const compra  = Number(cotacaoForm.precoCompraUSD) || 0;
    const venda   = Number(cotacaoForm.precoVendaBRL)  || 0;
    const qtd     = Number(cotacaoForm.qtd)            || 1;
    const frete   = Number(cotacaoForm.freteUSD)       || 0;
    const imposto = Number(cotacaoForm.impostoPct)     || 0;
    const cambio  = Number(cotacaoForm.cambio)         || 5.20;
    if (!compra && !venda) return null;
    return calcCotacao(compra, venda, qtd, frete, imposto, cambio, margemNum);
  }, [cotacaoForm, margemNum]);

  // ── Cotações salvas ─────────────────────────────────────────────────
  const [cotacoes, setCotacoes] = useState<CotacaoSalva[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (userId !== "anonymous") {
      setCotacoes(readCotacoes(userId));
    }
  }, [userId]);

  const handleSaveCotacao = () => {
    if (!cotacaoForm.produto && !cotacaoForm.codigo) {
      toast.error("Informe o produto antes de salvar.");
      return;
    }
    if (!cotacaoForm.precoCompraUSD && !cotacaoForm.precoVendaBRL) {
      toast.error("Informe pelo menos um preço para salvar.");
      return;
    }

    const calc = cotacaoCalc;
    const nova: CotacaoSalva = {
      id: Date.now().toString(),
      criadoEm: new Date().toISOString(),
      produto: cotacaoForm.produto || cotacaoForm.codigo,
      codigo: cotacaoForm.codigo,
      fornecedor: cotacaoForm.fornecedor,
      precoCompraUSD: Number(cotacaoForm.precoCompraUSD) || null,
      precoVendaBRL: Number(cotacaoForm.precoVendaBRL) || null,
      qtd: Number(cotacaoForm.qtd) || 1,
      freteUSD: Number(cotacaoForm.freteUSD) || 0,
      impostoPct: Number(cotacaoForm.impostoPct) || 0,
      cambio: Number(cotacaoForm.cambio) || 5.20,
      custoUnitBRL: calc?.custoUnitBRL ?? 0,
      vendaMinBRL: calc?.vendaMinBRL ?? 0,
      margemReal: calc?.margemReal ?? null,
      margem: margemNum,
      observacao: cotacaoForm.observacao,
    };

    const updated = [nova, ...cotacoes];
    setCotacoes(updated);
    saveCotacoes(userId, updated);
    toast.success("Cotação salva com sucesso!");
    setShowHistory(true);
  };

  const handleDeleteCotacao = (id: string) => {
    const updated = cotacoes.filter((c) => c.id !== id);
    setCotacoes(updated);
    saveCotacoes(userId, updated);
    toast.info("Cotação removida.");
  };

  const handleApplyCotacao = (c: CotacaoSalva) => {
    setCotacaoForm({
      produto: c.produto,
      codigo: c.codigo,
      fornecedor: c.fornecedor,
      precoCompraUSD: c.precoCompraUSD != null ? String(c.precoCompraUSD) : "",
      precoVendaBRL: c.precoVendaBRL != null ? String(c.precoVendaBRL) : "",
      qtd: String(c.qtd),
      freteUSD: String(c.freteUSD),
      impostoPct: String(c.impostoPct),
      cambio: String(c.cambio),
      observacao: c.observacao,
    });
    setSearchQuery(c.codigo ? `${c.codigo} - ${c.produto}` : c.produto);
    setShowHistory(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info("Cotação carregada no formulário.");
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <HeaderTabs />
      <main className="mx-auto max-w-[1400px] px-6 py-6 space-y-6">

        {/* ── Cabeçalho ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Precificação</h1>
              <p className="text-sm text-muted-foreground">
                Simulador de preço de venda, cotação por produto e análise de margem
              </p>
            </div>
          </div>

          {/* Margem global */}
          <div className="flex items-center gap-3 bg-card border border-border/60 rounded-xl px-4 py-2.5 shadow-sm">
            <Percent className="h-4 w-4 text-primary" />
            <label className="text-sm font-medium whitespace-nowrap">Margem mínima</label>
            <Input
              type="number" min="1" max="99" className="w-20 h-8 text-center font-bold"
              value={margem}
              onChange={(e) => setMargem(e.target.value)}
            />
            <span className="text-sm font-bold text-primary">%</span>
          </div>
        </div>

        {/* ── Calculadoras Rápidas ────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* MODO A — Tenho o preço de VENDA */}
          <div className="relative overflow-hidden rounded-xl border border-blue-500/30 bg-card shadow-sm">
            <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-blue-500 to-indigo-500" />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
                  <Calculator className="h-4 w-4 text-blue-500" />
                </div>
                <h3 className="text-sm font-semibold">Sei o preço de venda</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Por quanto posso comprar para ter {margemNum}% de margem?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Preço de Venda (R$/un)</label>
                  <Input type="number" min="0" placeholder="Ex: 120,00" value={modoA_venda} onChange={(e) => setModoA_venda(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Câmbio (R$/USD)</label>
                  <Input type="number" min="0" step="0.01" placeholder="5.20" value={modoA_cambio} onChange={(e) => setModoA_cambio(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Frete (USD/un)</label>
                  <Input type="number" min="0" placeholder="0.00" value={modoA_frete} onChange={(e) => setModoA_frete(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Impostos / Despesas (%)</label>
                  <Input type="number" min="0" placeholder="0" value={modoA_imposto} onChange={(e) => setModoA_imposto(e.target.value)} />
                </div>
              </div>
              {resultA ? (
                <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Custo máximo (R$/un)</span>
                    <span className="font-semibold">{resultA.custoMaxBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Custo máximo (USD/un)</span>
                    <span className="font-semibold">$ {resultA.custoMaxUSD.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between items-baseline">
                    <span className="text-xs font-semibold text-muted-foreground">Compra máxima (USD/un)</span>
                    <span className="text-xl font-bold text-blue-500">
                      $ {resultA.compraMaxUSD > 0 ? resultA.compraMaxUSD.toFixed(2) : "—"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center pt-1">
                    Lucro estimado: {resultA.lucro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · margem {resultA.mg}%
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">Preencha o preço de venda para calcular</p>
              )}
            </div>
          </div>

          {/* MODO B — Tenho o preço de COMPRA */}
          <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-card shadow-sm">
            <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Calculator className="h-4 w-4 text-emerald-500" />
                </div>
                <h3 className="text-sm font-semibold">Sei o preço de compra</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Por quanto preciso vender para ter {margemNum}% de margem?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Preço de Compra (USD/un)</label>
                  <Input type="number" min="0" placeholder="Ex: 10.00" value={modoB_compra} onChange={(e) => setModoB_compra(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Câmbio (R$/USD)</label>
                  <Input type="number" min="0" step="0.01" placeholder="5.20" value={modoB_cambio} onChange={(e) => setModoB_cambio(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Frete (USD/un)</label>
                  <Input type="number" min="0" placeholder="0.00" value={modoB_frete} onChange={(e) => setModoB_frete(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Impostos / Despesas (%)</label>
                  <Input type="number" min="0" placeholder="0" value={modoB_imposto} onChange={(e) => setModoB_imposto(e.target.value)} />
                </div>
              </div>
              {resultB ? (
                <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Custo total (R$/un)</span>
                    <span className="font-semibold">{resultB.custoBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Lucro estimado (R$/un)</span>
                    <span className="font-semibold text-emerald-500">{resultB.lucro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between items-baseline">
                    <span className="text-xs font-semibold text-muted-foreground">Venda mínima (R$/un)</span>
                    <span className="text-xl font-bold text-emerald-500">
                      {resultB.vendaMinBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center pt-1">Margem sobre venda: {resultB.mg}%</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">Preencha o preço de compra para calcular</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Cotação por Produto ─────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-xl border border-violet-500/30 bg-card shadow-sm">
          <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />
          <div className="p-5 pb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
              <FileText className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Cotação por Produto</h2>
              <p className="text-xs text-muted-foreground">
                Busque pelo código ou descrição do produto para puxar preços automaticamente
              </p>
            </div>
          </div>

          <div className="px-5 pb-5 space-y-4">
            {/* Search */}
            <div className="relative" ref={searchRef}>
              <label className="text-xs text-muted-foreground mb-1 block font-medium">
                Buscar Produto (código ou descrição)
              </label>
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-9 pr-9"
                  placeholder="Ex: CL90ST004022S ou CURVA RL 90G STD DN 4"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                  onFocus={() => searchQuery.length >= 2 && setShowDropdown(true)}
                />
                {searchQuery && (
                  <button onClick={handleClearSearch} className="absolute right-3 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {showDropdown && (searchLoading || searchResults.length > 0) && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                  {searchLoading && (
                    <div className="px-4 py-3 text-xs text-muted-foreground">Buscando...</div>
                  )}
                  {!searchLoading && searchResults.map((item) => (
                    <button
                      key={item.id}
                      className="w-full px-4 py-2.5 text-left hover:bg-muted/60 transition-colors border-b border-border/30 last:border-0"
                      onMouseDown={() => handleSelectProduct(item)}
                    >
                      <div className="flex items-start gap-2">
                        <Package className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{item.descricao || item.codigo}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {item.codigo && (
                              <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 rounded">
                                {item.codigo}
                              </span>
                            )}
                            {item.preco_compra != null && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                $ {item.preco_compra.toFixed(2)}
                              </span>
                            )}
                            {item.fornecedores.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {item.fornecedores.slice(0, 2).join(", ")}
                              </span>
                            )}
                            {item.categorias.length > 0 && (
                              <span className="text-[10px] text-muted-foreground opacity-60">
                                {item.categorias.join(" · ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                  {!searchLoading && searchResults.length === 0 && searchQuery.length >= 2 && (
                    <div className="px-4 py-3 text-xs text-muted-foreground text-center">
                      Produto não encontrado no catálogo — preencha os campos manualmente abaixo.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected product badge */}
            {selectedProduct && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="border-violet-500/40 bg-violet-500/5 text-violet-700 dark:text-violet-400 text-xs gap-1.5">
                  <CheckCircle2 className="h-3 w-3" />
                  Produto encontrado no catálogo
                </Badge>
                {selectedProduct.categorias.map((cat) => (
                  <Badge key={cat} variant="secondary" className="text-[10px]">{cat}</Badge>
                ))}
              </div>
            )}

            {/* Form fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Descrição do Produto</label>
                <Input
                  placeholder="Nome / descrição do produto"
                  value={cotacaoForm.produto}
                  onChange={(e) => setCotacaoForm((f) => ({ ...f, produto: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Código</label>
                <Input
                  placeholder="Ex: CL90ST004022S"
                  value={cotacaoForm.codigo}
                  onChange={(e) => setCotacaoForm((f) => ({ ...f, codigo: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Fornecedor
                </label>
                <Input
                  placeholder={selectedProduct?.fornecedores[0] ?? "Nome do fornecedor"}
                  value={cotacaoForm.fornecedor}
                  onChange={(e) => setCotacaoForm((f) => ({ ...f, fornecedor: e.target.value }))}
                />
                {selectedProduct && selectedProduct.fornecedores.length > 1 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Outros: {selectedProduct.fornecedores.slice(1).join(", ")}
                  </p>
                )}
              </div>

              {/* Prices */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Preço Compra (USD/un)
                  {selectedProduct?.preco_compra != null && (
                    <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                      (ref: $ {selectedProduct.preco_compra.toFixed(2)})
                    </span>
                  )}
                </label>
                <Input
                  type="number" min="0" step="0.01"
                  placeholder="0.00"
                  value={cotacaoForm.precoCompraUSD}
                  onChange={(e) => setCotacaoForm((f) => ({ ...f, precoCompraUSD: e.target.value }))}
                  className={cn(cotacaoForm.precoCompraUSD && "border-emerald-500/50 focus:border-emerald-500")}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Preço Venda (R$/un) <span className="text-[10px] opacity-60">opcional</span>
                </label>
                <Input
                  type="number" min="0" step="0.01"
                  placeholder="0,00"
                  value={cotacaoForm.precoVendaBRL}
                  onChange={(e) => setCotacaoForm((f) => ({ ...f, precoVendaBRL: e.target.value }))}
                  className={cn(cotacaoForm.precoVendaBRL && "border-blue-500/50 focus:border-blue-500")}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Quantidade</label>
                <Input
                  type="number" min="1" placeholder="1"
                  value={cotacaoForm.qtd}
                  onChange={(e) => setCotacaoForm((f) => ({ ...f, qtd: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Frete Total (USD)</label>
                <Input
                  type="number" min="0" placeholder="0.00"
                  value={cotacaoForm.freteUSD}
                  onChange={(e) => setCotacaoForm((f) => ({ ...f, freteUSD: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Impostos / Despesas (%)</label>
                <Input
                  type="number" min="0" placeholder="0"
                  value={cotacaoForm.impostoPct}
                  onChange={(e) => setCotacaoForm((f) => ({ ...f, impostoPct: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Câmbio (R$/USD)</label>
                <Input
                  type="number" min="0" step="0.01" placeholder="5.20"
                  value={cotacaoForm.cambio}
                  onChange={(e) => setCotacaoForm((f) => ({ ...f, cambio: e.target.value }))}
                />
              </div>
              <div className="lg:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Observação</label>
                <Input
                  placeholder="Notas sobre esta cotação..."
                  value={cotacaoForm.observacao}
                  onChange={(e) => setCotacaoForm((f) => ({ ...f, observacao: e.target.value }))}
                />
              </div>
            </div>

            {/* Result + actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Result panel */}
              {cotacaoCalc ? (
                <div className={cn(
                  "flex-1 rounded-xl border p-4 space-y-2",
                  cotacaoCalc.abaixoMinimo
                    ? "border-red-500/40 bg-red-500/5"
                    : "border-violet-500/30 bg-violet-500/5",
                )}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Resultado da Cotação
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Custo unitário (USD)</span>
                      <span className="font-semibold">$ {cotacaoCalc.custoUnitUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Custo unitário (R$)</span>
                      <span className="font-semibold">
                        {cotacaoCalc.custoUnitBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Venda mínima (R$/un)</span>
                      <span className="font-semibold text-violet-600 dark:text-violet-400">
                        {cotacaoCalc.vendaMinBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                    {cotacaoCalc.margemReal !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Margem real</span>
                        <span className={cn("font-bold", cotacaoCalc.margemReal >= margemNum ? "text-emerald-500" : "text-red-500")}>
                          {cotacaoCalc.margemReal.toFixed(1)}%
                          {cotacaoCalc.abaixoMinimo && " ⚠️"}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between col-span-2 border-t pt-1.5 mt-0.5">
                      <span className="text-muted-foreground font-medium">Lucro estimado (R$/un)</span>
                      <span className={cn("font-bold", cotacaoCalc.lucro > 0 ? "text-emerald-500" : "text-red-500")}>
                        {cotacaoCalc.lucro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  </div>
                  {cotacaoCalc.abaixoMinimo && (
                    <div className="flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      Preço de venda abaixo da margem mínima de {margemNum}%
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 rounded-xl border border-dashed border-border/60 p-4 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground text-center">
                    Preencha pelo menos o preço de compra ou venda para ver o resultado
                  </p>
                </div>
              )}

              {/* Save button */}
              <div className="flex flex-col gap-2 justify-end">
                <Button
                  onClick={handleSaveCotacao}
                  className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                  disabled={!cotacaoForm.produto && !cotacaoForm.codigo}
                >
                  <BookmarkPlus className="h-4 w-4" />
                  Salvar Cotação
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Salvo como: <span className="font-semibold">{displayName}</span>
                </p>
                <Button
                  variant="ghost" size="sm"
                  className="text-xs text-muted-foreground gap-1"
                  onClick={() => { setCotacaoForm(COTACAO_EMPTY); setSearchQuery(""); setSelectedProduct(null); }}
                >
                  <X className="h-3 w-3" /> Limpar
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Histórico de Cotações ────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-amber-500 to-orange-500" />
          <button
            className="w-full flex items-center justify-between p-5 hover:bg-muted/20 transition-colors"
            onClick={() => setShowHistory((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                <History className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Histórico de Cotações</p>
                <p className="text-xs text-muted-foreground">
                  {cotacoes.length} cotação(ões) salva(s) para {displayName}
                </p>
              </div>
            </div>
            {showHistory ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {showHistory && (
            <div className="px-5 pb-5">
              {cotacoes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma cotação salva ainda. Faça sua primeira cotação acima.
                </p>
              ) : (
                <div className="space-y-2">
                  {cotacoes.map((c) => (
                    <div key={c.id} className="flex items-start gap-3 rounded-lg border border-border/40 p-3 hover:bg-muted/20 transition-colors">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 mt-0.5">
                        <Star className="h-3.5 w-3.5 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold truncate">{c.produto || c.codigo || "—"}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                              {c.codigo && (
                                <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 rounded">{c.codigo}</span>
                              )}
                              {c.fornecedor && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Building2 className="h-2.5 w-2.5" />{c.fornecedor}
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {new Date(c.criadoEm).toLocaleDateString("pt-BR")} {new Date(c.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {c.precoCompraUSD != null && (
                              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                Compra: $ {c.precoCompraUSD.toFixed(2)}
                              </span>
                            )}
                            {c.precoVendaBRL != null && (
                              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                Venda: {c.precoVendaBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </span>
                            )}
                            {c.margemReal != null && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  c.margemReal >= c.margem
                                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                                    : "border-red-500/40 text-red-600 dark:text-red-400",
                                )}
                              >
                                {c.margemReal.toFixed(1)}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        {c.observacao && (
                          <p className="text-[11px] text-muted-foreground mt-1 italic">{c.observacao}</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm" variant="outline"
                            className="h-6 text-[10px] px-2"
                            onClick={() => handleApplyCotacao(c)}
                          >
                            Carregar
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-6 text-[10px] px-2 text-muted-foreground"
                            onClick={() => {
                              // Add to simulador
                              if (c.precoCompraUSD != null) {
                                saveItems([...vendaItems, {
                                  id: Date.now().toString(),
                                  descricao: c.codigo ? `${c.codigo} - ${c.produto}` : c.produto,
                                  precoCompraUSD: String(c.precoCompraUSD),
                                  qtd: String(c.qtd),
                                  freteUSD: String(c.freteUSD),
                                  impostoPct: String(c.impostoPct),
                                  cambio: String(c.cambio),
                                  precoVendaBRL: c.precoVendaBRL != null ? String(c.precoVendaBRL) : "",
                                }]);
                                toast.success("Item adicionado ao simulador.");
                              }
                            }}
                          >
                            + Simulador
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-6 text-[10px] px-2 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteCotacao(c.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Simulador de Preço de Venda ─────────────────────────────── */}
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-primary to-cyan-500" />
          <div className="p-5 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Simulador de Preço de Venda</h2>
                <p className="text-xs text-muted-foreground">
                  Calcule o preço mínimo de venda com base no custo de compra e despesas
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 pb-5 space-y-4">
            {/* KPIs */}
            {vendaItems.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Itens cadastrados", value: String(vendaItems.length), color: "text-primary" },
                  { label: "Custo total (R$)", value: totalCusto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), color: "text-foreground" },
                  { label: "Venda mínima total", value: totalVendaMin.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), color: "text-primary" },
                  { label: "Margem mínima", value: `${margemNum}%`, color: "text-emerald-500" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl border border-border/60 bg-card p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={cn("text-xl font-bold mt-0.5 num", color)}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add item form */}
            <div className="rounded-lg border border-border/40 p-4 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adicionar item</p>
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
                  <Input type="number" min="0" placeholder="0.00" value={vendaForm.precoCompraUSD}
                    onChange={(e) => setVendaForm((f) => ({ ...f, precoCompraUSD: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Quantidade</label>
                  <Input type="number" min="1" placeholder="1" value={vendaForm.qtd}
                    onChange={(e) => setVendaForm((f) => ({ ...f, qtd: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Frete Total (USD)</label>
                  <Input type="number" min="0" placeholder="0.00" value={vendaForm.freteUSD}
                    onChange={(e) => setVendaForm((f) => ({ ...f, freteUSD: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Impostos / Despesas (%)</label>
                  <Input type="number" min="0" placeholder="0" value={vendaForm.impostoPct}
                    onChange={(e) => setVendaForm((f) => ({ ...f, impostoPct: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Câmbio (R$/USD)</label>
                  <Input type="number" min="0" step="0.01" placeholder="5.20" value={vendaForm.cambio}
                    onChange={(e) => setVendaForm((f) => ({ ...f, cambio: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Preço Venda (R$/un) <span className="text-[10px] opacity-60">opcional</span>
                  </label>
                  <Input type="number" min="0" placeholder="deixe vazio para calcular" value={vendaForm.precoVendaBRL}
                    onChange={(e) => setVendaForm((f) => ({ ...f, precoVendaBRL: e.target.value }))} />
                </div>
              </div>
              <Button onClick={addItem} disabled={!vendaForm.descricao || !vendaForm.precoCompraUSD} className="gap-1">
                + Adicionar Item
              </Button>
            </div>

            {/* Table */}
            {calcs.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      {["Descrição", "Qtd", "Custo Unit (USD)", "Frete/Un", "Custo Unit (R$)", "Custo Total (R$)", "Venda Mín (R$/un)", "Preço Venda (R$/un)", "Margem Real", ""].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calcs.map(({ item, c }) => (
                      <tr key={item.id} className={cn("border-b last:border-0 hover:bg-muted/30 transition-colors", c.abaixoMinimo && "bg-red-50 dark:bg-red-950/20")}>
                        <td className="px-3 py-2 font-medium">{item.descricao}</td>
                        <td className="px-3 py-2 text-center">{c.qtd}</td>
                        <td className="px-3 py-2 num">$ {c.custoUnitUSD.toFixed(2)}</td>
                        <td className="px-3 py-2 num">$ {(Number(item.freteUSD) / c.qtd || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 num">{c.custoUnitBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                        <td className="px-3 py-2 num">{c.custoTotalBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                        <td className="px-3 py-2 font-semibold text-primary num">{c.vendaMinBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                        <td className="px-3 py-2">
                          {item.precoVendaBRL ? (
                            <span className={cn("font-semibold num", c.abaixoMinimo ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
                              {Number(item.precoVendaBRL).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              {c.abaixoMinimo && " ⚠"}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {c.margemReal !== null ? (
                            <span className={cn("font-bold num", c.margemReal >= margemNum ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                              {c.margemReal.toFixed(1)}%
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
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
                      <td className="px-3 py-2 num">{totalCusto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                      <td className="px-3 py-2 text-primary num">{totalVendaMin.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
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
          </div>
        </div>

      </main>
    </div>
  );
}
