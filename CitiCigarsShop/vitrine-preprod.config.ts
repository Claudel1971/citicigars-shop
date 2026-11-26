import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const base = "/essai-vitrine/";
const stagingApi = "https://citicigars-api-staging.onrender.com";

export default defineConfig(() => {
  const directory = import.meta.dirname;
  const client = resolve(directory, "client");
  return {
    base,
    root: client,
    publicDir: false,
    envDir: false,
    define: { "import.meta.env.VITE_API_URL": JSON.stringify(stagingApi) },
    resolve: { alias: { "@": resolve(client, "src"), "@assets": resolve(directory, "attached_assets") } },
    css: { postcss: { plugins: [] } },
    plugins: [react(), tailwindcss(), {
      name: "confine-vitrine-preview",
      generateBundle() {
        this.emitFile({
          type: "asset", fileName: ".htaccess",
          source: [
            "DirectoryIndex vitrine-test.html",
            "Options -Indexes",
            "RewriteEngine On",
            "RewriteBase " + base,
            "RewriteCond %{REQUEST_FILENAME} !-f",
            "RewriteCond %{REQUEST_FILENAME} !-d",
            "RewriteRule ^ vitrine-test.html [L]",
            "",
          ].join("\n"),
        });
      },
    }],
    build: {
      outDir: resolve(directory, "dist", "essai-vitrine"),
      rollupOptions: { input: resolve(client, "vitrine-test.html") },
    },
  };
});
