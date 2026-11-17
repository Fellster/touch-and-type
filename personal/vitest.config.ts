import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "node", include: ["personal/src/**/*.test.ts"] },
});
