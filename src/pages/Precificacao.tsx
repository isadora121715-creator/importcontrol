import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  DollarSign, Percent, Trash2, TrendingUp, Search, BookmarkPlus,
  ChevronDown, ChevronUp, Building2, Package, Clock, Star, X, Plus,
  FileText, Calculator, History, AlertCircle, CheckCircle2,
  Folder, FolderOpen, Download, FileSpreadsheet, FileDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  pasta: string;
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

interface FormalQuoteItem {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  qtd: number;
  precoUSD: number;
}

interface FormalQuoteFormState {
  cliente: string;
  referencia: string;
  data: string;
  validade: string;
  cambio: string;
  condicoesPagamento: string;
  prazoEntrega: string;
  observacoes: string;
}

const FORMAL_QUOTE_EMPTY: FormalQuoteFormState = {
  cliente: "",
  referencia: "",
  data: new Date().toISOString().slice(0, 10),
  validade: "",
  cambio: "5.20",
  condicoesPagamento: "",
  prazoEntrega: "",
  observacoes: "",
};

interface VendaItem {
  id: string;
  descricao: string;
  fornecedor: string;
  unidade: string;
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
  fornecedor: "",
  unidade: "UN",
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

function calcVenda(item: VendaItem, margemPct: number, fatorAlvo: number) {
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
  // Fator = Preço Venda (R$) / Preço Compra (USD). Ex.: 584,56 / 48,71 ≈ 12
  const fatorReal     = vendaUser > 0 && compra > 0 ? vendaUser / compra : null;
  const vendaPorFator = compra > 0 && fatorAlvo > 0 ? compra * fatorAlvo : null;

  return { qtd, custoUnitUSD, custoUnitBRL, custoTotalBRL: custoUnitBRL * qtd, vendaMinBRL, vendaTotalMinBRL: vendaMinBRL * qtd, margemReal, abaixoMinimo, fatorReal, vendaPorFator };
}

function calcCotacao(
  precoCompraUSD: number,
  precoVendaBRL: number,
  qtd: number,
  freteUSD: number,
  impostoPct: number,
  cambio: number,
  margem: number,
  fatorAlvo: number,
) {
  const custoUnitUSD = precoCompraUSD + freteUSD / Math.max(qtd, 1);
  const custoUnitBRL = custoUnitUSD * cambio * (1 + impostoPct / 100);
  const vendaMinBRL  = custoUnitBRL / (1 - margem / 100);
  const margemReal   = precoVendaBRL > 0 ? ((precoVendaBRL - custoUnitBRL) / precoVendaBRL) * 100 : null;
  const abaixoMinimo = precoVendaBRL > 0 && precoVendaBRL < vendaMinBRL;
  const lucro        = precoVendaBRL > 0 ? precoVendaBRL - custoUnitBRL : vendaMinBRL - custoUnitBRL;
  // Fator: relação direta Venda(R$) ÷ Compra(USD). Ex.: 584,56 / 48,71 ≈ 12
  const fatorReal     = precoVendaBRL > 0 && precoCompraUSD > 0 ? precoVendaBRL / precoCompraUSD : null;
  const vendaPorFator = precoCompraUSD > 0 && fatorAlvo > 0 ? precoCompraUSD * fatorAlvo : null;
  const compraPorFator = precoVendaBRL > 0 && fatorAlvo > 0 ? precoVendaBRL / fatorAlvo : null;
  return { custoUnitUSD, custoUnitBRL, vendaMinBRL, margemReal, abaixoMinimo, lucro, fatorReal, vendaPorFator, compraPorFator };
}

// ─────────────────────────────────────────────
// Product search hook
// Queries `pedidos` first (has both preco_compra + preco_venda),
// falls back to catalogo_materiais if no rows found.
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
        const filter = `codigo.ilike.%${query}%,descricao.ilike.%${query}%`;
        const [catRes, pedRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from("catalogo_materiais")
            .select("id, codigo, descricao, preco_compra, fornecedores, categorias")
            .or(filter)
            .order("ultima_atualizacao", { ascending: false })
            .limit(15),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from("pedidos")
            .select("id, codigo, descricao, preco_compra, preco_venda, fornecedor, categoria")
            .or(filter)
            .order("created_at", { ascending: false })
            .limit(30),
        ]);

        const merged = new Map<string, CatalogoItem>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const r of (catRes.data ?? []) as any[]) {
          const key = (r.codigo || r.descricao || r.id || "").toString().trim().toUpperCase();
          if (!key) continue;
          merged.set(key, {
            id: r.id as string,
            codigo: (r.codigo as string) ?? "",
            descricao: (r.descricao as string) ?? "",
            preco_compra: r.preco_compra != null ? Number(r.preco_compra) : null,
            preco_venda: null,
            fornecedores: (r.fornecedores as string[]) ?? [],
            categorias: (r.categorias as string[]) ?? [],
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const r of (pedRes.data ?? []) as any[]) {
          const codigo = ((r.codigo as string) ?? "").trim();
          const descricao = ((r.descricao as string) ?? "").trim();
          const key = (codigo || descricao).toUpperCase();
          if (!key) continue;
          const fornecedor = ((r.fornecedor as string) ?? "").trim();
          const categoria = ((r.categoria as string) ?? "").trim();
          const preco = r.preco_compra != null ? Number(r.preco_compra) : null;
          const precoVenda = r.preco_venda != null ? Number(r.preco_venda) : null;
          const existing = merged.get(key);
          if (existing) {
            if (existing.preco_compra == null && preco != null) existing.preco_compra = preco;
            if (existing.preco_venda == null && precoVenda != null) existing.preco_venda = precoVenda;
            if (fornecedor && !existing.fornecedores.includes(fornecedor)) existing.fornecedores.push(fornecedor);
            if (categoria && !existing.categorias.includes(categoria)) existing.categorias.push(categoria);
          } else {
            merged.set(key, {
              id: `pedido:${r.id}`,
              codigo,
              descricao,
              preco_compra: preco,
              preco_venda: precoVenda,
              fornecedores: fornecedor ? [fornecedor] : [],
              categorias: categoria ? [categoria] : [],
            });
          }
        }

        setResults(Array.from(merged.values()).slice(0, 20));
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
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUserId(data.session.user.id);
        setDisplayName(data.session.user.email?.split("@")[0] ?? "Usuário");
      }
      setAuthReady(true); // auth check complete — real userId is now known
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

  return { userId, displayName, authReady };
}

// ─────────────────────────────────────────────
// CotacaoForm component
// ─────────────────────────────────────────────

interface CotacaoFormState {
  pasta: string;
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
  pasta: "", produto: "", codigo: "", fornecedor: "",
  precoCompraUSD: "", precoVendaBRL: "",
  qtd: "1", freteUSD: "", impostoPct: "", cambio: "5.20", observacao: "",
};

// Export helpers
function exportCotacoesXLSX(items: CotacaoSalva[], filename: string) {
  const rows = items.map((c) => ({
    Pasta: c.pasta || "(sem pasta)",
    Data: new Date(c.criadoEm).toLocaleString("pt-BR"),
    Codigo: c.codigo,
    Produto: c.produto,
    Fornecedor: c.fornecedor,
    Qtd: c.qtd,
    "Preco Compra (USD)": c.precoCompraUSD ?? "",
    "Frete (USD)": c.freteUSD,
    "Impostos (%)": c.impostoPct,
    "Cambio": c.cambio,
    "Custo Unit (R$)": Number(c.custoUnitBRL.toFixed(2)),
    "Venda Minima (R$)": Number(c.vendaMinBRL.toFixed(2)),
    "Preco Venda (R$)": c.precoVendaBRL ?? "",
    "Margem Real (%)": c.margemReal != null ? Number(c.margemReal.toFixed(2)) : "",
    "Margem Alvo (%)": c.margem,
    Observacao: c.observacao,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cotacoes");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function exportCotacoesPDF(items: CotacaoSalva[], filename: string, titulo: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(titulo, 14, 15);
  doc.setFontSize(9);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")} · ${items.length} cotação(ões)`, 14, 21);

  autoTable(doc, {
    startY: 26,
    head: [["Data", "Código", "Produto", "Fornecedor", "Qtd", "Compra USD", "Custo R$", "Venda Mín R$", "Venda R$", "Margem"]],
    body: items.map((c) => [
      new Date(c.criadoEm).toLocaleDateString("pt-BR"),
      c.codigo || "-",
      (c.produto || "").slice(0, 40),
      (c.fornecedor || "").slice(0, 20),
      String(c.qtd),
      c.precoCompraUSD != null ? `$${c.precoCompraUSD.toFixed(2)}` : "-",
      c.custoUnitBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      c.vendaMinBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      c.precoVendaBRL != null ? c.precoVendaBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-",
      c.margemReal != null ? `${c.margemReal.toFixed(1)}%` : "-",
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [124, 58, 237] },
  });

  doc.save(`${filename}.pdf`);
}

function sanitizeFilename(s: string) {
  return (s || "cotacoes").replace(/[^\w\-]+/g, "_").slice(0, 60);
}

function exportFormalQuotePDF(form: FormalQuoteFormState, items: FormalQuoteItem[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const cambio = Number(form.cambio) || 5.20;
  const today = new Date().toLocaleDateString("pt-BR");
  const BLUE: [number, number, number] = [30, 64, 175];
  const BLUE_LIGHT: [number, number, number] = [239, 246, 255];

  // ── HCI header ──
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("HCI", 10, 14);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.line(24, 4, 24, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Cotação de Materiais", 27, 14);
  doc.setFontSize(8);
  doc.text(`Gerado em: ${today}`, pageW - 10, 14, { align: "right" });

  // ── Quote header ──
  let y = 30;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`COTAÇÃO Nº ${form.referencia || "—"}`, 14, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const dataFormatada = form.data
    ? new Date(form.data + "T12:00:00").toLocaleDateString("pt-BR")
    : today;

  if (form.cliente) {
    doc.setFont("helvetica", "bold");
    doc.text("Cliente:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(form.cliente, 38, y);
    y += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Data:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(dataFormatada, 38, y);

  if (form.validade) {
    const valFormatada = new Date(form.validade + "T12:00:00").toLocaleDateString("pt-BR");
    doc.setFont("helvetica", "bold");
    doc.text("Validade:", pageW / 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(valFormatada, pageW / 2 + 22, y);
  }
  y += 10;

  // ── Products table ──
  const totalUSD = items.reduce((s, i) => s + i.precoUSD * i.qtd, 0);
  const totalBRL = totalUSD * cambio;

  autoTable(doc, {
    startY: y,
    head: [["#", "Código", "Descrição", "Un.", "Qtd", "Unit. (USD)", "Total (USD)"]],
    body: items.map((item, idx) => [
      idx + 1,
      item.codigo || "—",
      item.descricao,
      item.unidade,
      item.qtd,
      `$ ${item.precoUSD.toFixed(2)}`,
      `$ ${(item.precoUSD * item.qtd).toFixed(2)}`,
    ]),
    foot: [
      ["", "", "", "", "", "Total USD:", `$ ${totalUSD.toFixed(2)}`],
      ["", "", "", "", "", `Total BRL (${cambio}):`, `R$ ${totalBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
    ],
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: BLUE_LIGHT },
    footStyles: { fontStyle: "bold", fontSize: 9, fillColor: [230, 235, 255] as [number, number, number] },
    columnStyles: {
      0: { cellWidth: 8,  halign: "center" },
      1: { cellWidth: 26 },
      2: { cellWidth: 78 },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 24, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ty = ((doc as any).lastAutoTable?.finalY ?? y + 50) + 10;

  // ── Commercial terms ──
  if (form.condicoesPagamento || form.prazoEntrega) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Condições Comerciais", 14, ty);
    ty += 5;
    doc.setFont("helvetica", "normal");
    if (form.condicoesPagamento) { doc.text(`Pagamento: ${form.condicoesPagamento}`, 14, ty); ty += 5; }
    if (form.prazoEntrega) { doc.text(`Prazo de entrega: ${form.prazoEntrega}`, 14, ty); ty += 5; }
    ty += 2;
  }
  if (form.observacoes) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Observações:", 14, ty);
    ty += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(form.observacoes, pageW - 28);
    doc.text(lines, 14, ty);
  }

  // ── Footer ──
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`HCI Importcontrol — Cotação de Materiais — ${today}`, pageW / 2, pageH - 5, { align: "center" });

  doc.save(`cotacao_${sanitizeFilename(form.referencia || form.cliente || "formal")}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function exportFormalQuoteXLSX(form: FormalQuoteFormState, items: FormalQuoteItem[]) {
  const cambio = Number(form.cambio) || 5.20;
  const totalUSD = items.reduce((s, i) => s + i.precoUSD * i.qtd, 0);
  const totalBRL = totalUSD * cambio;
  const dataFormatada = form.data ? new Date(form.data + "T12:00:00").toLocaleDateString("pt-BR") : "";
  const valFormatada  = form.validade ? new Date(form.validade + "T12:00:00").toLocaleDateString("pt-BR") : "";

  const rows = [
    ["COTAÇÃO Nº", form.referencia || ""],
    ["Cliente:", form.cliente || ""],
    ["Data:", dataFormatada, "Validade:", valFormatada],
    ["Câmbio (R$/USD):", cambio],
    [],
    ["#", "Código", "Descrição", "Un.", "Qtd", "Preço Unit. (USD)", "Total (USD)", "Total (R$)"],
    ...items.map((item, idx) => [
      idx + 1,
      item.codigo,
      item.descricao,
      item.unidade,
      item.qtd,
      item.precoUSD,
      +(item.precoUSD * item.qtd).toFixed(2),
      +(item.precoUSD * item.qtd * cambio).toFixed(2),
    ]),
    [],
    ["", "", "", "", "", "TOTAL USD", +totalUSD.toFixed(2), ""],
    ["", "", "", "", "", "TOTAL BRL", "", +totalBRL.toFixed(2)],
    [],
    ...(form.condicoesPagamento ? [["Condições Pagamento:", form.condicoesPagamento]] : []),
    ...(form.prazoEntrega       ? [["Prazo de Entrega:",    form.prazoEntrega]]       : []),
    ...(form.observacoes        ? [["Observações:",         form.observacoes]]        : []),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 5 }, { wch: 18 }, { wch: 52 }, { wch: 8 }, { wch: 8 },
    { wch: 18 }, { wch: 16 }, { wch: 16 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cotação");
  XLSX.writeFile(wb, `cotacao_${sanitizeFilename(form.referencia || form.cliente || "formal")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function Precificacao() {
  const { userId, displayName, authReady } = useCurrentUser();
  const [margem, setMargem] = useState("18");
  const margemNum = Number(margem) || 18;
  const [fator, setFator] = useState("12");
  const fatorNum = Number(fator) || 12;

  // ── Simulador de itens ──────────────────────────────────────────────
  const [vendaItems, setVendaItems] = useState<VendaItem[]>(() => {
    try {
      const raw = window.localStorage.getItem(VENDA_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as VendaItem[]) : [];
    } catch { return []; }
  });
  const [vendaForm, setVendaForm] = useState<Omit<VendaItem, "id">>(FORM_EMPTY);
  const [vendaSearch, setVendaSearch] = useState("");
  const [vendaShowDropdown, setVendaShowDropdown] = useState(false);
  const vendaSearchRef = useRef<HTMLDivElement>(null);
  const { results: vendaResults, loading: vendaLoading } = useProductSearch(vendaSearch);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (vendaSearchRef.current && !vendaSearchRef.current.contains(e.target as Node)) {
        setVendaShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectVendaProduct = (item: CatalogoItem) => {
    const desc = item.codigo ? `${item.codigo} - ${item.descricao}` : item.descricao;
    setVendaForm((f) => ({
      ...f,
      descricao: desc,
      fornecedor: item.fornecedores[0] ?? f.fornecedor,
      unidade: f.unidade || "UN",
      precoCompraUSD: item.preco_compra != null ? String(item.preco_compra) : f.precoCompraUSD,
      precoVendaBRL:  item.preco_venda  != null ? String(item.preco_venda)  : f.precoVendaBRL,
    }));
    setVendaSearch(desc);
    setVendaShowDropdown(false);
  };

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

  const calcs   = vendaItems.map((item) => ({ item, c: calcVenda(item, margemNum, fatorNum) }));
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
    const fatorReal     = compraMaxUSD > 0 ? venda / compraMaxUSD : null;
    const compraPorFator = fatorNum > 0 ? venda / fatorNum : null;
    return { venda, custoMaxBRL, custoMaxUSD, compraMaxUSD, lucro: venda - custoMaxBRL, mg, fatorReal, compraPorFator };
  }, [modoA_venda, modoA_cambio, modoA_frete, modoA_imposto, margemNum, fatorNum]);

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
    const fatorReal     = compra > 0 ? vendaMinBRL / compra : null;
    const vendaPorFator = fatorNum > 0 ? compra * fatorNum : null;
    return { compra, custoBRL, vendaMinBRL, lucro: vendaMinBRL - custoBRL, mg, fatorReal, vendaPorFator };
  }, [modoB_compra, modoB_cambio, modoB_frete, modoB_imposto, margemNum, fatorNum]);

  // ── Cotação por produto ─────────────────────────────────────────────
  const [quoteTab, setQuoteTab] = useState<"margem" | "formulario">("margem");

  // ── Análise de margem (tab 1) ────────────────────────────────────────
  const [searchQuery, setSearchQuery]     = useState("");
  const [showDropdown, setShowDropdown]   = useState(false);
  const [cotacaoForm, setCotacaoForm]     = useState<CotacaoFormState>(COTACAO_EMPTY);
  const [selectedProduct, setSelectedProduct] = useState<CatalogoItem | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Formulário de Cotação Formal (tab 2) ─────────────────────────────
  const [formalForm, setFormalForm] = useState<FormalQuoteFormState>(FORMAL_QUOTE_EMPTY);
  const [formalItems, setFormalItems] = useState<FormalQuoteItem[]>([]);
  const [formalAddItem, setFormalAddItem] = useState({ codigo: "", descricao: "", unidade: "UN", qtd: "1", precoUSD: "" });
  const [formalItemSearch, setFormalItemSearch] = useState("");
  const [formalShowDropdown, setFormalShowDropdown] = useState(false);
  const formalSearchRef = useRef<HTMLDivElement>(null);
  const { results: formalResults, loading: formalLoading } = useProductSearch(formalItemSearch);

  const { results: searchResults, loading: searchLoading } = useProductSearch(searchQuery);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
      if (formalSearchRef.current && !formalSearchRef.current.contains(e.target as Node)) setFormalShowDropdown(false);
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
      produto:        item.descricao,
      codigo:         item.codigo,
      fornecedor:     item.fornecedores[0] ?? f.fornecedor,
      precoCompraUSD: item.preco_compra != null ? String(item.preco_compra) : f.precoCompraUSD,
      precoVendaBRL:  item.preco_venda  != null ? String(item.preco_venda)  : f.precoVendaBRL,
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
    return calcCotacao(compra, venda, qtd, frete, imposto, cambio, margemNum, fatorNum);
  }, [cotacaoForm, margemNum, fatorNum]);

  // ── Cotações salvas ─────────────────────────────────────────────────
  const [cotacoes, setCotacoes] = useState<CotacaoSalva[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [pastasAbertas, setPastasAbertas] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!authReady) return; // wait for Supabase auth to resolve before touching localStorage

    const anonKey = cotacoesKey("anonymous");
    const anonRaw = localStorage.getItem(anonKey);

    if (userId !== "anonymous" && anonRaw) {
      // Migrate any cotações saved before auth resolved (under "anonymous" key)
      try {
        const anonItems = JSON.parse(anonRaw) as CotacaoSalva[];
        if (anonItems.length > 0) {
          const existing = readCotacoes(userId);
          // anonymous items go first (they were created chronologically first)
          const merged = [...anonItems, ...existing];
          saveCotacoes(userId, merged);
          localStorage.removeItem(anonKey);
          setCotacoes(merged);
          toast.success(`${anonItems.length} cotação(ões) recuperada(s) para sua conta.`);
          return;
        }
      } catch { /* corrupt data — just remove it */ }
      localStorage.removeItem(anonKey);
    }

    setCotacoes(readCotacoes(userId));
  }, [userId, authReady]);

  const cotacoesPorPasta = useMemo(() => {
    const map = new Map<string, CotacaoSalva[]>();
    for (const c of cotacoes) {
      const k = c.pasta || "Sem pasta";
      const arr = map.get(k) ?? [];
      arr.push(c);
      map.set(k, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [cotacoes]);

  const pastasExistentes = useMemo(
    () => Array.from(new Set(cotacoes.map((c) => c.pasta).filter(Boolean))).sort(),
    [cotacoes],
  );

  const togglePasta = (p: string) => setPastasAbertas((s) => ({ ...s, [p]: !s[p] }));

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
      pasta: cotacaoForm.pasta.trim() || "Sem pasta",
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
      pasta: c.pasta || "",
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

          {/* Fator alvo (Venda R$ ÷ Compra USD) */}
          <div className="flex items-center gap-3 bg-card border border-border/60 rounded-xl px-4 py-2.5 shadow-sm">
            <Calculator className="h-4 w-4 text-violet-500" />
            <label className="text-sm font-medium whitespace-nowrap" title="Preço de Venda (R$) ÷ Preço de Compra (USD)">
              Fator alvo
            </label>
            <Input
              type="number" min="0.1" step="0.1" className="w-20 h-8 text-center font-bold"
              value={fator}
              onChange={(e) => setFator(e.target.value)}
            />
            <span className="text-sm font-bold text-violet-500">×</span>
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
                  {resultA.fatorReal !== null && (
                    <div className="border-t pt-2 flex justify-between items-baseline">
                      <span className="text-xs text-muted-foreground">Fator real (Venda R$ ÷ Compra USD)</span>
                      <span className={cn("font-bold", resultA.fatorReal >= fatorNum ? "text-emerald-500" : "text-red-500")}>
                        {resultA.fatorReal.toFixed(2)}×
                      </span>
                    </div>
                  )}
                  {resultA.compraPorFator !== null && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-muted-foreground">Compra p/ fator {fatorNum}× (USD/un)</span>
                      <span className="font-semibold text-blue-500">$ {resultA.compraPorFator.toFixed(2)}</span>
                    </div>
                  )}
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
                  {resultB.fatorReal !== null && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-muted-foreground">Fator real (Venda R$ ÷ Compra USD)</span>
                      <span className={cn("font-bold", resultB.fatorReal >= fatorNum ? "text-emerald-500" : "text-red-500")}>
                        {resultB.fatorReal.toFixed(2)}×
                      </span>
                    </div>
                  )}
                  {resultB.vendaPorFator !== null && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-muted-foreground">Venda p/ fator {fatorNum}× (R$/un)</span>
                      <span className="font-semibold text-emerald-500">
                        {resultB.vendaPorFator.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  )}
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
          <div className="p-5 pb-0 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
              <FileText className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Cotação por Produto</h2>
              <p className="text-xs text-muted-foreground">
                Análise de margem ou gere um formulário formal de cotação para o cliente
              </p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-border/60 mt-4 px-5">
            <button
              onClick={() => setQuoteTab("margem")}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                quoteTab === "margem"
                  ? "border-violet-500 text-violet-600 dark:text-violet-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calculator className="h-3.5 w-3.5" />
              Análise de Margem
            </button>
            <button
              onClick={() => setQuoteTab("formulario")}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                quoteTab === "formulario"
                  ? "border-violet-500 text-violet-600 dark:text-violet-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Formulário de Cotação
              {formalItems.length > 0 && (
                <span className="ml-1 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                  {formalItems.length}
                </span>
              )}
            </button>
          </div>

          {quoteTab === "margem" && (
          <div className="px-5 pb-5 pt-4 space-y-4">
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
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold">{item.descricao || item.codigo}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {item.codigo && (
                              <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                {item.codigo}
                              </span>
                            )}
                            {item.categorias.length > 0 && (
                              <span className="text-[10px] text-muted-foreground opacity-70">
                                {item.categorias.join(" · ")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {item.preco_compra != null && (
                              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                Compra: $ {item.preco_compra.toFixed(2)}
                              </span>
                            )}
                            {item.preco_venda != null && (
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                Venda: R$ {item.preco_venda.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )}
                            {item.fornecedores.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {item.fornecedores.slice(0, 2).join(", ")}
                                {item.fornecedores.length > 2 && ` +${item.fornecedores.length - 2}`}
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
                <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                  <Folder className="h-3 w-3 text-amber-500" /> Pasta da Cotação
                  <span className="text-[10px] opacity-60">(ex: Cotação 01 - CL90ST)</span>
                </label>
                <Input
                  placeholder="Nome da pasta para agrupar esta cotação"
                  list="pastas-cotacoes"
                  value={cotacaoForm.pasta}
                  onChange={(e) => setCotacaoForm((f) => ({ ...f, pasta: e.target.value }))}
                />
                <datalist id="pastas-cotacoes">
                  {pastasExistentes.map((p) => <option key={p} value={p} />)}
                </datalist>
              </div>
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
                    <span className="ml-1 text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                      ← ref: $ {selectedProduct.preco_compra.toFixed(2)}
                    </span>
                  )}
                </label>
                <Input
                  type="number" min="0" step="0.01"
                  placeholder="0.00"
                  value={cotacaoForm.precoCompraUSD}
                  onChange={(e) => setCotacaoForm((f) => ({ ...f, precoCompraUSD: e.target.value }))}
                  className={cn(cotacaoForm.precoCompraUSD && "border-blue-500/50 focus:border-blue-500")}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Preço Venda (R$/un)
                  {selectedProduct?.preco_venda != null && (
                    <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      ← ref: R$ {selectedProduct.preco_venda.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                  {selectedProduct?.preco_venda == null && (
                    <span className="ml-1 text-[10px] opacity-50">opcional</span>
                  )}
                </label>
                <Input
                  type="number" min="0" step="0.01"
                  placeholder="0,00"
                  value={cotacaoForm.precoVendaBRL}
                  onChange={(e) => setCotacaoForm((f) => ({ ...f, precoVendaBRL: e.target.value }))}
                  className={cn(cotacaoForm.precoVendaBRL && "border-emerald-500/50 focus:border-emerald-500")}
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

            {/* ── Result + actions ── */}
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
                    {cotacaoCalc.fatorReal !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fator real (Venda R$ ÷ Compra USD)</span>
                        <span className={cn("font-bold", cotacaoCalc.fatorReal >= fatorNum ? "text-emerald-500" : "text-red-500")}>
                          {cotacaoCalc.fatorReal.toFixed(2)}×
                        </span>
                      </div>
                    )}
                    {cotacaoCalc.vendaPorFator !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Venda p/ fator {fatorNum}× (R$/un)</span>
                        <span className="font-semibold text-violet-600 dark:text-violet-400">
                          {cotacaoCalc.vendaPorFator.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                    )}
                    {cotacaoCalc.compraPorFator !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Compra p/ fator {fatorNum}× (USD/un)</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          $ {cotacaoCalc.compraPorFator.toFixed(2)}
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
                  disabled={(!cotacaoForm.produto && !cotacaoForm.codigo) || !authReady}
                >
                  <BookmarkPlus className="h-4 w-4" />
                  Salvar Cotação
                </Button>
                <div className="flex gap-1">
                  <Button
                    variant="outline" size="sm" className="flex-1 h-7 text-[11px] gap-1"
                    disabled={!cotacaoCalc}
                    onClick={() => {
                      const calc = cotacaoCalc!;
                      const item: CotacaoSalva = {
                        id: "preview", criadoEm: new Date().toISOString(),
                        pasta: cotacaoForm.pasta || "Cotação atual",
                        produto: cotacaoForm.produto, codigo: cotacaoForm.codigo,
                        fornecedor: cotacaoForm.fornecedor,
                        precoCompraUSD: Number(cotacaoForm.precoCompraUSD) || null,
                        precoVendaBRL: Number(cotacaoForm.precoVendaBRL) || null,
                        qtd: Number(cotacaoForm.qtd) || 1,
                        freteUSD: Number(cotacaoForm.freteUSD) || 0,
                        impostoPct: Number(cotacaoForm.impostoPct) || 0,
                        cambio: Number(cotacaoForm.cambio) || 5.20,
                        custoUnitBRL: calc.custoUnitBRL, vendaMinBRL: calc.vendaMinBRL,
                        margemReal: calc.margemReal, margem: margemNum,
                        observacao: cotacaoForm.observacao,
                      };
                      exportCotacoesXLSX([item], sanitizeFilename(cotacaoForm.pasta || cotacaoForm.codigo || cotacaoForm.produto || "cotacao"));
                    }}
                  >
                    <FileSpreadsheet className="h-3 w-3 text-emerald-600" /> XLSX
                  </Button>
                  <Button
                    variant="outline" size="sm" className="flex-1 h-7 text-[11px] gap-1"
                    disabled={!cotacaoCalc}
                    onClick={() => {
                      const calc = cotacaoCalc!;
                      const item: CotacaoSalva = {
                        id: "preview", criadoEm: new Date().toISOString(),
                        pasta: cotacaoForm.pasta || "Cotação atual",
                        produto: cotacaoForm.produto, codigo: cotacaoForm.codigo,
                        fornecedor: cotacaoForm.fornecedor,
                        precoCompraUSD: Number(cotacaoForm.precoCompraUSD) || null,
                        precoVendaBRL: Number(cotacaoForm.precoVendaBRL) || null,
                        qtd: Number(cotacaoForm.qtd) || 1,
                        freteUSD: Number(cotacaoForm.freteUSD) || 0,
                        impostoPct: Number(cotacaoForm.impostoPct) || 0,
                        cambio: Number(cotacaoForm.cambio) || 5.20,
                        custoUnitBRL: calc.custoUnitBRL, vendaMinBRL: calc.vendaMinBRL,
                        margemReal: calc.margemReal, margem: margemNum,
                        observacao: cotacaoForm.observacao,
                      };
                      exportCotacoesPDF([item], sanitizeFilename(cotacaoForm.pasta || cotacaoForm.codigo || cotacaoForm.produto || "cotacao"), `Cotação: ${cotacaoForm.produto || cotacaoForm.codigo || "(sem nome)"}`);
                    }}
                  >
                    <FileDown className="h-3 w-3 text-red-600" /> PDF
                  </Button>
                </div>
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
          )} {/* end quoteTab === "margem" */}

          {/* ── Formulário de Cotação Formal ────────────────────────── */}
          {quoteTab === "formulario" && (
          <div className="px-5 pb-5 pt-4 space-y-5">

            {/* Header info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block font-medium">Cliente</label>
                <Input
                  placeholder="Nome do cliente"
                  value={formalForm.cliente}
                  onChange={(e) => setFormalForm((f) => ({ ...f, cliente: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block font-medium">Nº / Referência da Cotação</label>
                <Input
                  placeholder="Ex: COT-2025-001"
                  value={formalForm.referencia}
                  onChange={(e) => setFormalForm((f) => ({ ...f, referencia: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block font-medium">Câmbio (R$/USD)</label>
                <Input
                  type="number" min="0" step="0.01" placeholder="5.20"
                  value={formalForm.cambio}
                  onChange={(e) => setFormalForm((f) => ({ ...f, cambio: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block font-medium">Data</label>
                <Input
                  type="date"
                  value={formalForm.data}
                  onChange={(e) => setFormalForm((f) => ({ ...f, data: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block font-medium">Validade até</label>
                <Input
                  type="date"
                  value={formalForm.validade}
                  onChange={(e) => setFormalForm((f) => ({ ...f, validade: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block font-medium">Condições de Pagamento</label>
                <Input
                  placeholder="Ex: 30/60/90 dias"
                  value={formalForm.condicoesPagamento}
                  onChange={(e) => setFormalForm((f) => ({ ...f, condicoesPagamento: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block font-medium">Prazo de Entrega</label>
                <Input
                  placeholder="Ex: 45 dias úteis"
                  value={formalForm.prazoEntrega}
                  onChange={(e) => setFormalForm((f) => ({ ...f, prazoEntrega: e.target.value }))}
                />
              </div>
            </div>

            {/* Add product row */}
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                Adicionar Item
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-2" ref={formalSearchRef}>
                  <label className="text-xs text-muted-foreground mb-1 block">Descrição / Código</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Pesquise no catálogo..."
                      className="pl-8"
                      value={formalItemSearch}
                      onChange={(e) => {
                        setFormalItemSearch(e.target.value);
                        setFormalAddItem((f) => ({ ...f, descricao: e.target.value }));
                        setFormalShowDropdown(true);
                      }}
                      onFocus={() => formalItemSearch.trim().length >= 2 && setFormalShowDropdown(true)}
                    />
                    {formalShowDropdown && formalItemSearch.trim().length >= 2 && (
                      <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl">
                        {formalLoading && <div className="px-3 py-2 text-xs text-muted-foreground">Buscando...</div>}
                        {!formalLoading && formalResults.length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum item encontrado — preencha manualmente.</div>
                        )}
                        {formalResults.map((item) => (
                          <button
                            key={item.id} type="button"
                            className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-0 transition-colors"
                            onMouseDown={() => {
                              const desc = item.codigo ? `${item.codigo} - ${item.descricao}` : item.descricao;
                              setFormalItemSearch(desc);
                              setFormalAddItem((f) => ({
                                ...f,
                                codigo: item.codigo,
                                descricao: item.descricao,
                                precoUSD: item.preco_compra != null ? String(item.preco_compra) : f.precoUSD,
                              }));
                              setFormalShowDropdown(false);
                            }}
                          >
                            <p className="text-xs font-semibold truncate">{item.descricao || item.codigo}</p>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                              {item.codigo && <span className="font-mono bg-primary/10 text-primary px-1 rounded">{item.codigo}</span>}
                              {item.preco_compra != null && <span className="text-blue-600 dark:text-blue-400">$ {item.preco_compra.toFixed(2)}</span>}
                              {item.fornecedores[0] && <span>• {item.fornecedores[0]}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Código</label>
                  <Input
                    placeholder="Ex: CL90ST004"
                    value={formalAddItem.codigo}
                    onChange={(e) => setFormalAddItem((f) => ({ ...f, codigo: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Un.</label>
                  <Input
                    placeholder="UN"
                    value={formalAddItem.unidade}
                    onChange={(e) => setFormalAddItem((f) => ({ ...f, unidade: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Qtd</label>
                  <Input
                    type="number" min="1" placeholder="1"
                    value={formalAddItem.qtd}
                    onChange={(e) => setFormalAddItem((f) => ({ ...f, qtd: e.target.value }))}
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Preço Unit. (USD)</label>
                  <Input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={formalAddItem.precoUSD}
                    onChange={(e) => setFormalAddItem((f) => ({ ...f, precoUSD: e.target.value }))}
                  />
                </div>
                <div className="flex items-end lg:col-span-3">
                  <Button
                    className="gap-1 bg-violet-600 hover:bg-violet-700 text-white"
                    disabled={!formalAddItem.descricao || !formalAddItem.precoUSD}
                    onClick={() => {
                      const qtd   = Number(formalAddItem.qtd)     || 1;
                      const preco = Number(formalAddItem.precoUSD) || 0;
                      if (!formalAddItem.descricao || preco <= 0) return;
                      setFormalItems((prev) => ([
                        ...prev,
                        {
                          id: Date.now().toString(),
                          codigo:    formalAddItem.codigo,
                          descricao: formalAddItem.descricao,
                          unidade:   formalAddItem.unidade || "UN",
                          qtd,
                          precoUSD:  preco,
                        },
                      ]));
                      setFormalAddItem({ codigo: "", descricao: "", unidade: "UN", qtd: "1", precoUSD: "" });
                      setFormalItemSearch("");
                    }}
                  >
                    <Plus className="h-4 w-4" /> Adicionar Item
                  </Button>
                </div>
              </div>
            </div>

            {/* Items table */}
            {formalItems.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      {["#", "Código", "Descrição", "Un.", "Qtd", "Unit. (USD)", "Total (USD)", "Total (R$)", ""].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {formalItems.map((item, idx) => {
                      const cambioNum = Number(formalForm.cambio) || 5.20;
                      return (
                        <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2 text-center text-muted-foreground">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono">{item.codigo || "—"}</td>
                          <td className="px-3 py-2 font-medium max-w-[200px]">{item.descricao}</td>
                          <td className="px-3 py-2 text-center">{item.unidade}</td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number" min="1"
                              value={item.qtd}
                              onChange={(e) => {
                                const v = Math.max(1, Number(e.target.value) || 1);
                                setFormalItems((prev) => prev.map((i) => i.id === item.id ? { ...i, qtd: v } : i));
                              }}
                              className="w-14 h-6 text-xs text-center rounded border border-input bg-background px-1 font-mono"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono">
                            <input
                              type="number" min="0" step="0.01"
                              value={item.precoUSD}
                              onChange={(e) => {
                                const v = Number(e.target.value) || 0;
                                setFormalItems((prev) => prev.map((i) => i.id === item.id ? { ...i, precoUSD: v } : i));
                              }}
                              className="w-20 h-6 text-xs text-right rounded border border-input bg-background px-1 font-mono"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono font-semibold">$ {(item.precoUSD * item.qtd).toFixed(2)}</td>
                          <td className="px-3 py-2 font-mono text-emerald-600 dark:text-emerald-400">
                            {(item.precoUSD * item.qtd * cambioNum).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                          <td className="px-3 py-2">
                            <Button size="sm" variant="ghost" onClick={() => setFormalItems((prev) => prev.filter((i) => i.id !== item.id))}>
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const cambioNum = Number(formalForm.cambio) || 5.20;
                      const totalUSD = formalItems.reduce((s, i) => s + i.precoUSD * i.qtd, 0);
                      const totalBRL = totalUSD * cambioNum;
                      return (
                        <tr className="bg-violet-500/10 font-semibold text-xs border-t">
                          <td colSpan={6} className="px-3 py-2 text-right text-muted-foreground">Total</td>
                          <td className="px-3 py-2 font-mono font-bold text-primary">$ {totalUSD.toFixed(2)}</td>
                          <td className="px-3 py-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {totalBRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                          <td />
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-violet-500/30 p-8 text-center">
                <Package className="h-8 w-8 mx-auto mb-2 text-violet-300" />
                <p className="text-sm text-muted-foreground">Nenhum item adicionado ainda</p>
                <p className="text-xs text-muted-foreground mt-1">Use o campo acima para buscar produtos no catálogo ou inserir manualmente</p>
              </div>
            )}

            {/* Observations */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block font-medium">Observações</label>
              <textarea
                rows={3}
                placeholder="Notas adicionais, termos de garantia, etc..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                value={formalForm.observacoes}
                onChange={(e) => setFormalForm((f) => ({ ...f, observacoes: e.target.value }))}
              />
            </div>

            {/* Export actions */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                disabled={formalItems.length === 0}
                onClick={() => exportFormalQuotePDF(formalForm, formalItems)}
              >
                <FileDown className="h-4 w-4" />
                Exportar PDF
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={formalItems.length === 0}
                onClick={() => exportFormalQuoteXLSX(formalForm, formalItems)}
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Exportar Excel
              </Button>
              <Button
                variant="ghost" size="sm"
                className="text-xs text-muted-foreground gap-1 ml-auto"
                onClick={() => {
                  setFormalForm(FORMAL_QUOTE_EMPTY);
                  setFormalItems([]);
                  setFormalItemSearch("");
                  setFormalAddItem({ codigo: "", descricao: "", unidade: "UN", qtd: "1", precoUSD: "" });
                }}
              >
                <X className="h-3 w-3" /> Limpar tudo
              </Button>
            </div>
          </div>
          )} {/* end quoteTab === "formulario" */}

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
                <>
                  <div className="flex items-center justify-end gap-2 mb-3 flex-wrap">
                    <Button
                      size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => exportCotacoesXLSX(cotacoes, `cotacoes_${sanitizeFilename(displayName)}_${new Date().toISOString().slice(0,10)}`)}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Exportar tudo (XLSX)
                    </Button>
                    <Button
                      size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => exportCotacoesPDF(cotacoes, `cotacoes_${sanitizeFilename(displayName)}_${new Date().toISOString().slice(0,10)}`, `Todas as Cotações — ${displayName}`)}
                    >
                      <FileDown className="h-3.5 w-3.5 text-red-600" /> Exportar tudo (PDF)
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {cotacoesPorPasta.map(([pasta, lista]) => {
                      const aberta = pastasAbertas[pasta] ?? true;
                      return (
                        <div key={pasta} className="rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden">
                          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-500/10 flex-wrap">
                            <button
                              className="flex items-center gap-2 text-left flex-1 min-w-0"
                              onClick={() => togglePasta(pasta)}
                            >
                              {aberta ? <FolderOpen className="h-4 w-4 text-amber-600 shrink-0" /> : <Folder className="h-4 w-4 text-amber-600 shrink-0" />}
                              <span className="text-sm font-semibold truncate">{pasta}</span>
                              <Badge variant="outline" className="text-[10px] border-amber-500/40">{lista.length}</Badge>
                            </button>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1"
                                onClick={() => exportCotacoesXLSX(lista, sanitizeFilename(pasta))}
                                title="Baixar pasta em Excel"
                              >
                                <FileSpreadsheet className="h-3 w-3 text-emerald-600" /> XLSX
                              </Button>
                              <Button
                                size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1"
                                onClick={() => exportCotacoesPDF(lista, sanitizeFilename(pasta), `Pasta: ${pasta}`)}
                                title="Baixar pasta em PDF"
                              >
                                <FileDown className="h-3 w-3 text-red-600" /> PDF
                              </Button>
                            </div>
                          </div>

                          {aberta && (
                            <div className="p-2 space-y-2">
                              {lista.map((c) => (
                                <div key={c.id} className="flex items-start gap-3 rounded-lg border border-border/40 p-3 bg-card hover:bg-muted/20 transition-colors">
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
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                      <Button
                                        size="sm" variant="outline" className="h-6 text-[10px] px-2"
                                        onClick={() => handleApplyCotacao(c)}
                                      >
                                        Carregar
                                      </Button>
                                      <Button
                                        size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1"
                                        onClick={() => exportCotacoesXLSX([c], sanitizeFilename(`${c.codigo || c.produto}_${c.id}`))}
                                      >
                                        <Download className="h-3 w-3" /> XLSX
                                      </Button>
                                      <Button
                                        size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1"
                                        onClick={() => exportCotacoesPDF([c], sanitizeFilename(`${c.codigo || c.produto}_${c.id}`), `Cotação: ${c.produto || c.codigo}`)}
                                      >
                                        <Download className="h-3 w-3" /> PDF
                                      </Button>
                                      <Button
                                        size="sm" variant="ghost"
                                        className="h-6 text-[10px] px-2 text-muted-foreground"
                                        onClick={() => {
                                          if (c.precoCompraUSD != null) {
                                            saveItems([...vendaItems, {
                                              id: Date.now().toString(),
                                              descricao: c.codigo ? `${c.codigo} - ${c.produto}` : c.produto,
                                              fornecedor: c.fornecedor ?? "",
                                              unidade: "UN",
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
                      );
                    })}
                  </div>
                </>
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
                  <div ref={vendaSearchRef} className="relative">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Pesquise por código ou descrição..."
                        value={vendaSearch}
                        className="pl-8"
                        onChange={(e) => {
                          const v = e.target.value;
                          setVendaSearch(v);
                          setVendaForm((f) => ({ ...f, descricao: v }));
                          setVendaShowDropdown(true);
                        }}
                        onFocus={() => setVendaShowDropdown(true)}
                        onKeyDown={(e) => e.key === "Enter" && addItem()}
                      />
                    </div>
                    {vendaShowDropdown && vendaSearch.trim().length >= 2 && (
                      <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                        {vendaLoading && (
                          <div className="px-3 py-2 text-xs text-muted-foreground">Buscando...</div>
                        )}
                        {!vendaLoading && vendaResults.length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum item encontrado.</div>
                        )}
                        {vendaResults.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectVendaProduct(item)}
                            className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-0 transition-colors"
                          >
                            <p className="text-xs font-semibold truncate">{item.descricao || item.codigo}</p>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                              {item.codigo && <span className="font-mono">{item.codigo}</span>}
                              {item.preco_compra != null && (
                                <span className="text-primary">USD {item.preco_compra.toFixed(2)}</span>
                              )}
                              {item.fornecedores[0] && <span className="truncate">• {item.fornecedores[0]}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Fornecedor</label>
                  <Input placeholder="Nome do fornecedor" value={vendaForm.fornecedor}
                    onChange={(e) => setVendaForm((f) => ({ ...f, fornecedor: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Unidade</label>
                  <Input placeholder="UN" value={vendaForm.unidade}
                    onChange={(e) => setVendaForm((f) => ({ ...f, unidade: e.target.value }))} />
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
                        <td className="px-3 py-2 font-medium">
                          <div>{item.descricao}</div>
                          {item.fornecedor && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">{item.fornecedor}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">{c.qtd}{item.unidade ? ` ${item.unidade}` : ""}</td>
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
