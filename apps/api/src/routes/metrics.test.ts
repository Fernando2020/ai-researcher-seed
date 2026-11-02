import { describe, expect, it } from 'vitest';
import { build } from '../app.js';

describe('GET /api/metrics', () => {
  it('devolve o texto do registry, com o Content-Type dele', async () => {
    const app = build({
      registroDeMetricas: {
        contentType: 'text/plain; version=0.0.4; charset=utf-8',
        metrics: () => Promise.resolve('llm_tokens_total 42\n'),
      },
    });

    const response = await app.inject({ method: 'GET', url: '/api/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/plain; version=0.0.4; charset=utf-8');
    expect(response.body).toBe('llm_tokens_total 42\n');
  });

  it('por padrão, usa o registry do agent, com as duas métricas declaradas', async () => {
    const response = await build().inject({ method: 'GET', url: '/api/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('# TYPE llm_tokens_total counter');
    expect(response.body).toContain('# TYPE llm_cost_usd_total counter');
  });

  it('falha do registry vira problem+json, sem vazar o detalhe', async () => {
    const app = build({
      registroDeMetricas: {
        contentType: 'text/plain',
        metrics: () => Promise.reject(new Error('detalhe interno')),
      },
    });

    const response = await app.inject({ method: 'GET', url: '/api/metrics' });

    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body).not.toContain('detalhe interno');
  });
});
