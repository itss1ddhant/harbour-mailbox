// Settings for the test runner (npm test).
//   alias "@"     lets tests import "@/server/..." the same way the app does
//   include       which files are tests
//   setupFiles    runs before each test file: points it at its own throwaway database
//   globalSetup   runs once: deletes the throwaway databases when all tests are done

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/global-setup.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
