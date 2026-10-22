import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/ui',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4317', viewport: { width: 960, height: 680 } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 960, height: 680 } } }],
  webServer: {
    command: 'npm run build && npx vite preview --port 4317 --strictPort',
    url: 'http://localhost:4317',
    // Never adopt a server that is already listening: it may be another project's.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
