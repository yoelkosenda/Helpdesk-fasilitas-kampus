const { defineConfig } = require('@playwright/test');
require('dotenv').config();

module.exports = defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.js/,
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: [
    {
      command: 'node tests/e2e-server.js',
      port: 3100,
      reuseExistingServer: false,
      env: {
        ...process.env,
        PORT: '3100',
        SEED_PASSWORD: process.env.SEED_PASSWORD || 'e2e-seed-password-123',
        AKTIFKAN_SCHEDULER: 'false',
        UPLOAD_DIR: 'tests/tmp/e2e-uploads',
      },
    },
    {
      command: 'npm --prefix frontend run dev -- --port 5174 --strictPort',
      port: 5174,
      reuseExistingServer: false,
      env: {
        ...process.env,
        VITE_API_BASE_URL: 'http://localhost:3100/api',
      },
    },
  ],
});
