import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["server/src/__tests__/paperclip-babysit-reconciliation.test.ts", "scripts/paperclip-babysit-reconciliation-provenance.test.mjs"],
  },
});
