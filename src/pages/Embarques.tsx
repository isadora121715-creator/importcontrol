import { useEffect, useMemo, useState } from "react";
import {
  Ship,
  Package,
  Truck,
  DollarSign,
  Calculator,
  AlertTriangle,
  Upload,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  DownloadCloud,
  ChevronDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import { HeaderTabs } from "@/components/HeaderTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STORAGE_FCL_KEY = "embarques.fretes_fcl.v2";
const STORAGE_INTL_KEY = "embarques.fretes_internacionais.v3";

// ---------------------------------------------------------------------------
// CONTAINERS
// ---------------------------------------------------------------------------
type ContainerInfo = {
  id: string;
  nome: string;
  descricao: string;
  tipo: string;
  dimensoes: string;
  capacidade: string;
  pesoMax: string;
  tempo: string;
  valor: string;
};

const CONTAINERS: ContainerInfo[] = [
  {
    id: "20ft",
    nome: "Container 20ft FCL",
    descricao: "Full Container Load - Ideal para médios volumes",
    tipo: "FCL",
    dimensoes: "5,90m x 2,35m x 2,38m",
    capacidade: "33 m³",
    pesoMax: "18 toneladas",
    tempo: "40-50 dias",
    valor: "US$ 1.200 - US$ 1.800",
  },
  {
    id: "40ft",
    nome: "Container 40ft FCL",
    descricao: "Full Container Load - Capacidade padrão",
    tipo: "FCL",
    dimensoes: "12,19m x 2,35m x 2,38m",
    capacidade: "67 m³",
    pesoMax: "28 toneladas",
    tempo: "40-50 dias",
    valor: "US$ 2.000 - US$ 3.000",
  },
  {
    id: "45ft",
    nome: "Container 45ft High Cube",
    descricao: "Full Container Load High Cube - Máxima capacidade com altura extra",
    tipo: "FCL",
    dimensoes: "13,71m x 2,35m x 2,70m",
    capacidade: "76 m³",
    pesoMax: "30 toneladas",
    tempo: "40-50 dias",
    valor: "US$ 2.500 - US$ 3.500",
  },
  {
    id: "lcl",
    nome: "LCL (Less than Container Load)",
    descricao: "Consolidação de carga - Compartilhado com outros clientes",
    tipo: "LCL",
    dimensoes: "Variável",
    capacidade: "Até 18-25 m³",
    pesoMax: "Até 15 toneladas",
    tempo: "35-45 dias",
    valor: "US$ 400 - US$ 600 / m³",
  },
  {
    id: "aereo",
    nome: "Transporte Aéreo",
    descricao: "Express - Entrega rápida, maior custo",
    tipo: "Aéreo",
    dimensoes: "Variável",
    capacidade: "Conforme necessário",
    pesoMax: "Conforme necessário",
    tempo: "5-10 dias",
    valor: "US$ 3.50 - US$ 8.00 / kg",
  },
];

// ---------------------------------------------------------------------------
// EMBALAGEM
// ---------------------------------------------------------------------------
const EMBALAGEM_GROUPS = [
  {
    titulo: "Embalagem de Tubos",
    instrucoes: [
      "Empacotar tubos em caixas de madeira resistente",
      "Agrupar tubos por diâmetro e comprimento dentro das caixas",
      "Preencher espaços vazios com papel kraft ou espuma",
      "Fixar as caixas de madeira com cintas de aço ou poliéster de 2 polegadas",
      "Identificar claramente cada caixa com código de rastreamento",
      "Máximo peso por caixa: 1.000 kg",
      "Colocar as caixas em paletes de madeira resistente (EUR-pallete)",
      "Proteger cantos com cantoneiras de papelão",
    ],
    cuidados: [
      "Evitar umidade durante o transporte",
      "Proteger contra danos mecânicos",
      "Caixas de madeira devem estar bem fechadas",
      "Utilizar dessecantes nos containers",
    ],
  },
  {
    titulo: "Embalagem de Válvulas",
    instrucoes: [
      "Empacotar válvulas individuais em caixas de papelão resistente",
      "Utilizar papel kraft ou espuma como material de amortecimento",
      "Colocar dessecantes dentro de cada caixa",
      "Agrupar caixas em paletes com no máximo 800 kg",
      "Envolver palet com filme plástico",
      "Fixar com fitas de poliéster",
      "Identificar o tipo de válvula na embalagem",
      "Indicar orientação correta ('THIS SIDE UP')",
    ],
    cuidados: [
      "Válvulas frágeis - manipular com cuidado",
      "Manter temperatura controlada",
      "Proteger de umidade e corrosão",
      "Verificar vedações antes do embarque",
    ],
  },
  {
    titulo: "Embalagem de Conexões",
    instrucoes: [
      "Empacotar conexões em caixas de madeira ou papelão resistente",
      "Separar por tamanho e tipo de conexão",
      "Usar papel bolha ou espuma para proteção",
      "Máximo 500 kg por caixa",
      "Agrupar caixas em paletes (máximo 800 kg)",
      "Utilizar paletes de madeira clara (não reciclada)",
      "Envolver com filme stretch resistente",
      "Fixar com cintas de poliéster duplas",
    ],
    cuidados: [
      "Proteger contra impactos durante o transporte",
      "Verificar acabamentos antes de empacotar",
      "Evitar pressão excessiva nas caixas",
      "Manter registro de quantidade por palet",
    ],
  },
];

const RECOMENDACOES_LCL = [
  {
    label: "Para Tubos em LCL:",
    text: "Empacotar em caixas de madeira resistente. Os tubos devem ser agrupados por diâmetro e comprimento. Máximo 1.000 kg por caixa. Fixar com cintas de aço ou poliéster. Proteger com cantoneiras de papelão.",
  },
  {
    label: "Para Válvulas em LCL:",
    text: 'Sempre empacotar em caixas individuais dentro de cartons maiores. Colocar dessecantes em cada palet. Indicar claramente "FRÁGIL" na embalagem.',
  },
  {
    label: "Para Conexões em LCL:",
    text: "Empacotar em caixas de madeira ou papelão resistente. Máximo 500 kg por caixa para facilitar manipulação. Agrupar em paletes de no máximo 800 kg.",
  },
];

// ---------------------------------------------------------------------------
// FRETES
// ---------------------------------------------------------------------------
const FRETES_LCL = [
  { rota: "Shangai → Porto de Santos (SP)", valor: "US$ 400-600 por m³", obs: "Rota principal de importação da Ásia", tempo: "35-45 dias" },
  { rota: "Shangai → Porto de Itajaí (SC)", valor: "US$ 420-620 por m³", obs: "Importação com entrega em Santa Catarina", tempo: "36-46 dias" },
  { rota: "Shangai → Porto de Navegantes (SC)", valor: "US$ 430-630 por m³", obs: "Alternativa para Santa Catarina", tempo: "37-47 dias" },
  { rota: "Roterdã → Porto de Santos (SP)", valor: "US$ 350-500 por m³", obs: "Importação da Europa", tempo: "40-50 dias" },
  { rota: "Shangai → Porto de Suape (PE)", valor: "US$ 450-650 por m³", obs: "Importação com entrega em Pernambuco", tempo: "38-48 dias" },
  { rota: "Miami → Porto de Santos (SP)", valor: "US$ 300-450 por m³", obs: "Importação rápida dos EUA", tempo: "8-12 dias" },
];

type FreteFCL = { rota: string; valor: string; capacidade: string; tempo: string; tipo: "20ft" | "40ft" | "45ft HC" };

const FRETES_FCL_DEFAULT: FreteFCL[] = [
  // 20ft
  { rota: "Shangai → Santos", valor: "US$ 1.200-1.800", capacidade: "18-20 toneladas", tempo: "40-50 dias", tipo: "20ft" },
  { rota: "Shangai → Itajaí/Navegantes", valor: "US$ 1.250-1.850", capacidade: "18-20 toneladas", tempo: "41-51 dias", tipo: "20ft" },
  { rota: "Shangai → Suape", valor: "US$ 1.300-1.900", capacidade: "18-20 toneladas", tempo: "42-52 dias", tipo: "20ft" },
  { rota: "Roterdã → Santos", valor: "US$ 1.000-1.500", capacidade: "18-20 toneladas", tempo: "45-55 dias", tipo: "20ft" },
  { rota: "Miami → Santos", valor: "US$ 800-1.200", capacidade: "18-20 toneladas", tempo: "8-12 dias", tipo: "20ft" },
  { rota: "Miami → Suape", valor: "US$ 850-1.250", capacidade: "18-20 toneladas", tempo: "10-14 dias", tipo: "20ft" },
  // 40ft
  { rota: "Shangai → Santos", valor: "US$ 2.000-3.000", capacidade: "26-28 toneladas", tempo: "40-50 dias", tipo: "40ft" },
  { rota: "Shangai → Itajaí/Navegantes", valor: "US$ 2.100-3.100", capacidade: "26-28 toneladas", tempo: "41-51 dias", tipo: "40ft" },
  { rota: "Shangai → Suape", valor: "US$ 2.200-3.200", capacidade: "26-28 toneladas", tempo: "42-52 dias", tipo: "40ft" },
  { rota: "Roterdã → Santos", valor: "US$ 1.700-2.500", capacidade: "26-28 toneladas", tempo: "45-55 dias", tipo: "40ft" },
  { rota: "Miami → Santos", valor: "US$ 1.400-2.000", capacidade: "26-28 toneladas", tempo: "8-12 dias", tipo: "40ft" },
  { rota: "Miami → Suape", valor: "US$ 1.500-2.100", capacidade: "26-28 toneladas", tempo: "10-14 dias", tipo: "40ft" },
  // 45ft HC
  { rota: "Shangai → Santos", valor: "US$ 2.500-3.500", capacidade: "28-30 toneladas", tempo: "40-50 dias", tipo: "45ft HC" },
  { rota: "Shangai → Itajaí/Navegantes", valor: "US$ 2.600-3.600", capacidade: "28-30 toneladas", tempo: "41-51 dias", tipo: "45ft HC" },
  { rota: "Roterdã → Santos", valor: "US$ 2.200-3.000", capacidade: "28-30 toneladas", tempo: "45-55 dias", tipo: "45ft HC" },
  { rota: "Miami → Santos", valor: "US$ 1.800-2.500", capacidade: "28-30 toneladas", tempo: "8-12 dias", tipo: "45ft HC" },
];

type FreteIntl = Record<string, string | number>;

const ROTAS_AEREAS = [
  "Xangai (PVG) → São Paulo (GRU): 5-7 dias",
  "Frankfurt (FRA) → São Paulo (GRU): 8-10 dias",
  "Miami (MIA) → São Paulo (GRU): 3-5 dias",
];

// ---------------------------------------------------------------------------
// COMPONENTE
// ---------------------------------------------------------------------------
const Embarques = () => {
  const { toast } = useToast();
  const [selectedContainer, setSelectedContainer] = useState<string>("20ft");

  // Fretes FCL — agora apenas exibição filtrada por tipo de container
  const [fretesFcl] = useState<FreteFCL[]>(FRETES_FCL_DEFAULT);
  const [selectedFclTipo, setSelectedFclTipo] = useState<"20ft" | "40ft" | "45ft HC">("20ft");
  const fretesFclFiltrados = useMemo(
    () => fretesFcl.filter((f) => f.tipo === selectedFclTipo),
    [fretesFcl, selectedFclTipo],
  );

  // Internacionais (planilha persistida)
  const [intlRows, setIntlRows] = useState<FreteIntl[]>([]);
  const [intlColumns, setIntlColumns] = useState<string[]>([]);
  const [intlSubHeaders, setIntlSubHeaders] = useState<string[]>([]);
  const [intlFileName, setIntlFileName] = useState<string>("");
  const [intlUploadedAt, setIntlUploadedAt] = useState<string>("");
  const [intlTotals, setIntlTotals] = useState<{
    cont20: number;
    cont40: number;
    cont45: number;
    aereo: number;
  }>({ cont20: 0, cont40: 0, cont45: 0, aereo: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_INTL_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        rows: FreteIntl[];
        columns: string[];
        subHeaders?: string[];
        fileName: string;
        uploadedAt: string;
        totals?: { cont20: number; cont40: number; cont45: number; aereo: number };
      };
      setIntlRows(saved.rows ?? []);
      setIntlColumns(saved.columns ?? []);
      setIntlSubHeaders(saved.subHeaders ?? []);
      setIntlFileName(saved.fileName ?? "");
      setIntlUploadedAt(saved.uploadedAt ?? "");
      if (saved.totals) setIntlTotals(saved.totals);
    } catch {
      /* ignore */
    }
  }, []);

  const handleIntlUpload = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];

      // Lê tudo como matriz para acessar células fixas (subcabeçalho + linha de totais)
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
        blankrows: false,
      });
      if (matrix.length < 2) throw new Error("Planilha vazia ou sem cabeçalho");

      const headers = (matrix[0] as unknown[]).map((h, i) =>
        h ? String(h).trim() : `Col${i + 1}`,
      );

      // Identifica a linha de totais (linha 365 da planilha = índice 364).
      // Como filtramos blankrows, procuramos a primeira linha cujo D == "-" e G/H/I numéricos.
      const totalsIdx = matrix.findIndex((row, idx) => {
        if (idx === 0) return false;
        const r = row as unknown[];
        const d = r[3];
        const g = Number(r[6]);
        const h = Number(r[7]);
        const i = Number(r[8]);
        return d === "-" && (!isNaN(g) || !isNaN(h) || !isNaN(i)) && (g + h + i) > 0;
      });

      let cont20 = 0, cont40 = 0, cont45 = 0;
      if (totalsIdx > 0) {
        const r = matrix[totalsIdx] as unknown[];
        cont20 = Number(r[6]) || 0;
        cont40 = Number(r[7]) || 0;
        cont45 = Number(r[8]) || 0;
      }

      // Coluna E (índice 4) = MODALIDADE — conta pedidos aéreos, ignorando totais
      let aereo = 0;
      const dataRows: FreteIntl[] = [];
      let capturedSubRow: string[] = [];
      matrix.forEach((row, idx) => {
        if (idx === 0) return; // header
        if (idx === totalsIdx) return; // pular linha de totais
        const r = row as unknown[];
        // Linha do subcabeçalho ("20'", "40'"...) — capturar e pular
        const isSubHeader =
          r[6] === "20'" || r[6] === '20"' || (typeof r[6] === "string" && /^20['"]/.test(String(r[6])));
        if (isSubHeader) {
          capturedSubRow = (r as unknown[]).map((v) => (v !== null && v !== undefined && v !== "" ? String(v).trim() : ""));
          return;
        }
        // Linha vazia significativa
        const hasData = r.some((v) => v !== "" && v !== null && v !== undefined);
        if (!hasData) return;

        const mod = String(r[4] ?? "").trim().toUpperCase();
        if (mod === "AÉREO" || mod === "AEREO" || mod === "AIR") aereo += 1;

        const obj: FreteIntl = {};
        headers.forEach((h, i) => {
          const v = r[i];
          if (v !== undefined && v !== null && v !== "") obj[h] = v as string | number;
        });
        if (Object.keys(obj).length > 0) dataRows.push(obj);
      });

      const subHeaders = headers.map((_, i) => capturedSubRow[i] ?? "");
      const totals = { cont20, cont40, cont45, aereo };
      const uploadedAt = new Date().toISOString();
      setIntlRows(dataRows);
      setIntlColumns(headers);
      setIntlSubHeaders(subHeaders);
      setIntlFileName(file.name);
      setIntlUploadedAt(uploadedAt);
      setIntlTotals(totals);
      window.localStorage.setItem(
        STORAGE_INTL_KEY,
        JSON.stringify({
          rows: dataRows,
          columns: headers,
          subHeaders,
          fileName: file.name,
          uploadedAt,
          totals,
        }),
      );
      toast({
        title: "Planilha carregada",
        description: `${dataRows.length} registros importados de ${file.name}.`,
      });
    } catch (err) {
      toast({
        title: "Erro ao carregar planilha",
        description: err instanceof Error ? err.message : "Formato inválido",
        variant: "destructive",
      });
    }
  };

  const clearIntl = () => {
    setIntlRows([]);
    setIntlColumns([]);
    setIntlSubHeaders([]);
    setIntlFileName("");
    setIntlUploadedAt("");
    setIntlTotals({ cont20: 0, cont40: 0, cont45: 0, aereo: 0 });
    window.localStorage.removeItem(STORAGE_INTL_KEY);
  };

  const downloadIntlFrete = () => {
    if (intlRows.length === 0) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(intlRows);
    XLSX.utils.book_append_sheet(wb, ws, "Fretes Internacionais");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Fretes_Internacionais_${today}.xlsx`);
  };

  // ---- Filtros e estatísticas para Internacionais ----
  const [intlFilterTipos, setIntlFilterTipos] = useState<string[]>([]);
  const [intlFilterPO, setIntlFilterPO] = useState<string>("");
  const [intlFilterExps, setIntlFilterExps] = useState<string[]>([]);
  const [intlFilterAgentes, setIntlFilterAgentes] = useState<string[]>([]);
  const [intlFilterMeses, setIntlFilterMeses] = useState<string[]>([]);
  const [rotasVisiveis, setRotasVisiveis] = useState<number>(10);

  const COL_NAME_MAP: Record<string, string> = { Col8: "20ft", Col9: "40ft", Col10: "45ft" };
  const colLabel = (c: string) => COL_NAME_MAP[c] ?? c;

  const intlField = useMemo(() => {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    const find = (...needles: string[]) =>
      intlColumns.find((c) => needles.some((n) => norm(c).includes(n))) ?? null;
    return {
      // Coluna D (índice 3) é a PO por definição da planilha
      po: intlColumns[3] ?? find("po"),
      exportador: find("exportador", "shipper", "fornecedor"),
      agente: find("agente", "agent"),
      container: find("container", "modalidade", "tipo"),
      qtdContainer: find("qtd cont", "qty cont", "quantidade cont"),
      peso: find("peso", "kg", "weight"),
      valor: find("valor", "preco", "price", "frete", "freight", "taxa"),
      mes: find("mes", "month", "data", "date"),
      praco: find("praco", "prazo", "lead"),
    };
  }, [intlColumns]);

  const formatDate = (v: unknown): string | null => {
    if (!v) return null;
    if (typeof v === "number" && v > 30000) {
      const utcDays = Math.floor(v - 25569);
      const date = new Date(utcDays * 86400000);
      const dd = String(date.getUTCDate()).padStart(2, "0");
      const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = date.getUTCFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    if (typeof v === "string") {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
      const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    }
    return null;
  };
  const isDateCol = (colName: string) =>
    /data|date|eta|etd|embarque|prazo|vencimento/.test(
      colName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
    );

  const detectQty = (v: unknown): number => {
    if (typeof v === "number") return v;
    if (!v) return 0;
    const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  };

  const detectMonth = (v: unknown): string | null => {
    if (!v) return null;
    if (typeof v === "number") {
      const utcDays = Math.floor(v - 25569);
      const date = new Date(utcDays * 86400000);
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    const s = String(v).trim();
    const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (br) {
      const y = br[3].length === 2 ? `20${br[3]}` : br[3];
      return `${y}-${br[2].padStart(2, "0")}`;
    }
    const iso = s.match(/^(\d{4})-(\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}`;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return null;
  };

  const intlStats = useMemo(() => {
    const rows = intlRows;
    const containers = { "20ft": 0, "40ft": 0, "45ft": 0 };
    const modalidades = { LCL: 0, FCL: 0, Aereo: 0 };
    const exportadores = new Set<string>();
    const agentes = new Set<string>();
    const meses = new Set<string>();
    let pesoTotal = 0;
    let valorTotal = 0;
    const monthMap = new Map<string, { containers: number; peso: number }>();

    rows.forEach((r) => {
      const cont = intlField.container ? String(r[intlField.container] ?? "").toLowerCase() : "";
      const qtd = intlField.qtdContainer ? detectQty(r[intlField.qtdContainer]) || 1 : 1;
      if (cont.includes("20")) containers["20ft"] += qtd;
      else if (cont.includes("45")) containers["45ft"] += qtd;
      else if (cont.includes("40")) containers["40ft"] += qtd;

      if (cont.includes("lcl")) modalidades.LCL += 1;
      else if (cont.includes("aer") || cont.includes("air")) modalidades.Aereo += 1;
      else if (cont.includes("fcl") || cont.includes("20") || cont.includes("40") || cont.includes("45")) modalidades.FCL += 1;

      if (intlField.exportador && r[intlField.exportador]) exportadores.add(String(r[intlField.exportador]));
      if (intlField.agente && r[intlField.agente]) agentes.add(String(r[intlField.agente]));

      if (intlField.peso) pesoTotal += detectQty(r[intlField.peso]);
      if (intlField.valor) valorTotal += detectQty(r[intlField.valor]);

      if (intlField.mes) {
        const mk = detectMonth(r[intlField.mes]);
        if (mk) {
          meses.add(mk);
          if (!monthMap.has(mk)) monthMap.set(mk, { containers: 0, peso: 0 });
          const m = monthMap.get(mk)!;
          m.containers += qtd;
          m.peso += intlField.peso ? detectQty(r[intlField.peso]) : 0;
        }
      }
    });

    const totalContainers = containers["20ft"] + containers["40ft"] + containers["45ft"];
    const monthsList = Array.from(meses).sort();
    const mediaContainers = monthsList.length > 0 ? totalContainers / monthsList.length : 0;
    const mediaKgMes = monthsList.length > 0 ? pesoTotal / monthsList.length : 0;
    const detalhesPorMes = monthsList.map((mk) => ({
      mes: mk,
      containers: monthMap.get(mk)?.containers ?? 0,
      peso: monthMap.get(mk)?.peso ?? 0,
    }));

    // Sobrescreve com totais oficiais lidos da planilha (linha 365 / coluna E)
    const containersFinal = {
      "20ft": intlTotals.cont20 || containers["20ft"],
      "40ft": intlTotals.cont40 || containers["40ft"],
      "45ft": intlTotals.cont45 || containers["45ft"],
    };
    const modalidadesFinal = {
      LCL: modalidades.LCL,
      FCL: modalidades.FCL,
      Aereo: intlTotals.aereo || modalidades.Aereo,
    };
    const totalContainersFinal =
      containersFinal["20ft"] + containersFinal["40ft"] + containersFinal["45ft"];

    return {
      containers: containersFinal,
      modalidades: modalidadesFinal,
      exportadores: Array.from(exportadores).sort(),
      agentes: Array.from(agentes).sort(),
      meses: monthsList,
      pesoTotal,
      valorTotal,
      totalContainers: totalContainersFinal,
      mediaContainers: monthsList.length > 0 ? totalContainersFinal / monthsList.length : 0,
      mediaKgMes,
      detalhesPorMes,
    };
  }, [intlRows, intlField, intlTotals]);

  const intlRowsFiltradas = useMemo(() => {
    return intlRows.filter((r) => {
      if (intlFilterTipos.length > 0 && intlField.container) {
        const cont = String(r[intlField.container] ?? "").toLowerCase();
        const match = intlFilterTipos.some((t) => cont.includes(t.toLowerCase()));
        if (!match) return false;
      }
      if (intlFilterPO && intlField.po) {
        const po = String(r[intlField.po] ?? "").toLowerCase();
        if (!po.includes(intlFilterPO.toLowerCase())) return false;
      }
      if (intlFilterExps.length > 0 && intlField.exportador) {
        if (!intlFilterExps.includes(String(r[intlField.exportador] ?? ""))) return false;
      }
      if (intlFilterAgentes.length > 0 && intlField.agente) {
        if (!intlFilterAgentes.includes(String(r[intlField.agente] ?? ""))) return false;
      }
      if (intlFilterMeses.length > 0 && intlField.mes) {
        const mk = detectMonth(r[intlField.mes]);
        if (!mk || !intlFilterMeses.includes(mk)) return false;
      }
      return true;
    });
  }, [intlRows, intlField, intlFilterTipos, intlFilterPO, intlFilterExps, intlFilterAgentes, intlFilterMeses]);

  useEffect(() => {
    setRotasVisiveis(10);
  }, [intlFilterTipos, intlFilterPO, intlFilterExps, intlFilterAgentes, intlFilterMeses]);

  // KPIs calculados dos dados filtrados (refletem todos os filtros ativos)
  const intlKpis = useMemo(() => {
    const rows = intlRowsFiltradas;
    const containers = { "20ft": 0, "40ft": 0, "45ft": 0 };
    const modalidades = { LCL: 0, FCL: 0, Aereo: 0 };
    const agentesSet = new Set<string>();
    let pesoTotal = 0;
    let valorTotal = 0;
    const mesesSet = new Set<string>();
    const monthMap = new Map<string, { containers: number; peso: number }>();
    rows.forEach((r) => {
      const cont = intlField.container ? String(r[intlField.container] ?? "").toLowerCase() : "";
      const qtd = intlField.qtdContainer ? detectQty(r[intlField.qtdContainer]) || 1 : 1;
      if (cont.includes("20")) containers["20ft"] += qtd;
      else if (cont.includes("45")) containers["45ft"] += qtd;
      else if (cont.includes("40")) containers["40ft"] += qtd;
      if (cont.includes("lcl")) modalidades.LCL += 1;
      else if (cont.includes("aer") || cont.includes("air")) modalidades.Aereo += 1;
      else if (cont.includes("fcl") || cont.includes("20") || cont.includes("40") || cont.includes("45")) modalidades.FCL += 1;
      if (intlField.agente && r[intlField.agente]) agentesSet.add(String(r[intlField.agente]));
      if (intlField.peso) pesoTotal += detectQty(r[intlField.peso]);
      if (intlField.valor) valorTotal += detectQty(r[intlField.valor]);
      if (intlField.mes) {
        const mk = detectMonth(r[intlField.mes]);
        if (mk) {
          mesesSet.add(mk);
          if (!monthMap.has(mk)) monthMap.set(mk, { containers: 0, peso: 0 });
          const m = monthMap.get(mk)!;
          m.containers += qtd;
          m.peso += intlField.peso ? detectQty(r[intlField.peso]) : 0;
        }
      }
    });
    const totalContainers = containers["20ft"] + containers["40ft"] + containers["45ft"];
    const monthsList = Array.from(mesesSet).sort();
    const mediaContainers = monthsList.length > 0 ? totalContainers / monthsList.length : 0;
    const mediaKgMes = monthsList.length > 0 ? pesoTotal / monthsList.length : 0;
    const detalhesPorMes = monthsList.map((mk) => ({
      mes: mk,
      containers: monthMap.get(mk)?.containers ?? 0,
      peso: monthMap.get(mk)?.peso ?? 0,
    }));
    return { containers, modalidades, agentes: agentesSet.size, pesoTotal, valorTotal, totalContainers, mediaContainers, mediaKgMes, detalhesPorMes, meses: monthsList };
  }, [intlRowsFiltradas, intlField]);

  const formatBRLIntl = (v: number) =>
    `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPesoApprox = (v: number) => {
    if (v >= 1_000_000) return `~${(v / 1_000_000).toFixed(1)}M kg`;
    if (v >= 1_000) return `~${(v / 1_000).toFixed(1)}k kg`;
    return `~${v.toFixed(0)} kg`;
  };
  const monthLabelKey = (key: string) => key;


  // Simulador
  const [tipoFrete, setTipoFrete] = useState("Marítimo");
  const [modalidade, setModalidade] = useState("LCL");
  const [pesoReal, setPesoReal] = useState("");
  const [cbm, setCbm] = useState("");
  const [comprimento, setComprimento] = useState("");
  const [largura, setLargura] = useState("");
  const [altura, setAltura] = useState("");
  const [origem, setOrigem] = useState("XINGANG - CHINA");
  const [destino, setDestino] = useState("SC");
  const [taxasAdicionais, setTaxasAdicionais] = useState("");

  const cotacoes = useMemo(() => {
    const peso = Number(pesoReal || 0);
    let volume = Number(cbm || 0);
    if (!volume && comprimento && largura && altura) {
      volume =
        (Number(comprimento) * Number(largura) * Number(altura)) / 1_000_000;
    }
    const pesoVolume = Math.max(peso / 1000, volume); // ton
    const taxas = Number(taxasAdicionais || 0);

    const lclBase = pesoVolume * 500 * 5; // mock conversion
    const fcl20Base = 1500 * 5;
    const fcl40Base = 2500 * 5;
    const aereoBase = peso * 6 * 5;

    const opcoes = [
      { id: "LCL", nome: "LCL (TON)", base: lclBase, tipo: "Marítimo" },
      { id: "FCL20", nome: "FCL 20ft", base: fcl20Base, tipo: "Marítimo" },
      { id: "FCL40", nome: "FCL 40ft", base: fcl40Base, tipo: "Marítimo" },
      { id: "AEREO", nome: "Aéreo", base: aereoBase, tipo: "Aéreo" },
    ].map((o) => ({ ...o, total: o.base + taxas, taxas, pesoVolume }));

    return opcoes;
  }, [pesoReal, cbm, comprimento, largura, altura, taxasAdicionais]);

  const melhor = useMemo(() => {
    const validas = cotacoes.filter((o) => o.base > 0);
    if (validas.length === 0) return null;
    return validas.reduce((prev, cur) => (cur.total < prev.total ? cur : prev));
  }, [cotacoes]);

  const selected = CONTAINERS.find((c) => c.id === selectedContainer)!;

  return (
    <div className="min-h-screen bg-background">
      <HeaderTabs />
      <main className="mx-auto max-w-[1400px] px-6 py-6 space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Ship className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Gerenciamento de Embarque</h1>
            <p className="text-sm text-muted-foreground">
              Informações de containers, fretes e embalagem
            </p>
          </div>
        </div>

        <Tabs defaultValue="containers" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="containers" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Containers</span>
            </TabsTrigger>
            <TabsTrigger value="embalagem" className="gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Embalagem</span>
            </TabsTrigger>
            <TabsTrigger value="fretes" className="gap-2">
              <Ship className="h-4 w-4" />
              <span className="hidden sm:inline">Fretes</span>
            </TabsTrigger>
            <TabsTrigger value="internacionais" className="gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Internacionais</span>
            </TabsTrigger>
            <TabsTrigger value="simulador" className="gap-2">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Simulador</span>
            </TabsTrigger>
          </TabsList>

          {/* ============================== CONTAINERS ============================== */}
          <TabsContent value="containers" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {CONTAINERS.map((c) => (
                <Card
                  key={c.id}
                  onClick={() => setSelectedContainer(c.id)}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    selectedContainer === c.id && "ring-2 ring-primary",
                  )}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{c.nome}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.descricao}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <p className="text-sm font-semibold">{c.tipo}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Dimensões</p>
                      <p className="text-sm">{c.dimensoes}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Capacidade</p>
                      <p className="text-sm">{c.capacidade}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Peso Máximo</p>
                      <p className="text-sm">{c.pesoMax}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{selected.nome}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Dimensões</p>
                    <p className="font-semibold">{selected.dimensoes}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Capacidade</p>
                    <p className="font-semibold">{selected.capacidade}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Peso Máximo</p>
                    <p className="font-semibold">{selected.pesoMax}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      Tempo de Trânsito
                    </p>
                    <p className="font-semibold">{selected.tempo}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4 bg-primary/5">
                  <p className="text-xs text-muted-foreground mb-2">
                    Valor Aproximado
                  </p>
                  <p className="text-lg font-bold text-primary">
                    {selected.valor}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Valores variam conforme rota e sazonalidade
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================== EMBALAGEM ============================== */}
          <TabsContent value="embalagem" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {EMBALAGEM_GROUPS.map((g) => (
                <Card key={g.titulo}>
                  <CardHeader>
                    <CardTitle className="text-base">{g.titulo}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Instruções</h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {g.instrucoes.map((i) => (
                          <li key={i}>• {i}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold mb-2">
                        Cuidados Especiais
                      </h4>
                      <ul className="space-y-1 text-sm">
                        {g.cuidados.map((c) => (
                          <li
                            key={c}
                            className="flex items-start gap-1.5 text-destructive"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Recomendações Gerais para LCL
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {RECOMENDACOES_LCL.map((r) => (
                  <p key={r.label}>
                    <span className="font-semibold text-foreground">
                      {r.label}
                    </span>{" "}
                    {r.text}
                  </p>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================== FRETES ============================== */}
          <TabsContent value="fretes" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Fretes LCL Aproximados</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Less than Container Load - Consolidação de carga
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {FRETES_LCL.map((f) => (
                      <div
                        key={f.rota}
                        className="rounded-lg border p-4 space-y-2 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold">{f.rota}</p>
                          <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded">
                            LCL
                          </span>
                        </div>
                        <p className="text-base font-bold text-primary">{f.valor}</p>
                        <p className="text-xs text-muted-foreground">{f.obs}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="font-medium">Tempo:</span>
                          <span>{f.tempo}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Fretes FCL Aproximados</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Full Container Load - Selecione o tipo de container
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(["20ft", "40ft", "45ft HC"] as const).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSelectedFclTipo(b)}
                        className={cn(
                          "text-xs font-semibold px-3 py-1 rounded-full transition-colors",
                          selectedFclTipo === b
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/70",
                        )}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {fretesFclFiltrados.map((f, idx) => (
                      <div
                        key={`${f.rota}-${idx}`}
                        className="rounded-lg border p-4 space-y-2 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold">{f.rota}</p>
                          <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded">
                            FCL {f.tipo}
                          </span>
                        </div>
                        <p className="text-base font-bold text-primary">{f.valor}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="font-medium">Capacidade:</span>
                          <span>{f.capacidade}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="font-medium">Tempo:</span>
                          <span>{f.tempo}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Frete Aéreo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm">
                    <span className="font-semibold">Valor Aproximado:</span> US$
                    3.50 - US$ 8.00 por kg
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Tempo de Trânsito:</span> 5-10
                    dias
                  </p>
                </div>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p>
                    Frete aéreo é significativamente mais caro, indicado apenas
                    para pedidos urgentes de pequena quantidade. Peso mínimo
                    geralmente 100 kg.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Principais Rotas Aéreas de Importação:
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {ROTAS_AEREAS.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================== INTERNACIONAIS ============================== */}
          <TabsContent value="internacionais" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">Fretes Internacionais</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Cotações de frete para importação (China/Exterior → Brasil)
                    </p>
                  </div>
                  {intlRows.length > 0 && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                        <CheckCircle2 className="h-4 w-4" /> {intlRows.length} registros carregados
                      </span>
                      <Button size="sm" variant="outline" onClick={downloadIntlFrete}>
                        <DownloadCloud className="h-4 w-4 mr-1" /> Baixar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={clearIntl} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4 mr-1" /> Limpar
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Carregar Planilha de Cotações</h4>
                  <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-4 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {intlRows.length > 0 ? "Atualizar Planilha de Fretes" : "Carregar Planilha de Fretes"}
                    </span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleIntlUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground mt-2">
                    Os dados estão salvos no navegador. Faça upload de um novo arquivo para atualizar.
                  </p>
                </div>

                {intlRows.length === 0 ? (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <h4 className="text-sm font-semibold mb-1">Nenhuma planilha carregada</h4>
                    <p className="text-sm text-muted-foreground">
                      Os fretes serão exibidos aqui após o carregamento da planilha. Os dados ficarão salvos automaticamente.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* KPI cards superiores — refletem filtros ativos */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="rounded-lg border-2 border-blue-500/40 p-3 text-center">
                        <p className="text-xs text-blue-500 font-semibold">Containers 20ft</p>
                        <p className="text-2xl font-bold">{intlKpis.containers["20ft"]}</p>
                      </div>
                      <div className="rounded-lg border-2 border-blue-500/40 p-3 text-center">
                        <p className="text-xs text-blue-500 font-semibold">Containers 40ft</p>
                        <p className="text-2xl font-bold">{intlKpis.containers["40ft"]}</p>
                      </div>
                      <div className="rounded-lg border-2 border-blue-500/40 p-3 text-center">
                        <p className="text-xs text-blue-500 font-semibold">Containers 45ft</p>
                        <p className="text-2xl font-bold">{intlKpis.containers["45ft"]}</p>
                      </div>
                      <div className="rounded-lg border-2 border-emerald-500/40 p-3 text-center">
                        <p className="text-xs text-emerald-500 font-semibold">Peso Total (aprox.)</p>
                        <p className="text-2xl font-bold">{formatPesoApprox(intlKpis.pesoTotal)}</p>
                      </div>
                      <div className="rounded-lg border-2 border-fuchsia-500/40 p-3 text-center">
                        <p className="text-xs text-fuchsia-500 font-semibold">Agentes</p>
                        <p className="text-2xl font-bold">{intlKpis.agentes}</p>
                      </div>
                    </div>

                    {/* Modalidades */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-lg border-2 border-emerald-500/40 p-3">
                        <p className="text-xs text-emerald-500 font-semibold">Modalidade LCL</p>
                        <p className="text-2xl font-bold">{intlKpis.modalidades.LCL}</p>
                      </div>
                      <div className="rounded-lg border-2 border-blue-500/40 p-3">
                        <p className="text-xs text-blue-500 font-semibold">Modalidade FCL</p>
                        <p className="text-2xl font-bold">{intlKpis.modalidades.FCL}</p>
                      </div>
                      <div className="rounded-lg border-2 border-orange-500/40 p-3">
                        <p className="text-xs text-orange-500 font-semibold">Modalidade Aéreo</p>
                        <p className="text-2xl font-bold">{intlKpis.modalidades.Aereo}</p>
                      </div>
                    </div>

                    {/* Valor total */}
                    <div className="rounded-lg border-2 border-emerald-500/40 p-4">
                      <p className="text-sm text-emerald-500 font-semibold">Valor Total de Fretes</p>
                      <p className="text-2xl font-bold text-emerald-500">{formatBRLIntl(intlKpis.valorTotal)}</p>
                    </div>

                    {/* Filtros */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Filtros</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        {/* Tipo de Container — multi-select */}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Tipo de Container</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-between text-sm font-normal h-9 px-3">
                                <span className="truncate">
                                  {intlFilterTipos.length === 0 ? "Todos" : intlFilterTipos.length === 1 ? intlFilterTipos[0] : `${intlFilterTipos.length} tipos`}
                                </span>
                                <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-40 p-2" align="start">
                              <div className="space-y-1">
                                <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                                  <input type="checkbox" className="h-3.5 w-3.5" checked={intlFilterTipos.length === 0} onChange={() => setIntlFilterTipos([])} />
                                  Todos
                                </label>
                                {["20", "40", "45", "LCL", "Aéreo"].map((t) => (
                                  <label key={t} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5"
                                      checked={intlFilterTipos.includes(t)}
                                      onChange={(e) => {
                                        if (e.target.checked) setIntlFilterTipos((p) => [...p, t]);
                                        else setIntlFilterTipos((p) => p.filter((x) => x !== t));
                                      }}
                                    />
                                    {t === "20" ? "20ft" : t === "40" ? "40ft" : t === "45" ? "45ft" : t}
                                  </label>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">PO (Pesquisar)</label>
                          <Input
                            placeholder="Digite a PO..."
                            value={intlFilterPO}
                            onChange={(e) => setIntlFilterPO(e.target.value)}
                          />
                        </div>
                        {/* Exportador — multi-select */}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Exportador</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-between text-sm font-normal h-9 px-3">
                                <span className="truncate">
                                  {intlFilterExps.length === 0 ? "Todos" : intlFilterExps.length === 1 ? intlFilterExps[0] : `${intlFilterExps.length} selecionados`}
                                </span>
                                <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2" align="start">
                              <div className="space-y-1 max-h-52 overflow-y-auto">
                                <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                                  <input type="checkbox" className="h-3.5 w-3.5" checked={intlFilterExps.length === 0} onChange={() => setIntlFilterExps([])} />
                                  Todos
                                </label>
                                {intlStats.exportadores.map((e) => (
                                  <label key={e} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5"
                                      checked={intlFilterExps.includes(e)}
                                      onChange={(ev) => {
                                        if (ev.target.checked) setIntlFilterExps((p) => [...p, e]);
                                        else setIntlFilterExps((p) => p.filter((x) => x !== e));
                                      }}
                                    />
                                    <span className="truncate">{e}</span>
                                  </label>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        {/* Agente — multi-select */}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Agente</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-between text-sm font-normal h-9 px-3">
                                <span className="truncate">
                                  {intlFilterAgentes.length === 0 ? "Todos" : intlFilterAgentes.length === 1 ? intlFilterAgentes[0] : `${intlFilterAgentes.length} selecionados`}
                                </span>
                                <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-52 p-2" align="start">
                              <div className="space-y-1 max-h-52 overflow-y-auto">
                                <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                                  <input type="checkbox" className="h-3.5 w-3.5" checked={intlFilterAgentes.length === 0} onChange={() => setIntlFilterAgentes([])} />
                                  Todos
                                </label>
                                {intlStats.agentes.map((a) => (
                                  <label key={a} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5"
                                      checked={intlFilterAgentes.includes(a)}
                                      onChange={(ev) => {
                                        if (ev.target.checked) setIntlFilterAgentes((p) => [...p, a]);
                                        else setIntlFilterAgentes((p) => p.filter((x) => x !== a));
                                      }}
                                    />
                                    <span className="truncate">{a}</span>
                                  </label>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Mês</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-between text-sm font-normal h-9 px-3">
                                <span className="truncate">
                                  {intlFilterMeses.length === 0
                                    ? "Todos os meses"
                                    : intlFilterMeses.length === 1
                                    ? intlFilterMeses[0]
                                    : `${intlFilterMeses.length} meses`}
                                </span>
                                <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2" align="start">
                              <div className="space-y-1 max-h-52 overflow-y-auto">
                                <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                                  <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5"
                                    checked={intlFilterMeses.length === 0}
                                    onChange={() => setIntlFilterMeses([])}
                                  />
                                  Todos os meses
                                </label>
                                {intlStats.meses.map((m) => (
                                  <label key={m} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5"
                                      checked={intlFilterMeses.includes(m)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setIntlFilterMeses((prev) => [...prev, m]);
                                        } else {
                                          setIntlFilterMeses((prev) => prev.filter((x) => x !== m));
                                        }
                                      }}
                                    />
                                    {m}
                                  </label>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Quantidade Média */}
                    <Card className="border-blue-500/40 border-2">
                      <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Quantidade Média de Containers por Mês</p>
                          <p className="text-3xl font-bold text-blue-500">{intlKpis.mediaContainers.toFixed(1)}</p>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p>Total de meses: {intlKpis.meses.length}</p>
                          <p>Total de containers: {intlKpis.totalContainers}</p>
                          <p>Média de kg/mês: {(intlKpis.mediaKgMes / 1000).toFixed(1)}k kg</p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Detalhes por Mês */}
                    {intlKpis.detalhesPorMes.length > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Detalhes por Mês</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {intlKpis.detalhesPorMes.map((d) => (
                            <div key={d.mes} className="rounded-lg border-2 border-blue-500/40 p-3">
                              <p className="text-xs font-semibold">{d.mes}</p>
                              <p className="text-lg font-bold">{d.containers} containers</p>
                              <p className="text-xs text-muted-foreground">{(d.peso / 1000).toFixed(1)}k kg</p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Listagem de rotas */}
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">
                        Mostrando {Math.min(rotasVisiveis, intlRowsFiltradas.length)} de {intlRowsFiltradas.length} rotas
                        {intlRowsFiltradas.length !== intlRows.length && ` (total: ${intlRows.length})`}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {intlRowsFiltradas.slice(0, rotasVisiveis).map((row, i) => {
                        // PO sempre da coluna D (índice 3)
                        const poColD = intlColumns[3] ? String(row[intlColumns[3]] ?? "") : "";
                        const po = poColD || (intlField.po ? String(row[intlField.po] ?? "") : "");
                        const exp = intlField.exportador ? String(row[intlField.exportador] ?? "") : "";
                        const cont = intlField.container ? String(row[intlField.container] ?? "") : "";
                        const qtd = intlField.qtdContainer ? String(row[intlField.qtdContainer] ?? "") : "";
                        const valor = intlField.valor ? detectQty(row[intlField.valor]) : 0;
                        const pracoRaw = intlField.praco ? row[intlField.praco] : null;
                        const praco = pracoRaw ? (formatDate(pracoRaw) ?? String(pracoRaw)) : "";
                        const contLower = cont.toLowerCase();
                        const contTipo = contLower.includes("lcl") ? "LCL" : contLower.includes("aer") || contLower.includes("air") ? "Aéreo" : contLower.includes("fcl") ? "FCL" : cont.replace(/\d+['"]?\s*(ft|hc)?/gi, "").trim() || "FCL";
                        const contSize = cont.match(/(\d+['"]?\s*(?:ft|hc|HC)?)/i)?.[1]?.trim() ?? "";
                        return (
                          <div key={i} className="rounded-lg border p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-blue-500">{po || `Linha ${i + 1}`}</p>
                                {exp && (
                                  <p className="text-sm mt-0.5 text-foreground">
                                    ⚓ {exp}
                                    {po && <span className="ml-2 text-xs text-muted-foreground font-normal">PO: {po}</span>}
                                  </p>
                                )}
                              </div>
                              {valor > 0 && (
                                <p className="text-base font-bold text-emerald-500">
                                  $ {valor.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                              {praco && (
                                <div>
                                  <p className="text-muted-foreground">Prazo</p>
                                  <p className="font-semibold">{praco}</p>
                                </div>
                              )}
                              {cont && (
                                <div>
                                  <p className="text-muted-foreground">Tipo</p>
                                  <p className="font-semibold">{contTipo}</p>
                                  {contSize && <p className="text-muted-foreground">{contSize}</p>}
                                </div>
                              )}
                              {qtd && (
                                <div>
                                  <p className="text-muted-foreground">Qtd</p>
                                  <p className="font-semibold">{qtd}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {intlRowsFiltradas.length > rotasVisiveis && (
                        <div className="text-center pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRotasVisiveis((v) => v + 10)}
                          >
                            Carregar mais ({Math.min(10, intlRowsFiltradas.length - rotasVisiveis)} de {intlRowsFiltradas.length - rotasVisiveis} restantes)
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Tabela completa */}
                    <details className="rounded-lg border">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center gap-2 select-none">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                        Tabela completa
                        {intlFileName && <span className="text-xs font-normal text-muted-foreground">— {intlFileName}</span>}
                        <span className="ml-auto text-xs font-normal text-muted-foreground">{intlRows.length} registros</span>
                      </summary>
                      <div className="overflow-auto max-h-[600px]">
                        <table className="w-full text-xs border-collapse">
                          <thead className="sticky top-0 z-10">
                            {/* Linha 1 — cabeçalhos principais */}
                            <tr className="bg-muted border-b">
                              {intlColumns.map((c) => (
                                <th key={c} className="text-left px-3 py-2 font-semibold whitespace-nowrap text-[10px] uppercase tracking-wide text-muted-foreground">
                                  {colLabel(c)}
                                </th>
                              ))}
                            </tr>
                            {/* Linha 2 — sub-cabeçalhos da planilha (ex: 20', 40', 45') */}
                            {intlSubHeaders.some((s) => s !== "") && (
                              <tr className="bg-muted/60 border-b">
                                {intlSubHeaders.map((s, i) => (
                                  <th key={i} className="text-left px-3 py-1 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                                    {s}
                                  </th>
                                ))}
                              </tr>
                            )}
                          </thead>
                          <tbody>
                            {intlRows.map((row, i) => (
                              <tr key={i} className={cn("border-b transition-colors", i % 2 === 0 ? "bg-background" : "bg-muted/20", "hover:bg-primary/5")}>
                                {intlColumns.map((c) => {
                                  const v = row[c];
                                  const norm = c.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
                                  const isValue = /valor|preco|price|frete|freight|taxa|usd/.test(norm);
                                  const isContainer = /container|modalidade/.test(norm);
                                  const isPo = /^po$/.test(norm.trim());
                                  const isDate = isDateCol(c);
                                  if (isDate && v) {
                                    const d = formatDate(v);
                                    if (d) return <td key={c} className="px-3 py-2 whitespace-nowrap">{d}</td>;
                                  }
                                  if (isContainer && v) {
                                    const s = String(v);
                                    const sLow = s.toLowerCase();
                                    const tipo = sLow.includes("lcl") ? "LCL" : sLow.includes("aer") || sLow.includes("air") ? "Aéreo" : sLow.includes("fcl") ? "FCL" : s.replace(/\d+['"]?\s*(ft|hc)?/gi, "").trim() || s;
                                    const size = s.match(/(\d+['"]?\s*(?:ft|hc|HC)?)/i)?.[1]?.trim() ?? "";
                                    return (
                                      <td key={c} className="px-3 py-2 whitespace-nowrap align-top">
                                        <p className="font-semibold">{tipo}</p>
                                        {size && <p className="text-muted-foreground text-[10px]">{size}</p>}
                                      </td>
                                    );
                                  }
                                  if (isValue && typeof v === "number" && v > 0) {
                                    return (
                                      <td key={c} className="px-3 py-2 whitespace-nowrap font-semibold text-emerald-600">
                                        $ {v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                      </td>
                                    );
                                  }
                                  if (isPo && v) {
                                    return (
                                      <td key={c} className="px-3 py-2 whitespace-nowrap font-semibold text-blue-500">
                                        {String(v)}
                                      </td>
                                    );
                                  }
                                  return (
                                    <td key={c} className="px-3 py-2 whitespace-nowrap text-foreground/80">
                                      {String(v ?? "")}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================== SIMULADOR ============================== */}
          <TabsContent value="simulador" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-5 w-5" /> Simulador de Frete
                  Internacional
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Calcule cotações de frete aéreo ou marítimo em tempo real
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Tipo de Frete
                    </label>
                    <Select value={tipoFrete} onValueChange={setTipoFrete}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Marítimo">Marítimo</SelectItem>
                        <SelectItem value="Aéreo">Aéreo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Modalidade
                    </label>
                    <Select value={modalidade} onValueChange={setModalidade}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LCL">
                          LCL (Less Container Load)
                        </SelectItem>
                        <SelectItem value="FCL20">FCL 20ft</SelectItem>
                        <SelectItem value="FCL40">FCL 40ft</SelectItem>
                        <SelectItem value="AEREO">Aéreo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Peso Real (kg)
                    </label>
                    <Input
                      type="number"
                      value={pesoReal}
                      placeholder="0"
                      onChange={(e) => setPesoReal(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      CBM (m³) - Opcional
                    </label>
                    <Input
                      type="number"
                      value={cbm}
                      placeholder="0"
                      onChange={(e) => setCbm(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Se preenchido, ignora as dimensões
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Comprimento (cm)
                    </label>
                    <Input
                      type="number"
                      value={comprimento}
                      placeholder="0"
                      onChange={(e) => setComprimento(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Largura (cm)
                    </label>
                    <Input
                      type="number"
                      value={largura}
                      placeholder="0"
                      onChange={(e) => setLargura(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Altura (cm)
                    </label>
                    <Input
                      type="number"
                      value={altura}
                      placeholder="0"
                      onChange={(e) => setAltura(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Origem
                    </label>
                    <Input
                      value={origem}
                      onChange={(e) => setOrigem(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Destino
                    </label>
                    <Input
                      value={destino}
                      onChange={(e) => setDestino(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Taxas Adicionais (R$)
                    </label>
                    <Input
                      type="number"
                      value={taxasAdicionais}
                      placeholder="0"
                      onChange={(e) => setTaxasAdicionais(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cotações Disponíveis</CardTitle>
              </CardHeader>
              <CardContent>
                {melhor ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {cotacoes.map((o) => {
                      const isBest = melhor && o.id === melhor.id;
                      return (
                        <div
                          key={o.id}
                          className={cn(
                            "rounded-lg border p-4 space-y-2 relative",
                            isBest && "border-primary bg-primary/5",
                          )}
                        >
                          {isBest && (
                            <span className="absolute -top-2 right-3 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded">
                              MELHOR OPÇÃO
                            </span>
                          )}
                          <p className="text-sm font-semibold">{o.nome}</p>
                          <div className="text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Peso/Volume
                              </span>
                              <span>{o.pesoVolume.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Frete Base
                              </span>
                              <span>R$ {o.base.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Taxas</span>
                              <span>R$ {o.taxas.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-semibold pt-1 border-t">
                              <span>Total</span>
                              <span className="text-primary">
                                R$ {o.total.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={isBest ? "default" : "outline"}
                            className="w-full mt-2"
                          >
                            Fechar este Frete
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Preencha o peso e dimensões para calcular as cotações de frete
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

    </div>
  );
};

export default Embarques;
