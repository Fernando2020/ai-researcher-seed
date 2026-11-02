import { afterEach, describe, expect, it, vi } from 'vitest';
import { build } from './app.js';

function postChat(app: ReturnType<typeof build>, ip?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/chat',
    payload: {},
    ...(ip ? { headers: { 'x-forwarded-for': ip } } : {}),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('rate limit global', () => {
  it('passando do limite, responde 429 em problem+json com Retry-After', async () => {
    vi.stubEnv('RATE_LIMIT_MAX', '2');
    const app = build();

    await postChat(app);
    await postChat(app);
    const response = await postChat(app);

    expect(response.statusCode).toBe(429);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.headers['retry-after']).toBeDefined();
    expect(response.json()).toMatchObject({ status: 429, title: 'Muitas requisições' });
  });

  it('vale também para o gateway MCP', async () => {
    vi.stubEnv('RATE_LIMIT_MAX', '1');
    const app = build();

    await app.inject({ method: 'GET', url: '/api/mcp' });
    const response = await app.inject({ method: 'GET', url: '/api/mcp' });

    expect(response.statusCode).toBe(429);
  });

  it('lê a variável de ambiente a cada build, não no import', async () => {
    vi.stubEnv('RATE_LIMIT_MAX', '1');
    const estreita = build();
    await postChat(estreita);
    expect((await postChat(estreita)).statusCode).toBe(429);

    vi.stubEnv('RATE_LIMIT_MAX', '5');
    const larga = build();
    await postChat(larga);
    expect((await postChat(larga)).statusCode).toBe(400);
  });

  it('não limita /health nem /metrics', async () => {
    vi.stubEnv('RATE_LIMIT_MAX', '1');
    const app = build({ checkDatabase: () => Promise.resolve(true) });

    for (let i = 0; i < 3; i++) {
      expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/api/metrics' })).statusCode).toBe(200);
    }
  });

  it('não sobe com configuração inválida', () => {
    vi.stubEnv('RATE_LIMIT_MAX', 'abc');

    expect(() => build()).toThrow('RATE_LIMIT_MAX');
  });

  it('com um salto de proxy confiável, separa os clientes pelo X-Forwarded-For', async () => {
    vi.stubEnv('RATE_LIMIT_MAX', '1');
    vi.stubEnv('TRUST_PROXY_HOPS', '1');
    const app = build();

    await postChat(app, '203.0.113.1');

    expect((await postChat(app, '203.0.113.1')).statusCode).toBe(429);
    expect((await postChat(app, '203.0.113.2')).statusCode).toBe(400);
  });

  it('forjar um valor à esquerda do X-Forwarded-For não troca de cliente', async () => {
    vi.stubEnv('RATE_LIMIT_MAX', '1');
    vi.stubEnv('TRUST_PROXY_HOPS', '1');
    const app = build();

    await postChat(app, '203.0.113.1');
    const forjada = await postChat(app, '198.51.100.9, 203.0.113.1');

    expect(forjada.statusCode).toBe(429);
  });

  it('sem saltos confiáveis, ignora o X-Forwarded-For', async () => {
    vi.stubEnv('RATE_LIMIT_MAX', '1');
    const app = build();

    await postChat(app, '203.0.113.1');

    expect((await postChat(app, '203.0.113.2')).statusCode).toBe(429);
  });
});
