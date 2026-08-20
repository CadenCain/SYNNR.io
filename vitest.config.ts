import { defineConfig } from "vitest/config";
import path from "node:path";

// Mirrors tsconfig's "@/*" path alias so tests can exercise real app modules
// (server actions and friends) instead of only the lib/ layer.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
});
