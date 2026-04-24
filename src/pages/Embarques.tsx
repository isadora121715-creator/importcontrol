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
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STORAGE_FCL_KEY = "embarques.fretes_fcl.v2";
const STORAGE_INTL_KEY = "embarques.fretes_internacionais.v2";

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
  const [intlFileName, setIntlFileName] = useState<string>("");
  const [intlUploadedAt, setIntlUploadedAt] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_INTL_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        rows: FreteIntl[];
        columns: string[];
        fileName: string;
        uploadedAt: string;
      };
      setIntlRows(saved.rows ?? []);
      setIntlColumns(saved.columns ?? []);
      setIntlFileName(saved.fileName ?? "");
      setIntlUploadedAt(saved.uploadedAt ?? "");
    } catch {
      /* ignore */
    }
  }, []);

  const handleIntlUpload = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<FreteIntl>(sheet, { defval: "" });
      const cols = json.length > 0 ? Object.keys(json[0]) : [];
      const uploadedAt = new Date().toISOString();
      setIntlRows(json);
      setIntlColumns(cols);
      setIntlFileName(file.name);
      setIntlUploadedAt(uploadedAt);
      window.localStorage.setItem(
        STORAGE_INTL_KEY,
        JSON.stringify({ rows: json, columns: cols, fileName: file.name, uploadedAt }),
      );
      toast({
        title: "Planilha carregada",
        description: `${json.length} registros importados de ${file.name}.`,
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
    setIntlFileName("");
    setIntlUploadedAt("");
    window.localStorage.removeItem(STORAGE_INTL_KEY);
  };



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
                <CardTitle className="text-base">Fretes Internacionais</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Cotações de frete para importação (China/Exterior → Brasil)
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Carregar Planilha de Cotações
                  </h4>
                  <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-6 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {intlRows.length > 0
                        ? "Atualizar planilha (substituirá os dados atuais)"
                        : "Carregar Planilha de Fretes"}
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
                    A primeira linha da planilha deve conter os nomes das
                    colunas. Os dados ficam salvos no navegador e só são
                    atualizados ao carregar uma nova planilha.
                  </p>
                </div>

                {intlRows.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <FileSpreadsheet className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{intlFileName}</span>
                        <span className="text-muted-foreground">
                          · {intlRows.length} registros
                        </span>
                        {intlUploadedAt && (
                          <span className="text-xs text-muted-foreground">
                            · {new Date(intlUploadedAt).toLocaleString("pt-BR")}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={clearIntl}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Limpar
                      </Button>
                    </div>
                    <div className="overflow-auto rounded-lg border max-h-[500px]">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            {intlColumns.map((c) => (
                              <th
                                key={c}
                                className="text-left px-3 py-2 font-semibold whitespace-nowrap"
                              >
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {intlRows.map((row, i) => (
                            <tr key={i} className="border-t hover:bg-muted/30">
                              {intlColumns.map((c) => (
                                <td
                                  key={c}
                                  className="px-3 py-2 whitespace-nowrap"
                                >
                                  {String(row[c] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <h4 className="text-sm font-semibold mb-1">
                      Nenhuma planilha carregada
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Os fretes serão exibidos aqui após o carregamento da
                      planilha. Os dados ficarão salvos automaticamente.
                    </p>
                  </div>
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
