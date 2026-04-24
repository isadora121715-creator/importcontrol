import { createFileRoute } from "@tanstack/react-router";
import { ClientApp } from "@/ClientApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ImportBuilder — Gestão de Importações" },
      {
        name: "description",
        content:
          "Dashboard inteligente para gestão de importações: pedidos, fornecedores, embarques e materiais.",
      },
      { property: "og:title", content: "ImportBuilder — Gestão de Importações" },
      {
        property: "og:description",
        content:
          "Acompanhe pedidos, fornecedores, embarques e materiais em um único painel.",
      },
    ],
  }),
  component: ClientApp,
});
