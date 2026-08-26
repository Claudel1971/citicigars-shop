import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Config dédiée aux tests serveur : vite.config.ts fixe root="client" pour
// le build front, ce qui empêche vitest de trouver server/**/*.test.ts s'il
// hérite de ce fichier. On isole donc explicitement la racine ici.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./client/src", import.meta.url)) },
  },
  test: {
    include: ["server/**/*.test.ts", "scripts/**/*.test.ts", "shared/**/*.test.ts", "client/src/**/*.test.ts", "client/src/**/*.test.tsx"],
    environment: "node",
  },
});
