import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const apiPath = /^\/api\/products(?:\/[a-z0-9-]+)?$/i;
const pagePath = /^\/(?:catalogue|wishlist|panier|(?:produit|p)\/[^/]+)?\/?$/;

export default defineConfig(({ command }) => {
  if (command !== "serve") throw new Error("Cette copie est réservée aux tests locaux.");
  const target = process.env.CITICIGARS_TEST_API || "https://citicigars-api.onrender.com";
  const endpoint = new URL(target);
  if (process.env.CITICIGARS_TEST_API && !["localhost", "127.0.0.1"].includes(endpoint.hostname)) {
    throw new Error("L’API simulée doit être locale.");
  }
  return {
    root: resolve(import.meta.dirname, "client"),
    envDir: false,
    resolve: { alias: { "@": resolve(import.meta.dirname, "client/src") } },
    css: { postcss: { plugins: [] } },
    optimizeDeps: { entries: ["vitrine-test.html"] },
    plugins: [react(), {
      name: "citicigars-vitrine-test",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = new URL(req.url || "/", "http://localhost").pathname;
          if (path.startsWith("/api/") && (req.method !== "GET" || !apiPath.test(path))) {
            res.writeHead(405).end();
            return;
          }
          if (req.headers.accept?.includes("text/html") && !pagePath.test(path)) {
            res.writeHead(404).end("Parcours hors de la copie de test.");
            return;
          }
          if (req.headers.accept?.includes("text/html")) {
            req.url = "/vitrine-test.html";
          }
          next();
        });
      },
    }],
    server: {
      host: "127.0.0.1",
      allowedHosts: ["localhost"],
      proxy: { "^/api/products(?:/[a-zA-Z0-9-]+|\\?|$)": { target, changeOrigin: true } },
    },
  };
});
