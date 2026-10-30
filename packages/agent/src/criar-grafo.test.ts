import { afterEach, describe, expect, it, vi } from 'vitest';

import { obterGrafoReal } from './criar-grafo.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

// Construir os clientes da Vertex AI e do Serper não faz chamada de rede — só a primeira
// pergunta faria. Por isso dá pra testar a memoização com credenciais de mentira.
describe('obterGrafoReal', () => {
  it('quando falta configuração, lança e não guarda nada', () => {
    vi.stubEnv('GOOGLE_CLOUD_PROJECT_ID', undefined);

    expect(() => obterGrafoReal()).toThrow('GOOGLE_CLOUD_PROJECT_ID');
  });

  it('com a configuração presente, constrói uma vez e devolve sempre a mesma instância', () => {
    vi.stubEnv('GOOGLE_CLOUD_PROJECT_ID', 'projeto-de-teste');
    vi.stubEnv('DEMO', undefined);
    vi.stubEnv('SEARCH_PROVIDER', 'serper');
    vi.stubEnv('SERPER_API_KEY', 'chave-de-teste');

    const primeiro = obterGrafoReal();
    const segundo = obterGrafoReal();

    expect(segundo).toBe(primeiro);
  });
});
