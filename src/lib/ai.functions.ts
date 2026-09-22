import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos da IA esgotados. Adicione créditos em Settings → Workspace → Usage.");
    const t = await res.text();
    console.error("AI gateway error", res.status, t);
    throw new Error("Erro ao consultar IA");
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─────────────────────────────────────────────────────────────────
// analyzeFreight — returns structured JSON for card rendering
// ─────────────────────────────────────────────────────────────────

export const analyzeFreight = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        peso: z.number().min(0),
        cbm: z.number().positive().optional(),
        largura: z.number().positive().optional(),
        altura: z.number().positive().optional(),
        comprimento: z.number().positive().optional(),
        modal: z.string().min(1).max(50),
        origem: z.string().max(80).optional(),
        destino: z.string().max(80).optional(),
        incoterm: z.string().max(20).optional(),
      })
      .refine(
        (d) => d.cbm != null || (d.largura != null && d.altura != null && d.comprimento != null),
        { message: "Informe o CBM ou as três dimensões (largura, altura, comprimento)" },
      )
      .parse(input),
  )
  .handler(async ({ data }) => {
    const volume = data.cbm != null
      ? data.cbm
      : (data.largura! * data.altura! * data.comprimento!) / 1_000_000;
    const pesoCubado = volume * 167; // fator aéreo padrão
    const origemStr = data.origem ? `Origem: ${data.origem}` : "";
    const destinoStr = data.destino ? `Destino: ${data.destino}` : "";
    const incotermStr = data.incoterm ? `Incoterm: ${data.incoterm}` : "";
    const volumeDescr = data.cbm != null
      ? `CBM informado: ${data.cbm} m³`
      : `${data.largura}×${data.altura}×${data.comprimento} cm`;

    const prompt = `Você é especialista em logística internacional. Analise a carga abaixo e responda SOMENTE com JSON válido — sem texto extra, sem markdown, sem comentários.

DADOS DA CARGA:
- Peso real: ${data.peso > 0 ? `${data.peso} kg` : "não informado"}
- Volume: ${volume.toFixed(3)} m³ (${volumeDescr})
- Peso cubado aéreo: ${pesoCubado.toFixed(0)} kg
- Modal solicitado: ${data.modal}
${origemStr ? `\n${origemStr}` : ""}${destinoStr ? `\n${destinoStr}` : ""}${incotermStr ? `\n${incotermStr}` : ""}

Retorne EXATAMENTE este JSON (sem campos extras, preencha null se não souber):
{
  "recomendacao": "FCL" | "LCL" | "Aéreo",
  "modal_adequado": true | false,
  "volume_cbm": ${volume.toFixed(3)},
  "peso_taxavel": ${Math.max(data.peso, pesoCubado).toFixed(0)},
  "justificativa": "1-2 frases explicando a recomendação",
  "tempo_transito": "X a Y dias úteis",
  "custo_relativo": "Baixo" | "Médio" | "Alto",
  "alternativa_modal": "outro modal viável ou null",
  "alternativa_motivo": "por que considerar a alternativa ou null",
  "alerta": "observação de risco ou atenção especial, ou null",
  "dica": "dica prática de otimização de custo, ou null"
}`;

    const raw = await callAI([{ role: "user", content: prompt }]);

    // Strip possible markdown code fences
    const cleaned = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      return { ok: true as const, data: parsed };
    } catch {
      return { ok: false as const, raw };
    }
  });

// ─────────────────────────────────────────────────────────────────
// chatComex — with optional dashboard context from client
// ─────────────────────────────────────────────────────────────────

export const chatComex = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(4000),
            }),
          )
          .min(1)
          .max(30),
        context: z.string().max(6000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const systemPrompt = data.context
      ? `Você é assistente especializado em comércio exterior e logística internacional da empresa HCI.
Regras:
- Respostas DIRETAS e CURTAS — máximo 3 parágrafos para temas gerais
- Para consultas de dados (PO, PI, datas, status): responda em no máximo 3 linhas com o dado exato
- Não use formalismos desnecessários, sem "Claro!", "Com certeza!" ou introduções longas
- Use listas apenas quando listar 3+ itens
- Português brasileiro

DADOS DO SISTEMA (use como fonte primária para responder):
${data.context}`
      : `Você é assistente especializado em comércio exterior e logística internacional da empresa HCI.
Regras:
- Respostas DIRETAS e CURTAS — máximo 3 parágrafos
- Não use formalismos nem introduções longas
- Use listas apenas quando listar 3+ itens
- Português brasileiro`;

    const reply = await callAI([
      { role: "system", content: systemPrompt },
      ...data.messages,
    ]);
    return { reply };
  });
