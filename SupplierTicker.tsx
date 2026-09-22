import { useMemo } from "react";

export type TickerItem = {
  key: string;
  name: string;
  value: number;
  meta?: string;
  tone?: "urgent" | "warning" | "normal";
};

const toneClass: Record<NonNullable<TickerItem["tone"]>, string> = {
  urgent:  "text-red-400",
  warning: "text-yellow-400",
  normal:  "text-emerald-400",
};

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

/**
 * Bloomberg-style scrolling ticker: supplier name + amount, continuously
 * scrolling left. Purely CSS-driven (no extra deps) — the item list is
 * rendered twice back-to-back and animated by exactly -50%, so the loop
 * is seamless. Pauses on hover so values can be read.
 */
export function SupplierTicker({
  items,
  label = "PAGAMENTOS PENDENTES",
}: {
  items: TickerItem[];
  label?: string;
}) {
  const doubled = useMemo(() => [...items, ...items], [items]);

  if (items.length === 0) return null;

  return (
    <div className="relative flex items-stretch overflow-hidden rounded-md border border-border/50 bg-black/90 dark:bg-black/60">
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-primary/20 border-r border-border/50">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-bold tracking-wider text-emerald-400 whitespace-nowrap">{label}</span>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="ticker-track flex items-center gap-8 py-2 px-4 whitespace-nowrap w-max">
          {doubled.map((it, i) => (
            <span key={`${it.key}-${i}`} className="inline-flex items-center gap-2 text-xs font-mono">
              <span className="font-semibold text-zinc-200">{it.name}</span>
              <span className={toneClass[it.tone ?? "normal"]}>{fmtBRL(it.value)}</span>
              {it.meta && <span className="text-zinc-500">{it.meta}</span>}
              <span className="text-zinc-700">•</span>
            </span>
          ))}
        </div>
      </div>
      <style>{`
        .ticker-track {
          animation: ticker-scroll 45s linear infinite;
        }
        .relative:hover > .relative > .ticker-track {
          animation-play-state: paused;
        }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-track { animation: none; }
        }
      `}</style>
    </div>
  );
}
