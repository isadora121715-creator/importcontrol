import { useState } from "react";
import { Ship, Package, Truck, Globe, Calculator, AlertTriangle } from "lucide-react";
import { HeaderTabs } from "@/components/HeaderTabs";
import { Card } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

type ContainerInfo = {
  nome: string;
  cap: string;
  peso: string;
  tempo: string;
  valor: string;
};

const CONTAINERS: ContainerInfo[] = [
  { nome: "20ft FCL", cap: "33m³", peso: "18t", tempo: "40-50 dias", valor: "US$ 1.200-1.800" },
  { nome: "40ft FCL", cap: "67m³", peso: "28t", tempo: "40-50 dias", valor: "US$ 2.000-3.000" },
  { nome: "45ft HC", cap: "76m³", peso: "30t", tempo: "40-50 dias", valor: "US$ 2.500-3.500" },
  { nome: "LCL", cap: "até 25m³", peso: "15t", tempo: "35-45 dias", valor: "US$ 400-600/m³" },
  { nome: "Aéreo", cap: "variável", peso: "variável", tempo: "5-10 dias", valor: "US$ 3.5-8/kg" },
];

const Embarques = () => {
  const [selectedContainer, setSelectedContainer] = useState<number | null>(null);

  // Simulador
  const [tipo, setTipo] = useState("Marítimo");
  const [modal, setModal] = useState("LCL");
  const [peso, setPeso] = useState("");
  const [cbm, setCbm] = useState("");
  const [urgencia, setUrgencia] = useState("baixa");
  const [resultado, setResultado] = useState<null | {
    recomendacao: string;
    melhorCusto: number;
    custoLCL: number;
    custo20: number;
    custo40: number;
    custoAereo: number;
  }>(null);

  const calcular = () => {
    const pesoNum = Number(peso || 0);
    const cbmNum = Number(cbm || 0);

    const custoLCL = cbmNum * 500;
    const custo20 = 1500;
    const custo40 = 2500;
    const custoAereo = pesoNum * 6;

    let recomendacao = "";
    let melhorCusto = 0;

    if (urgencia === "alta") {
      recomendacao = "AÉREO";
      melhorCusto = custoAereo;
    } else if (cbmNum <= 15) {
      recomendacao = "LCL";
      melhorCusto = custoLCL;
    } else if (cbmNum <= 33) {
      recomendacao = "FCL 20ft";
      melhorCusto = custo20;
    } else if (cbmNum <= 67) {
      recomendacao = "FCL 40ft";
      melhorCusto = custo40;
    } else {
      recomendacao = "FCL 45ft";
      melhorCusto = 3200;
    }

    setResultado({ recomendacao, melhorCusto, custoLCL, custo20, custo40, custoAereo });
  };

  const selected = selectedContainer !== null ? CONTAINERS[selectedContainer] : null;

  return (
    <div className="min-h-screen bg-background">
      <HeaderTabs />
      <main className="mx-auto max-w-[1600px] p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Ship className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Gerenciamento de Embarque</h1>
        </div>

        <Tabs defaultValue="containers" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
            <TabsTrigger value="containers" className="gap-2">
              <Package className="h-4 w-4" /> Containers
            </TabsTrigger>
            <TabsTrigger value="embalagem" className="gap-2">
              <Package className="h-4 w-4" /> Embalagem
            </TabsTrigger>
            <TabsTrigger value="fretes" className="gap-2">
              <Truck className="h-4 w-4" /> Fretes
            </TabsTrigger>
            <TabsTrigger value="internacionais" className="gap-2">
              <Globe className="h-4 w-4" /> Internacionais
            </TabsTrigger>
            <TabsTrigger value="simulador" className="gap-2">
              <Calculator className="h-4 w-4" /> Simulador
            </TabsTrigger>
          </TabsList>

          {/* CONTAINERS */}
          <TabsContent value="containers" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {CONTAINERS.map((c, i) => (
                <Card
                  key={c.nome}
                  onClick={() => setSelectedContainer(i)}
                  className={cn(
                    "p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
                    selectedContainer === i && "border-2 border-primary",
                  )}
                >
                  <h3 className="font-semibold text-base">{c.nome}</h3>
                  <p className="text-sm text-muted-foreground mt-1">Capacidade: {c.cap}</p>
                </Card>
              ))}
            </div>

            <Card className="p-6">
              {selected ? (
                <div>
                  <h2 className="text-xl font-bold mb-4">{selected.nome}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Capacidade</p>
                      <p className="font-semibold mt-1">{selected.cap}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Peso</p>
                      <p className="font-semibold mt-1">{selected.peso}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tempo</p>
                      <p className="font-semibold mt-1">{selected.tempo}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Valor</p>
                      <p className="font-semibold mt-1">{selected.valor}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <h2 className="text-muted-foreground">Selecione um container</h2>
              )}
            </Card>
          </TabsContent>

          {/* EMBALAGEM */}
          <TabsContent value="embalagem" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-3">Embalagem de Tubos</h2>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Empacotar tubos em caixas de madeira resistente</li>
                <li>Agrupar por diâmetro e comprimento</li>
                <li>Preencher com papel kraft ou espuma</li>
                <li>Fixar com cintas</li>
                <li>Máximo 1.000 kg por caixa</li>
              </ul>
              <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" /> Evitar umidade e danos mecânicos
              </p>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-bold mb-3">Embalagem de Válvulas</h2>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Caixas de papelão resistente</li>
                <li>Usar amortecimento</li>
                <li>Máximo 800 kg por palete</li>
              </ul>
              <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" /> Produto frágil
              </p>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-bold mb-3">Embalagem de Conexões</h2>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Separar por tamanho</li>
                <li>Máximo 500 kg por caixa</li>
                <li>Paletes até 800 kg</li>
              </ul>
            </Card>
          </TabsContent>

          {/* FRETES */}
          <TabsContent value="fretes" className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-2">Fretes LCL</h2>
              <p className="text-sm text-muted-foreground">Shangai → Santos: US$ 400-600 / m³</p>
              <p className="text-sm text-muted-foreground">Tempo: 35-45 dias</p>
            </Card>
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-2">Fretes FCL</h2>
              <p className="text-sm text-muted-foreground">20ft: US$ 1.200-1.800</p>
              <p className="text-sm text-muted-foreground">Tempo: 40-50 dias</p>
            </Card>
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-2">Frete Aéreo</h2>
              <p className="text-sm text-muted-foreground">US$ 3.50 - 8.00 / kg</p>
              <p className="text-sm text-muted-foreground">Tempo: 5-10 dias</p>
            </Card>
          </TabsContent>

          {/* INTERNACIONAIS */}
          <TabsContent value="internacionais" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-2">Resumo</h2>
              <p className="text-sm text-muted-foreground">Containers 20ft: 20</p>
              <p className="text-sm text-muted-foreground">Containers 40ft: 86</p>
              <p className="text-sm text-muted-foreground">Valor total: R$ 262.905,46</p>
            </Card>
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-2">Importação por mês</h2>
              <p className="text-sm text-muted-foreground">2026-01: 66 containers</p>
              <p className="text-sm text-muted-foreground">2026-02: 16 containers</p>
            </Card>
          </TabsContent>

          {/* SIMULADOR */}
          <TabsContent value="simulador">
            <Card className="p-6 space-y-4 max-w-2xl">
              <h2 className="text-lg font-bold">Simulador de Frete</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Marítimo">Marítimo</SelectItem>
                      <SelectItem value="Aéreo">Aéreo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Modal</label>
                  <Select value={modal} onValueChange={setModal}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LCL">LCL</SelectItem>
                      <SelectItem value="FCL">FCL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Peso (kg)</label>
                  <Input
                    type="number"
                    value={peso}
                    onChange={(e) => setPeso(e.target.value)}
                    placeholder="Peso kg"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">CBM (m³)</label>
                  <Input
                    type="number"
                    value={cbm}
                    onChange={(e) => setCbm(e.target.value)}
                    placeholder="CBM"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Urgência</label>
                  <Select value={urgencia} onValueChange={setUrgencia}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={calcular} className="w-full md:w-auto">
                Calcular
              </Button>

              {resultado && (
                <Card className="p-4 bg-muted/50 mt-4">
                  <h3 className="text-lg font-bold text-primary">
                    🚀 Melhor Opção: {resultado.recomendacao}
                  </h3>
                  <div className="mt-3 space-y-1 text-sm">
                    <p>LCL: US$ {resultado.custoLCL.toFixed(2)}</p>
                    <p>FCL 20ft: US$ {resultado.custo20}</p>
                    <p>FCL 40ft: US$ {resultado.custo40}</p>
                    <p>Aéreo: US$ {resultado.custoAereo.toFixed(2)}</p>
                  </div>
                  <h4 className="mt-3 text-base font-semibold">
                    Total estimado: US$ {resultado.melhorCusto.toFixed(2)}
                  </h4>
                </Card>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Embarques;
