import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  LayoutDashboard,
  ShoppingCart,
  TrendingUp,
  Factory,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import fluxoLogo from "@/assets/fluxo-logo.jpeg";
import hciLogo from "@/assets/hci-logo.jpeg";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/compras", icon: ShoppingCart, label: "Compras" },
  { to: "/vendas", icon: TrendingUp, label: "Vendas" },
  { to: "/fornecedores", icon: Factory, label: "Fornecedores" },
  { to: "/configuracoes", icon: Settings, label: "Configurações" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r transition-all duration-300 ${
          collapsed ? "w-16" : "w-56"
        }`}
        style={{ background: "#0A2540" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <img src={fluxoLogo} alt="Fluxo" className="h-8 w-8 flex-shrink-0 rounded-lg object-contain bg-white" />
          {!collapsed && (
            <div className="overflow-hidden flex items-center gap-1.5">
              <p className="text-sm font-bold text-white leading-tight">Controle de Pedidos</p>
              <img src={hciLogo} alt="HCI Group" className="h-5 w-auto object-contain" />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-1 px-2">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  active
                    ? "text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
                style={active ? { background: "#1E5EFF" } : undefined}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="border-t px-3 py-3 space-y-2" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          {!collapsed && profile && (
            <div className="px-1">
              <p className="text-xs font-medium text-white truncate">{profile.display_name}</p>
              {profile.cargo && <p className="text-[10px] text-white/40 truncate">{profile.cargo}</p>}
            </div>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col" style={{ background: "#0A2540" }}>
            <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <div className="flex items-center gap-2">
                <img src={fluxoLogo} alt="Fluxo" className="h-8 w-8 rounded-lg object-contain bg-white" />
                <p className="text-sm font-bold text-white">Controle de Pedidos</p>
                <img src={hciLogo} alt="HCI Group" className="h-5 w-auto object-contain" />
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-white/50 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 py-3 space-y-1 px-2">
              {navItems.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      active ? "text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                    style={active ? { background: "#1E5EFF" } : undefined}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
            <div className="border-t px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/50 hover:text-white hover:bg-white/10">
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar for mobile */}
        <header className="flex lg:hidden items-center justify-between border-b bg-card px-4 py-3">
          <button onClick={() => setMobileOpen(true)} className="text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src={fluxoLogo} alt="Fluxo" className="h-7 w-7 rounded-lg object-contain bg-white" />
            <span className="text-sm font-bold">Controle de Pedidos</span>
            <img src={hciLogo} alt="HCI Group" className="h-4 w-auto object-contain" />
          </div>
          <ThemeToggle />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="flex lg:hidden items-center justify-around border-t bg-card py-2">
          {navItems.slice(0, 4).map((item) => {
            const active = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
