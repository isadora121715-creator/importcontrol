import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Senha atualizada com sucesso!");
      navigate("/");
    }
    setLoading(false);
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "linear-gradient(135deg, #0A2540 0%, #1E5EFF 100%)" }}>
        <p className="text-white">Link inválido ou expirado.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: "linear-gradient(135deg, #0A2540 0%, #1E5EFF 100%)" }}>
      <div className="w-full max-w-md mx-4 rounded-2xl p-8 shadow-2xl" style={{ background: "rgba(255,255,255,0.95)" }}>
        <h2 className="text-xl font-semibold text-center mb-6" style={{ color: "#0A2540" }}>Nova senha</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#4DA3FF" }} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nova senha"
              required
              minLength={6}
              className="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm"
              style={{ borderColor: "#e2e8f0", color: "#0A2540", background: "#f8fafc" }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #1E5EFF 0%, #4DA3FF 100%)" }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Atualizar senha
          </button>
        </form>
      </div>
    </div>
  );
}
