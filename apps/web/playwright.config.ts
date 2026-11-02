import { defineConfig, devices } from '@playwright/test';

// Portas próprias, para o teste não conflitar com um `pnpm dev` aberto (3000 e 4200).
const PORTA_API = 3101;
const PORTA_WEB = 4301;

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  forbidOnly: !!process.env['CI'],
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORTA_WEB}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  // Os dois servidores reais. A API sobe do build: `pnpm test:e2e`, na raiz, builda antes.
  webServer: [
    {
      name: 'api',
      command: 'node dist/index.js',
      cwd: '../api',
      url: `http://127.0.0.1:${PORTA_API}/api/health`,
      reuseExistingServer: false,
      env: {
        DEMO: 'true',
        PORT: String(PORTA_API),
        // Em DEMO o grafo não toca no banco. O endereço inválido garante que isso continue verdade.
        DATABASE_URL: 'postgresql://ninguem:x@127.0.0.1:1/nada',
      },
    },
    {
      name: 'web',
      // Direto pelo binário do CLI, para não depender do gerenciador de pacotes no caminho.
      command: `node node_modules/@angular/cli/bin/ng.js serve --port ${PORTA_WEB} --proxy-config proxy.e2e.conf.json`,
      url: `http://localhost:${PORTA_WEB}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
