import type { PedidoRow } from "@/lib/parseExcel";

const PEDIDOS_CACHE_PREFIX = "pedidos-cache:v1:";

interface PedidosCachePayload {
  rows: PedidoRow[];
  timestamp: number;
  fileName: string | null;
}

function getCacheKey(categoria: string) {
  return `${PEDIDOS_CACHE_PREFIX}${categoria}`;
}

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function readPedidosCache(categoria: string): PedidosCachePayload | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getCacheKey(categoria));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PedidosCachePayload;
    if (!Array.isArray(parsed.rows) || typeof parsed.timestamp !== "number") return null;

    // Invalidate cache older than 24 hours so stale data is not served indefinitely
    if (Date.now() - parsed.timestamp > CACHE_MAX_AGE_MS) {
      window.localStorage.removeItem(getCacheKey(categoria));
      return null;
    }

    return {
      rows: parsed.rows,
      timestamp: parsed.timestamp,
      fileName: parsed.fileName ?? null,
    };
  } catch {
    return null;
  }
}

export function writePedidosCache(categoria: string, rows: PedidoRow[], fileName: string | null) {
  if (typeof window === "undefined") return;

  const key = getCacheKey(categoria);
  const payload: PedidosCachePayload = {
    rows,
    timestamp: Date.now(),
    fileName,
  };
  const serialized = JSON.stringify(payload);

  try {
    window.localStorage.setItem(key, serialized);
  } catch (err) {
    const isQuotaError =
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        err.code === 22);

    if (isQuotaError) {
      console.warn(
        `[pedidosCache] localStorage quota exceeded for key "${key}". Clearing entry and retrying.`,
        err,
      );
      try {
        window.localStorage.removeItem(key);
        window.localStorage.setItem(key, serialized);
      } catch (retryErr) {
        console.warn(
          `[pedidosCache] Retry after quota clear also failed for key "${key}". Cache will not be persisted.`,
          retryErr,
        );
      }
    } else {
      console.warn(`[pedidosCache] Unexpected error writing cache for key "${key}".`, err);
    }
  }
}

export async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function retryAsync<T>(fn: () => Promise<T>, attempts = 3, delayMs = 800): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Falha inesperada ao processar a operação.");
}

export async function yieldToMainThread() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}