import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    // App tests live under convex/. The presenter Worker is a nested package
    // with its own deps (uqr) and `npm run qr:test` — do not pick it up here.
    include: ["convex/**/*.test.ts"],
    exclude: ["qr/**"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
