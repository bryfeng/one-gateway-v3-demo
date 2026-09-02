import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DynamicProvider } from "@dynamic-labs-sdk/react-hooks";
import App from "./App";
import { dynamicClient } from "./dynamicClient";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DynamicProvider client={dynamicClient}>
        <App />
      </DynamicProvider>
    </QueryClientProvider>
  </StrictMode>,
);
