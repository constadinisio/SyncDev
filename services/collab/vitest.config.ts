import { defineConfig } from "vitest/config";

export default defineConfig({
  // The source uses NodeNext-style ".js" import specifiers that point at ".ts"
  // files. Rewrite them so Vite can resolve modules during testing.
  resolve: {
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: "$1" }],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Focus the gate on the new, security-critical units. Broader coverage of
      // rooms/persistence/ws is tracked as follow-up work.
      include: [
        "src/lib/config.ts",
        "src/lib/validation.ts",
        "src/lib/rate-limit.ts",
        "src/lib/memberships.ts",
        "src/lib/auth.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
