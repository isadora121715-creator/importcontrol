import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileToggle, useMobileMode } from "@/components/MobileToggle";
import { Settings, User, Palette, Smartphone, Save, Loader2 } from "lucide-react";

export default function Configuracoes() {
  const { user, profile } = useAuth();
  const { isMobileMode, setIsMobileMode, closeMobile } = useMobileMode();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [cargo, setCargo] = useState(profile?.cargo ?? "");
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, cargo })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao salvar perfil.");
    } else {
      toast.success("Perfil atualizado!");
    }
    setSaving(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Preferências do sistema</p>
      </div>

      {/* Profile */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-5 w-5" style={{ color: "#1E5EFF" }} />
          <h2 className="font-semibold">Perfil</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cargo</label>
            <input
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">E-mail</label>
          <input value={user?.email ?? ""} disabled className="w-full rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground" />
        </div>
        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          style={{ background: "#1E5EFF" }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar perfil
        </button>
      </div>

      {/* Aparência */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="h-5 w-5" style={{ color: "#1E5EFF" }} />
          <h2 className="font-semibold">Aparência</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Tema</p>
            <p className="text-xs text-muted-foreground">Alternar entre claro e escuro</p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Modo celular */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Smartphone className="h-5 w-5" style={{ color: "#1E5EFF" }} />
          <h2 className="font-semibold">Modo Celular</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Simulação de celular</p>
            <p className="text-xs text-muted-foreground">Visualizar o dashboard como em um smartphone</p>
          </div>
          <MobileToggle isMobileMode={isMobileMode} onToggle={isMobileMode ? closeMobile : () => setIsMobileMode(true)} />
        </div>
      </div>
    </div>
  );
}
