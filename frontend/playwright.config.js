import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const backendCommand =
  process.env.E2E_BACKEND_COMMAND ||
  "..\\.venv\\Scripts\\python.exe ../backend/e2e_server.py";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: backendCommand,
      url: "http://127.0.0.1:8010/health/ready",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        APP_ENV: "test",
        CORS_ORIGINS: "http://127.0.0.1:4173",
        RESEND_API_KEY: "",
        SMTP_HOST: "",
      },
    },
    {
      command:
        "npm run dev -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_BASE_URL: "http://127.0.0.1:8010",
      },
    },
  ],
});
