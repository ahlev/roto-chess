import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Property-based playouts and perft are CPU-bound; give them room.
    testTimeout: 60_000,
  },
});
