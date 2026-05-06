import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Mail, Lock, Eye, EyeOff, LogIn,
  Sparkles, KeyRound, ArrowLeft, ShieldCheck,
} from "lucide-react";
import fluxoLogo from "@/assets/fluxo-logo.jpeg";
import hciLogo from "@/assets/hci-logo.jpeg";

// ─────────────────────────────────────────────────────────────────
// Shared styles
// ─────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-400/40";
const inputStyle = { borderColor: "#e2e8f0", color: "#0A2540", background: "#f8fafc" };

const btnPrimary =
  "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[.98] disabled:opacity-50";

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

/** Tab pill */
function TabBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-lg py-2 text-xs font-semibold transition-all"
      style={
        active
          ? { background: "linear-gradient(135deg,#1E5EFF,#4DA3FF)", color: "#fff", boxShadow: "0 2px 8px #1E5EFF44" }
          : { background: "transparent", color: "#94a3b8" }
      }
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// First-access panel (OTP magic code — no password)
// ─────────────────────────────────────────────────────────────────

function PrimeiroAcesso() {
  const [email, setEmail]     = useState("");
  const [code, setCode]       = useState("");
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success("Código enviado! Verifique seu e-mail.");
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) {
      toast.error("Código inválido ou expirado. Tente novamente.");
    }
    // on success Supabase fires onAuthStateChange → app redirects automatically
  };

  if (sent) {
    return (
      <form onSubmit={verifyCode} className="space-y-4">
        {/* Confirmation info */}
        <div className="rounded-xl p-4 text-center space-y-1"
          style={{ background: "#f0f7ff", border: "1px solid #bfdbfe" }}>
          <ShieldCheck className="h-8 w-8 mx-auto mb-2" style={{ color: "#1E5EFF" }} />
          <p className="text-sm font-semibold" style={{ color: "#0A2540" }}>
            Código enviado para
          </p>
          <p className="text-sm font-bold" style={{ color: "#1E5EFF" }}>{email}</p>
          <p className="text-xs mt-1" style={{ color: "#64748b" }}>
            Digite o código de 6 dígitos recebido por e-mail.<br />
            Válido por 10 minutos.
          </p>
        </div>

        {/* Code input */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "#0A2540" }}>
            Código de acesso
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#4DA3FF" }} />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              required
              className={inputCls + " tracking-[0.4em] text-center font-bold text-lg"}
              style={{ ...inputStyle, paddingLeft: "2.5rem" }}
              autoFocus
            />
          </div>
        </div>

        <button type="submit" disabled={loading || code.length < 6} className={btnPrimary}
          style={{ background: "linear-gradient(135deg,#1E5EFF,#4DA3FF)" }}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Confirmar e entrar
        </button>

        <button
          type="button"
          onClick={() => { setSent(false); setCode(""); }}
          className="flex items-center gap-1 mx-auto text-xs transition-colors hover:underline"
          style={{ color: "#1E5EFF" }}
        >
          <ArrowLeft className="h-3 w-3" /> Usar outro e-mail
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="space-y-4">
      {/* Info banner */}
      <div className="rounded-xl p-3 text-xs flex items-start gap-2"
        style={{ background: "#f0f7ff", border: "1px solid #bfdbfe", color: "#1e40af" }}>
        <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "#1E5EFF" }} />
        <span>
          Sem necessidade de senha. Informe seu e-mail e receba um código de acesso imediato.
        </span>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "#0A2540" }}>
          E-mail
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#4DA3FF" }} />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            autoFocus
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>

      <button type="submit" disabled={loading || !email.trim()} className={btnPrimary}
        style={{ background: "linear-gradient(135deg,#1E5EFF,#4DA3FF)" }}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        Enviar código de acesso
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────
// Password panel (returning users)
// ─────────────────────────────────────────────────────────────────

function EntraComSenha() {
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [mode, setMode]               = useState<"signin" | "signup" | "forgot">("signin");
  const [forgotSent, setForgotSent]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setLoading(false);
      if (error) { toast.error(error.message); }
      else { setForgotSent(true); toast.success("Link de redefinição enviado!"); }
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setLoading(false);
      if (error) toast.error(error.message);
      else toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      return;
    }

    // signin
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) toast.error("E-mail ou senha incorretos.");
  };

  if (forgotSent) {
    return (
      <div className="text-center space-y-3 py-4">
        <ShieldCheck className="h-10 w-10 mx-auto" style={{ color: "#1E5EFF" }} />
        <p className="text-sm font-semibold" style={{ color: "#0A2540" }}>
          Link de redefinição enviado para
        </p>
        <p className="text-sm font-bold" style={{ color: "#1E5EFF" }}>{email}</p>
        <button
          onClick={() => { setForgotSent(false); setMode("signin"); }}
          className="text-xs hover:underline mt-2"
          style={{ color: "#1E5EFF" }}
        >
          Voltar ao login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* E-mail */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "#0A2540" }}>E-mail</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#4DA3FF" }} />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com" required autoFocus className={inputCls} style={inputStyle} />
        </div>
      </div>

      {/* Password (hidden in forgot mode) */}
      {mode !== "forgot" && (
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
              className={inputCls + " pr-10"}
              style={inputStyle}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2">
              {showPassword
                ? <EyeOff className="h-4 w-4" style={{ color: "#94a3b8" }} />
                : <Eye className="h-4 w-4" style={{ color: "#94a3b8" }} />}
            </button>
          </div>
        </div>
      )}

      <button type="submit" disabled={loading} className={btnPrimary}
        style={{ background: "linear-gradient(135deg,#1E5EFF,#4DA3FF)" }}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        {mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link de redefinição"}
      </button>

      {/* Secondary actions */}
      <div className="flex justify-between items-center text-xs flex-wrap gap-1">
        {mode === "signin" && (
          <>
            <button type="button" onClick={() => setMode("forgot")}
              className="hover:underline" style={{ color: "#64748b" }}>
              Esqueci a senha
            </button>
            <button type="button" onClick={() => setMode("signup")}
              className="font-semibold hover:underline" style={{ color: "#1E5EFF" }}>
              Criar conta com senha
            </button>
          </>
        )}
        {(mode === "signup" || mode === "forgot") && (
          <button type="button" onClick={() => setMode("signin")}
            className="flex items-center gap-1 hover:underline mx-auto" style={{ color: "#1E5EFF" }}>
            <ArrowLeft className="h-3 w-3" /> Voltar ao login
          </button>
        )}
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main Login page
// ─────────────────────────────────────────────────────────────────

export default function Login() {
  const [tab, setTab] = useState<"otp" | "senha">("otp");

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0A2540 0%, #1E5EFF 100%)" }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src={fluxoLogo}
            alt="Fluxo"
            className="w-16 h-16 rounded-2xl mx-auto mb-4 object-contain bg-white/90 shadow-lg"
          />
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center justify-center gap-3">
            Controle de Pedidos
            <img src={hciLogo} alt="HCI Group" className="h-8 w-auto object-contain" />
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>HCI Group</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(24px)" }}>

          {/* Tab switcher */}
          <div className="px-6 pt-6 pb-2">
            <div className="flex rounded-xl p-1 gap-1" style={{ background: "#f1f5f9" }}>
              <TabBtn active={tab === "otp"} onClick={() => setTab("otp")}>
                ✨ Primeiro Acesso
              </TabBtn>
              <TabBtn active={tab === "senha"} onClick={() => setTab("senha")}>
                🔐 Entrar com Senha
              </TabBtn>
            </div>
          </div>

          {/* Panel content */}
          <div className="px-6 pb-6 pt-4">
            {tab === "otp" ? <PrimeiroAcesso /> : <EntraComSenha />}
          </div>
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          © {new Date().getFullYear()} HCI Group — Fluxo
        </p>
      </div>
    </div>
  );
}
