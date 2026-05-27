import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Menu, X } from "lucide-react";
import logoHci from "@/assets/logo-hci.jpeg";
import logoFluxo from "@/assets/logo-fluxo.jpeg";
import { ThemeToggle } from "@/components/ThemeToggle";

export function HeaderTabs() {
  const location = useLocation();
  const path = location.pathname.toLowerCase();
  const [menuOpen, setMenuOpen] = useState(false);

  const isConexoes = path === "/dashboard" || path === "/conexoes";
  const isTubos = path.startsWith("/tubos");
  const isValvulas = path.startsWith("/valvulas");
  const isEmbarques = path.startsWith("/embarques");
  const isGeral = path.startsWith("/geral");
  const isPrecificacao = path.startsWith("/precificacao");
  const isCatalogo = path.startsWith("/catalogo");
  const isFrete = path.startsWith("/frete");
  const isPagamentos = path.startsWith("/pagamentos");

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
      active
        ? "bg-background shadow-sm text-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
    }`;

  const mobileTabClass = (active: boolean) =>
    `flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:text-foreground hover:bg-muted"
    }`;

  const navLinks = [
    { to: "/dashboard",   label: "Conexões",    active: isConexoes },
    { to: "/tubos",       label: "Tubos",       active: isTubos },
    { to: "/valvulas",    label: "Válvulas",    active: isValvulas },
    { to: "/geral",       label: "Geral",       active: isGeral },
    { to: "/precificacao",label: "Precificação",active: isPrecificacao },
    { to: "/embarques",   label: "Embarques",   active: isEmbarques },
    { to: "/catalogo",    label: "Catálogo",    active: isCatalogo },
    { to: "/pagamentos",  label: "Pagamentos",  active: isPagamentos },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3">
        {/* Logos */}
        <div className="flex items-center gap-2 shrink-0">
          <img src={logoHci} alt="HCI Group" className="h-8 object-contain" />
          <img src={logoFluxo} alt="Fluxo" className="h-6 object-contain hidden sm:block" />
          <div className="h-6 w-px bg-border mx-1 hidden sm:block" />
          <h1 className="font-bold text-base leading-tight hidden sm:block">Dashboard</h1>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1 bg-muted/50 p-1 rounded-md ml-2 overflow-x-auto">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors text-primary hover:text-primary/80 hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
            title="Voltar para o Início"
          >
            <Home className="h-4 w-4" />
          </Link>
          {navLinks.map((l) => (
            <Link key={l.to} to={l.to} className={tabClass(l.active) + " shrink-0"}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <ThemeToggle />
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden border-t bg-card/95 backdrop-blur px-3 py-3 space-y-1">
          <Link
            to="/"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium rounded-md text-primary hover:bg-muted transition-colors"
          >
            <Home className="h-4 w-4" />
            Início
          </Link>
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMenuOpen(false)}
              className={mobileTabClass(l.active)}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
