import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist/client",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
    // Prevent the Vite dev client from full-reloading the page during playback.
    hmr: false,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        // Disable timeout for long-running video streams
        timeout: 0,
        configure: (proxy) => {
          // Per http-proxy docs: if you listen for "error", you MUST handle
          // the response yourself. An empty handler leaves the socket dangling,
          // which can crash Vite's HTTP server and trigger a full HMR page reload.
          proxy.on("error", (_err, _req, res) => {
            try {
              if ("writeHead" in res && !res.headersSent) {
                res.writeHead(502, { "Content-Type": "text/plain" });
              }
              res.end();
            } catch {
              // Already closed — nothing to do
            }
          });
        },
      },
      "/downloads": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
