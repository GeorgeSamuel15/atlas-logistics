import { defineConfig } from '@playwright/test';
import path from 'node:path';
export default defineConfig({
    testDir: 'tests/browser', fullyParallel: false, workers: 1, timeout: 45000,
    use: { baseURL: 'http://127.0.0.1:4020', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', launchOptions: process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {} },
    webServer: { command: 'npm run setup && npm run build && npm start', url: 'http://127.0.0.1:4020/api/health', reuseExistingServer: false, timeout: 120000, env: { PORT: '4020', DB_PATH: path.resolve('data/browser-tests.sqlite'), APP_ORIGINS: 'http://127.0.0.1:4020' } },
});
