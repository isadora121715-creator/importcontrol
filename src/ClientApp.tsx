import { useEffect, useState } from "react";
import App from "./App";

// Render the legacy BrowserRouter app on the client only.
// TanStack Start handles SSR shell; the dashboard itself is CSR.
export function ClientApp() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <App />;
}
