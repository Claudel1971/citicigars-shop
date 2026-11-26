import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const assetsBase = "/_vitrine-release/";
const storefront = "^/(?:(?:catalogue|panier|wishlist|checkout|coffrets|entreprises|evenements|devis)/?|(?:produit|p)/[A-Za-z0-9-]+/?)?$";

export default defineConfig(({ command }) => {
  if (command !== "build") throw new Error("La version de production est compilée pour une vérification isolée.");
  const directory = import.meta.dirname;
  const client = resolve(directory, "client");
  return {
    base: assetsBase,
    root: client,
    publicDir: false,
    envDir: false,
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify("https://citicigars-api.onrender.com"),
      "import.meta.env.VITE_STOREFRONT_RELEASE": JSON.stringify("1"),
    },
    resolve: { alias: { "@": resolve(client, "src"), "@assets": resolve(directory, "attached_assets") } },
    css: { postcss: { plugins: [] } },
    plugins: [react(), tailwindcss(), {
      name: "production-route-allowlist",
      generateBundle() {
        this.emitFile({
          type: "asset", fileName: "storefront-routes.json",
          source: JSON.stringify({ storefront }),
        });
      },
    }],
    build: {
      outDir: resolve(directory, "dist", "vitrine-production-candidate"),
      rollupOptions: { input: resolve(client, "vitrine-test.html") },
    },
  };
});
