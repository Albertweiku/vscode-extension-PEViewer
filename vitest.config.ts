import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/unit/**/*.test.ts"],
    globals: true,
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      include: [
        "src/common/**/*.ts",
        "src/parsers/**/*.ts",
      ],
      exclude: [
        "src/**/*.d.ts",
        "src/test/**",
      ],
    },
  },
  resolve: {
    alias: {
      vscode: "src/test/helpers/__mocks__/vscode.ts",
    },
  },
});
