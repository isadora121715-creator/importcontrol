import { createFileRoute } from "@tanstack/react-router";
import { ClientApp } from "@/ClientApp";

// Splat route: every non-API URL is handled by the client-side react-router app.
export const Route = createFileRoute("/$")({
  component: ClientApp,
});
