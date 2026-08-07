import { defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/build/**", "reference/upstream/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
