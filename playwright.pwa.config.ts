import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "pwa.spec.ts",
  outputDir: "test-results-pwa",
  timeout: 30000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5179", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop-pwa",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile-pwa",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command:
      "npm run build && npx vite preview --host 127.0.0.1 --port 5179 --strictPort",
    url: "http://127.0.0.1:5179",
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      VITE_BACKEND_ENABLED: "true",
      VITE_SUPABASE_URL: "https://test.supabase.co",
      VITE_SUPABASE_ANON_KEY: "sb_publishable_test",
    },
  },
});
