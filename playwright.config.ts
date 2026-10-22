import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/ui',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173', viewport: { width: 960, height: 680 } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 960, height: 680 } } }],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
