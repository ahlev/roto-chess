import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    // The PGlite harness boots a full Postgres; give it room.
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
