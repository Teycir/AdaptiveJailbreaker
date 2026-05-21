import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
  },
  resolve: {
    alias: {
      "@ajar/types": new URL("../types/src/index.ts", import.meta.url).pathname,
    },
  },
});
