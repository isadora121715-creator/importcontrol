import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Landing from "@/pages/Landing";
import Index from "@/pages/Index";
import Geral from "@/pages/Geral";
import Precificacao from "@/pages/Precificacao";
import Catalogo from "@/pages/Catalogo";
import Embarques from "@/pages/Embarques";
import Compras from "@/pages/Compras";
import Vendas from "@/pages/Vendas";
import Tubos from "@/pages/Tubos";
import Valvulas from "@/pages/Valvulas";
import Fornecedores from "@/pages/Fornecedores";
import Configuracoes from "@/pages/Configuracoes";
import Frete from "@/pages/Frete";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<Index />} />
              <Route path="/geral" element={<Geral />} />
              <Route path="/precificacao" element={<Precificacao />} />
              <Route path="/catalogo" element={<Catalogo />} />
              <Route path="/compras" element={<Compras />} />
              <Route path="/vendas" element={<Vendas />} />
              <Route path="/embarques" element={<Embarques />} />
              <Route path="/tubos" element={<Tubos />} />
              <Route path="/valvulas" element={<Valvulas />} />
              <Route path="/fornecedores" element={<Fornecedores />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/conexoes" element={<Index />} />
              <Route path="/frete" element={<Frete />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
