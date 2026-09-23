import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    proxy: { "/demo-api": { target: "http://127.0.0.1:8790", rewrite: (path) => path.replace(/^\/demo-api/, "") } },
  },
  build: {
    outDir: "dist",
  },
});
