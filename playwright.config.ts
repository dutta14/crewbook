import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 5173);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    env: { PORT: String(port) },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
