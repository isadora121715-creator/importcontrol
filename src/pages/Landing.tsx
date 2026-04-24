import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoHci from "@/assets/logo-hci.jpeg";
import logoFluxo from "@/assets/logo-fluxo.jpeg";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl animate-pulse" />
      <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl animate-pulse delay-1000" />

      <div className="relative z-10 flex flex-col items-center gap-10 px-6 py-12 max-w-4xl w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Logos */}
        <div className="flex items-center gap-6">
          <img src={logoHci} alt="HCI Group" className="h-16 md:h-20 object-contain" />
          <img src={logoFluxo} alt="Fluxo" className="h-12 md:h-16 object-contain" />
        </div>

        {/* Title */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Gestão de Compras e Vendas
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Controle completo de pedidos, fornecedores, prazos e resultados em um único lugar
          </p>
        </div>

        {/* Enter Action */}
        <div className="flex flex-col items-center gap-4 w-full mt-8">
          <Button 
            size="lg" 
            onClick={() => navigate("/dashboard")} 
            className="text-lg px-12 py-6 rounded-full hover:scale-105 transition-transform shadow-lg"
          >
            Entrar
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Landing;
