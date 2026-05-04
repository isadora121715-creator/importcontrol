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

export const analyzeFreight = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        peso: z.number().positive(),
        largura: z.number().positive(),
        altura: z.number().positive(),
        comprimento: z.number().positive(),
        modal: z.string().min(1).max(50),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const prompt = `Você é um especialista em logística internacional.
Analise os dados:
- Peso: ${data.peso} kg
- Dimensões (L x A x C): ${data.largura} x ${data.altura} x ${data.comprimento} cm
- Modal escolhido: ${data.modal}

Regras:
- Carga pequena → sugerir LCL ou aéreo
- Carga volumosa → sugerir FCL
- Sempre recomendar melhor custo-benefício

Responda em markdown com seções:
**Melhor modal**, **Justificativa**, **Economia estimada**, **Tempo médio**.`;

    const result = await callAI([{ role: "user", content: prompt }]);
    return { result };
  });

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
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const reply = await callAI([
      {
        role: "system",
        content:
          "Você é um especialista em comércio exterior, importação, fretes internacionais e custos logísticos. Responda em português, de forma clara, objetiva e prática.",
      },
      ...data.messages,
    ]);
    return { reply };
  });
