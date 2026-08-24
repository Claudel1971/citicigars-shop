import { defineConfig } from "vitest/config";

// Config dédiée aux tests serveur : vite.config.ts fixe root="client" pour
// le build front, ce qui empêche vitest de trouver server/**/*.test.ts s'il
// hérite de ce fichier. On isole donc explicitement la racine ici.
export default defineConfig({
  test: {
    include: ["server/**/*.test.ts", "scripts/**/*.test.ts", "shared/**/*.test.ts"],
    environment: "node",
  },
});
