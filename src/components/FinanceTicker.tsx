import { useMemo } from "react";

export type TickerItem = { name: string; value: string };

/**
 * Letreiro rolante estilo Bloomberg: fornecedor + valor passando
 * continuamente. Pausa ao passar o mouse.
 */
export function FinanceTicker({ items, label }: { items: TickerItem[]; label?: string }) {
  const duration = useMemo(() => Math.max(25, items.length * 4), [items.length]);

  if (!items.length) return null;

  const renderRow = (key: string) => (
    <div key={key} className="flex shrink-0 items-center">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-2 whitespace-nowrap px-5 font-mono text-xs">
          <span className="font-semibold uppercase tracking-wider text-cyan-400">{it.name}</span>
          <span className="text-foreground/90">{it.value}</span>
          <span className="pl-3 text-primary/40">|</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="relative flex items-stretch overflow-hidden rounded-lg border border-primary/25 bg-black/60 shadow-[0_0_18px_rgba(34,211,238,0.12)] backdrop-blur-md">
      <style>{`
        @keyframes finance-ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .finance-ticker-track:hover { animation-play-state: paused; }
      `}</style>
      {label && (
        <div className="z-10 flex shrink-0 items-center gap-1.5 border-r border-primary/25 bg-primary/15 px-3 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
          </span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-300">{label}</span>
        </div>
      )}
      <div className="relative flex-1 overflow-hidden">
        <div
          className="finance-ticker-track flex w-max items-center py-1.5"
          style={{ animation: `finance-ticker-scroll ${duration}s linear infinite` }}
        >
          {renderRow("a")}
          {renderRow("b")}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black/80 to-transparent" />
      </div>
    </div>
  );
}
