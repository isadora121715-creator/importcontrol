import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseExcelFile, type PedidoRow } from "@/lib/parseExcel";
import { parseExcelValvulas } from "@/lib/parseExcelValvulas";
import { parseExcelTubos } from "@/lib/parseExcelTubos";
import { parseExcelEmbarques } from "@/lib/parseExcelEmbarques";
import { readPedidosCache, retryAsync, withTimeout, writePedidosCache, yieldToMainThread } from "@/lib/pedidosPerformance";
import { syncCatalogo } from "@/lib/syncCatalogo";
import { toast } from "sonner";

const PEDIDOS_SELECT_COLUMNS = "id,pi,cliente,codigo,codigo_compra,descricao,qty_venda,qty_compra,preco_venda,preco_compra,po,fornecedor,status_fornecedor,status_compra_venda,status_producao,prazo_cliente,dias_faltam,dias_atraso,venda_em_dias,follow_up,chegada_hci,eta,etd,item,embarque,entrega_fornecedor,data_compra,prazo_inicial_fornecedor,emissao_pedido_sistema,data_recebimento_compra";

// Static JSON snapshots bundled with the app (public/data/).
// Served from the app's own domain — no external dependency, works for every user.
const GITHUB_SNAPSHOT: Record<string, string> = {
  "Conexões": "/data/conexoes-cache.json",
  "Tubos":    "/data/tubos-cache.json",
  "Válvulas": "/data/valvulas-cache.json",
};
const FETCH_PAGE_SIZE = 2000;
const FETCH_TIMEOUT_MS = 30000;
const UPLOAD_BATCH_SIZE = 200;
const UPLOAD_TIMEOUT_MS = 30000;

function mapRow(r: Record<string, unknown>): PedidoRow {
  return {
    id: r.id as string | undefined,
    pi: r.pi as number | null,
    cliente: r.cliente as string | null,
    codigo: r.codigo as string | null,
    codigoCompra: r.codigo_compra as string | null,
    descricao: r.descricao as string | null,
    qtyVenda: r.qty_venda as number | null,
    qtyCompra: r.qty_compra as number | null,
    precoVenda: r.preco_venda as number | null,
    precoCompra: r.preco_compra as number | null,
    po: r.po as string | null,
    fornecedor: r.fornecedor as string | null,
    statusFornecedor: r.status_fornecedor as string | null,
    statusCompraVenda: r.status_compra_venda as string | null,
    statusProducao: r.status_producao as string | null,
    prazoCliente: r.prazo_cliente as string | null,
    diasFaltam: r.dias_faltam as number | null,
    diasAtraso: r.dias_atraso as number | null,
    vendaEmDias: r.venda_em_dias as number | null,
    followUp: r.follow_up as string | null,
    chegadaHci: r.chegada_hci as string | null,
    eta: (r.eta as string) ?? null,
    etd: (r.etd as string) ?? null,
    item: r.item as string | null,
    embarque: r.embarque as string | null,
    entregaFornecedor: r.entrega_fornecedor as string | null,
    dataCompra: r.data_compra as string | null,
    prazoInicialFornecedor: r.prazo_inicial_fornecedor as string | null,
    emissaoPedidoSistema: r.emissao_pedido_sistema as string | null,
    dataRecebimentoCompra: r.data_recebimento_compra as string | null,
  };
}

function toDbRow(r: PedidoRow, categoria: string) {
  return {
    ...(r.id ? { id: r.id } : {}),
    pi: typeof r.pi === "number" ? r.pi : null,
    cliente: r.cliente ?? null,
    codigo: r.codigo ?? null,
    codigo_compra: r.codigoCompra ?? null,
    descricao: r.descricao ?? null,
    qty_venda: typeof r.qtyVenda === "number" ? r.qtyVenda : null,
    qty_compra: typeof r.qtyCompra === "number" ? r.qtyCompra : null,
    preco_venda: typeof r.precoVenda === "number" ? r.precoVenda : null,
    preco_compra: typeof r.precoCompra === "number" ? r.precoCompra : null,
    po: r.po ?? null,
    fornecedor: r.fornecedor ?? null,
    status_fornecedor: r.statusFornecedor ?? null,
    status_compra_venda: r.statusCompraVenda ?? null,
    status_producao: r.statusProducao ?? null,
    prazo_cliente: r.prazoCliente ?? null,
    dias_faltam: typeof r.diasFaltam === "number" ? r.diasFaltam : null,
    dias_atraso: typeof r.diasAtraso === "number" ? r.diasAtraso : null,
    venda_em_dias: typeof r.vendaEmDias === "number" ? r.vendaEmDias : null,
    follow_up: r.followUp ?? null,
    chegada_hci: r.chegadaHci ?? null,
    eta: (r.eta as string) ?? null,
    etd: (r.etd as string) ?? null,
    item: r.item ?? null,
    embarque: r.embarque ?? null,
    entrega_fornecedor: r.entregaFornecedor ?? null,
    data_compra: r.dataCompra ?? null,
    prazo_inicial_fornecedor: r.prazoInicialFornecedor ?? null,
    emissao_pedido_sistema: r.emissaoPedidoSistema ?? null,
    data_recebimento_compra: r.dataRecebimentoCompra ?? null,
    categoria,
  };
}

async function fetchAllPedidos(categoria: string): Promise<PedidoRow[]> {
  const allRows: Record<string, unknown>[] = [];

  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    const { data: rows, error } = await withTimeout(
      supabase
        .from("pedidos")
        .select(PEDIDOS_SELECT_COLUMNS)
        .eq("categoria", categoria)
        .range(from, from + FETCH_PAGE_SIZE - 1),
      FETCH_TIMEOUT_MS,
      "A leitura dos pedidos demorou demais. Tente novamente.",
    );

    if (error) {
      throw new Error("Erro ao carregar dados do banco.");
    }

    if (!rows || rows.length === 0) {
      break;
    }

    allRows.push(...rows);

    if (rows.length < FETCH_PAGE_SIZE) {
      break;
    }
  }

  // Supabase has data — use it (RLS is fixed or data was inserted normally).
  if (allRows.length > 0) {
    return allRows.map(mapRow);
  }

  // Supabase is empty (RLS blocking or DB not yet populated).
  // Fall back to the GitHub-hosted snapshot so all users see pre-loaded data.
  const snapshotUrl = GITHUB_SNAPSHOT[categoria];
  if (snapshotUrl) {
    try {
      const resp = await fetch(snapshotUrl);
      if (resp.ok) {
        const data: PedidoRow[] = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch (e) {
      console.warn("GitHub snapshot fetch failed:", e);
    }
  }

  return [];
}

export function usePedidos(categoria: string = "Conexões") {
  const queryClient = useQueryClient();
  const uploadLockRef = useRef(false);
  const cachedSnapshot = useMemo(() => readPedidosCache(categoria), [categoria]);
  const [fileName, setFileName] = useState<string | null>(cachedSnapshot?.fileName ?? null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(cachedSnapshot?.timestamp ?? null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  useEffect(() => {
    setFileName(cachedSnapshot?.fileName ?? null);
    setLastUpdated(cachedSnapshot?.timestamp ?? null);
  }, [categoria, cachedSnapshot?.fileName, cachedSnapshot?.timestamp]);

  const query = useQuery({
    queryKey: ["pedidos", categoria],
    queryFn: () => fetchAllPedidos(categoria),
    initialData: cachedSnapshot?.rows,
    initialDataUpdatedAt: cachedSnapshot?.timestamp,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    gcTime: 60 * 60_000,
    retry: 2,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    enabled: !isUpdating,
  });

  useEffect(() => {
    if (!query.data) return;

    // Don't overwrite a populated cache with empty Supabase results.
    // This happens when RLS blocks reads or the DB is temporarily unavailable.
    const existingCache = readPedidosCache(categoria);
    if (query.data.length === 0 && existingCache && existingCache.rows.length > 0) return;

    const cachedFileName = fileName ?? existingCache?.fileName ?? null;
    writePedidosCache(categoria, query.data, cachedFileName);

    if (query.dataUpdatedAt) {
      setLastUpdated(query.dataUpdatedAt);
    }
  }, [categoria, fileName, query.data, query.dataUpdatedAt]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (uploadLockRef.current) {
      toast.info("Já existe uma atualização em andamento.");
      e.target.value = "";
      return;
    }

    try {
      uploadLockRef.current = true;
      setIsUpdating(true);
      setUpdateProgress(0);
      setUpdateMessage("Processando planilha...");
      await yieldToMainThread();
      
      let rows: PedidoRow[];
      if (categoria === "Válvulas") {
        rows = await parseExcelValvulas(file);
      } else if (categoria === "Tubos") {
        rows = await parseExcelTubos(file);
      } else if (categoria === "Embarques") {
        rows = await parseExcelEmbarques(file);
      } else {
        rows = await parseExcelFile(file);
      }

      if (rows.length === 0) {
        throw new Error("A planilha não contém registros válidos para importação.");
      }
      
      // Strip any existing id so DB generates fresh UUIDs on insert
      const dbRows = rows.map((r) => {
        const { id: _omit, ...rest } = r;
        return toDbRow(rest as PedidoRow, categoria);
      });

      setUpdateMessage("Salvando dados...");
      setUpdateProgress(40);

      // Attempt to persist to Supabase via edge function (bypasses RLS with service key).
      // If the function isn't deployed yet or RLS blocks it, we fall back gracefully
      // and keep data available through the localStorage cache below.
      try {
        const { data: fnResult, error: fnError } = await supabase.functions.invoke(
          "upsert-pedidos",
          { body: { rows: dbRows, categoria } },
        );
        if (fnError) {
          console.warn("Supabase edge function indisponível, dados salvos localmente:", fnError.message);
        } else if (fnResult?.error) {
          console.warn("Supabase edge function retornou erro, dados salvos localmente:", fnResult.error);
        }
      } catch (serverErr) {
        console.warn("Falha ao salvar no servidor, dados disponíveis localmente:", serverErr);
      }

      setUpdateProgress(90);
      const completedAt = Date.now();
      setFileName(file.name);
      setLastUpdated(completedAt);
      writePedidosCache(categoria, rows, file.name);
      queryClient.setQueryData(["pedidos", categoria], rows);

      // Sync catalog for categories that carry product data, then refresh the catalog view
      if (categoria !== "Embarques") {
        try {
          const { added, updated } = await syncCatalogo(rows, categoria);
          if (added > 0 || updated > 0) {
            toast.info(`Catálogo: +${added} novo(s), ${updated} atualizado(s).`);
          }
          // Force immediate refetch so the Catalogo tab shows new items right away
          await queryClient.refetchQueries({ queryKey: ["catalogo"] });
        } catch (syncErr) {
          console.error("syncCatalogo error:", syncErr);
          toast.warning("Planilha salva, mas houve um erro ao sincronizar o catálogo. Tente recarregar o catálogo manualmente.");
        }
      }
      setUpdateProgress(100);
      setUpdateMessage("Atualização concluída.");
      // Do NOT invalidate — that would trigger a Supabase refetch which returns []
      // when RLS blocks inserts, overwriting the data we just saved locally.
      toast.success(`Planilha carregada: ${rows.length} registros salvos`);
    } catch (error) {
      console.error("Upload error:", error);
      const message = error instanceof Error
        ? error.message
        : (typeof error === "object" && error !== null && "message" in error)
          ? String((error as { message: unknown }).message)
          : "Erro ao atualizar a planilha. Verifique o formato do arquivo e tente novamente.";

      setUpdateMessage(message);
      toast.error(message);
    } finally {
      uploadLockRef.current = false;
      window.setTimeout(() => {
        setIsUpdating(false);
        setUpdateProgress(0);
        setUpdateMessage(null);
      }, 1000);
    }
    e.target.value = "";
  }, [categoria, queryClient]);

  // Prefer non-empty data: if Supabase returns [] (RLS or empty DB), use the
  // localStorage cache so uploaded data isn't lost on page reload.
  const freshData = query.data ?? [];
  const data = freshData.length > 0 ? freshData : (cachedSnapshot?.rows ?? []);
  const loading = query.isLoading && data.length === 0;
  const errorMessage = query.error instanceof Error ? query.error.message : null;
  const hasStaleData = errorMessage !== null && data.length > 0;

  return {
    data,
    loading,
    fileName,
    lastUpdated,
    handleFileUpload,
    isRefreshing: query.isFetching && !query.isLoading && !isUpdating,
    isUpdating,
    updateProgress,
    updateMessage,
    errorMessage,
    hasStaleData,
    retry: query.refetch,
  };
}
