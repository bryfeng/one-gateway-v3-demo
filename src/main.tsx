import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DynamicProvider } from "@dynamic-labs-sdk/react-hooks";
import App from "./App";
import { StandaloneCheckout } from "./MerchantCycle";
import { dynamicClient } from "./dynamicClient";
import "./styles.css";
import "./merchant-cycle.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const checkoutId = new URLSearchParams(window.location.search).get("checkout");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DynamicProvider client={dynamicClient}>
        {checkoutId ? <StandaloneCheckout paymentId={checkoutId} /> : <App />}
      </DynamicProvider>
    </QueryClientProvider>
  </StrictMode>,
);
