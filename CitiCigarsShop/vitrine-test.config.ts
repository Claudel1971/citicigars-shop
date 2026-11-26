import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import testPrices from "./vitrine-test-prices.json";

const apiPath = /^\/api\/products(?:\/[a-z0-9-]+)?$/i;
const pagePath = /^\/(?:catalogue|wishlist|panier|(?:produit|p)\/[^/]+)?\/?$/;

type Product = { sku?: string };
type ProductResponse = Product & { product?: Product };

function applyTestPrices(product: Product) {
  const sku = product?.sku;
  return sku && Object.hasOwn(testPrices, sku)
    ? { ...product, ...testPrices[sku as keyof typeof testPrices] }
    : product;
}

function applyCataloguePrices(data: ProductResponse | Product[]) {
  if (Array.isArray(data)) return data.map(applyTestPrices);
  return data?.product ? { ...data, product: applyTestPrices(data.product) } : applyTestPrices(data);
}

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
        server.middlewares.use(async (req, res, next) => {
          const { pathname: path, search } = new URL(req.url || "/", "http://localhost");
          if (path.startsWith("/api/")) {
            if (req.method !== "GET" || !apiPath.test(path)) {
              res.writeHead(405).end();
              return;
            }
            const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
            try {
              const response = await fetch(new URL(path + search, endpoint), {
                cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
              });
              if (!response.ok) {
                res.writeHead(response.status, headers).end(JSON.stringify({ error: "Catalogue indisponible" }));
                return;
              }
              const data = await response.json() as ProductResponse | Product[];
              res.writeHead(response.status, headers).end(JSON.stringify(applyCataloguePrices(data)));
            } catch {
              res.writeHead(502, headers).end(JSON.stringify({ error: "Catalogue indisponible" }));
            }
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
    },
  };
});
