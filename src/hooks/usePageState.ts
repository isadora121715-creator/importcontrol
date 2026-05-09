import { useState } from "react";

/**
 * Drop-in replacement for useState that persists its value in sessionStorage.
 * When the user navigates away and comes back, the last value is restored.
 *
 * @param key      Unique key for sessionStorage (use page-scoped names, e.g. "conexoes.poFilter")
 * @param initial  Initial value used the very first time (if nothing is stored yet)
 */
export function usePageState<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      // corrupt entry — fall through to initial
    }
    return initial;
  });

  const set: React.Dispatch<React.SetStateAction<T>> = (action) => {
    setState((prev) => {
      const next =
        typeof action === "function"
          ? (action as (p: T) => T)(prev)
          : action;
      try {
        sessionStorage.setItem(key, JSON.stringify(next));
      } catch {
        // quota exceeded or private mode — silently ignore
      }
      return next;
    });
  };

  return [state, set];
}
