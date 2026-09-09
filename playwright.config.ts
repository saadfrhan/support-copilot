import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  use: { headless: true, channel: "chromium", baseURL: "http://127.0.0.1:3100" },
  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://127.0.0.1:3100",
    env: { GOOGLE_API_KEY: "", DATABASE_URL: "" },
    reuseExistingServer: false,
    timeout: 120000,
  },
});
