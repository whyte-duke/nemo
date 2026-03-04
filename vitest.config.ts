import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    alias: {
      // Mock Next.js server-only guard — not available in test environment
      "server-only": path.resolve(__dirname, "src/__tests__/__mocks__/server-only.ts"),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Mock Next.js server-only guard — not available in test environment
      "server-only": path.resolve(__dirname, "src/__tests__/__mocks__/server-only.ts"),
    },
  },
});
