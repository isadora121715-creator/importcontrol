import { Link, useLocation } from "react-router-dom";
import { Home } from "lucide-react";
import logoHci from "@/assets/logo-hci.jpeg";
import logoFluxo from "@/assets/logo-fluxo.jpeg";
import { ThemeToggle } from "@/components/ThemeToggle";

export function HeaderTabs() {
  const location = useLocation();
  const path = location.pathname.toLowerCase();

  const isConexoes = path === "/dashboard" || path === "/conexoes";
  const isTubos = path.startsWith("/tubos");
  const isValvulas = path.startsWith("/valvulas");
  const isEmbarques = path.startsWith("/embarques");
  const isGeral = path.startsWith("/geral");
  const isPrecificacao = path.startsWith("/precificacao");
  const isCatalogo = path.startsWith("/catalogo");

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
      active
        ? "bg-background shadow-sm text-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-6 py-3">
        <div className="flex items-center gap-3">
          <img src={logoHci} alt="HCI Group" className="h-9 object-contain" />
          <img src={logoFluxo} alt="Fluxo" className="h-7 object-contain" />
          <div className="h-6 w-px bg-border mx-1" />
          <div className="flex-1 min-w-0">
            <h1 className="font-bold leading-tight text-lg">Dashboard</h1>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-md ml-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors text-primary hover:text-primary/80 hover:bg-black/5 dark:hover:bg-white/5"
            title="Voltar para o Início"
          >
            <Home className="h-4 w-4" />
          </Link>
          <Link to="/dashboard" className={tabClass(isConexoes)}>
            Conexões
          </Link>
          <Link to="/tubos" className={tabClass(isTubos)}>
            Tubos
          </Link>
          <Link to="/valvulas" className={tabClass(isValvulas)}>
            Válvulas
          </Link>
          <Link to="/embarques" className={tabClass(isEmbarques)}>
            Embarques
          </Link>
          <Link to="/geral" className={tabClass(isGeral)}>
            Geral
          </Link>
          <Link to="/precificacao" className={tabClass(isPrecificacao)}>
            Precificação
          </Link>
          <Link to="/catalogo" className={tabClass(isCatalogo)}>
            Catálogo
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
