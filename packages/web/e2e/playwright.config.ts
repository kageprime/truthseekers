import { defineConfig } from "@playwright/test";

import path from "path";
import { defineConfig } from "@playwright/test";

const webRoot = path.resolve(__dirname, "..");

export default defineConfig({
  testDir: ".",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx next dev --port 3001",
    port: 3001,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
    cwd: webRoot,
  },
});
