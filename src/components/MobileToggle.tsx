import { Smartphone, Monitor } from "lucide-react";
import { useEffect, useState, useCallback } from "react";

export function useMobileMode() {
  const [isMobileMode, setIsMobileMode] = useState(() => {
    try {
      return localStorage.getItem("mobileMode") === "true";
    } catch {
      return false;
    }
  });
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    localStorage.setItem("mobileMode", String(isMobileMode));
    if (isMobileMode) {
      document.body.classList.add("mobile-mode-active");
    } else {
      document.body.classList.remove("mobile-mode-active");
    }
    return () => document.body.classList.remove("mobile-mode-active");
  }, [isMobileMode]);

  const closeMobile = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsExiting(false);
      setIsMobileMode(false);
    }, 300);
  }, []);

  return { isMobileMode, setIsMobileMode, isExiting, closeMobile };
}

export const MobileToggle = ({
  isMobileMode,
  onToggle,
}: {
  isMobileMode: boolean;
  onToggle: () => void;
}) => {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors bg-card text-foreground hover:bg-accent"
      title={isMobileMode ? "Voltar ao modo desktop" : "Ativar modo celular"}
    >
      {isMobileMode ? (
        <>
          <Monitor className="h-3.5 w-3.5" />
          Desktop
        </>
      ) : (
        <>
          <Smartphone className="h-3.5 w-3.5" />
          Celular
        </>
      )}
    </button>
  );
};
