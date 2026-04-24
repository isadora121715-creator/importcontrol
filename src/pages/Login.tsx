import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff, UserPlus, LogIn } from "lucide-react";
import fluxoLogo from "@/assets/fluxo-logo.jpeg";
import hciLogo from "@/assets/hci-logo.jpeg";

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Conta criada! Verifique seu e-mail para confirmar o cadastro.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("E-mail ou senha incorretos.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: "linear-gradient(135deg, #0A2540 0%, #1E5EFF 100%)" }}>
      <div className="w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={fluxoLogo} alt="Fluxo" className="w-16 h-16 rounded-2xl mx-auto mb-4 object-contain bg-white/90" />
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
            Controle de Pedidos
            <img src={hciLogo} alt="HCI Group" className="h-8 w-auto object-contain" />
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>HCI Group</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 shadow-2xl" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)" }}>
          <h2 className="text-xl font-semibold text-center mb-6" style={{ color: "#0A2540" }}>
            {isSignUp ? "Criar conta" : "Entrar"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#0A2540" }}>Nome</label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#4DA3FF" }} />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:ring-2"
                    style={{ borderColor: "#e2e8f0", color: "#0A2540", background: "#f8fafc" }}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#0A2540" }}>E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#4DA3FF" }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:ring-2"
                  style={{ borderColor: "#e2e8f0", color: "#0A2540", background: "#f8fafc" }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#0A2540" }}>Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#4DA3FF" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full rounded-xl border py-2.5 pl-10 pr-10 text-sm outline-none transition-colors focus:ring-2"
                  style={{ borderColor: "#e2e8f0", color: "#0A2540", background: "#f8fafc" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" style={{ color: "#94a3b8" }} /> : <Eye className="h-4 w-4" style={{ color: "#94a3b8" }} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #1E5EFF 0%, #4DA3FF 100%)" }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {isSignUp ? "Criar conta" : "Entrar"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm font-medium transition-colors hover:underline"
              style={{ color: "#1E5EFF" }}
            >
              {isSignUp ? "Já tem conta? Entrar" : "Não tem conta? Criar"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          © {new Date().getFullYear()} HCI Group — Fluxo
        </p>
      </div>
    </div>
  );
}
