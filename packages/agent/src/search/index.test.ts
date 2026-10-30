import { afterEach, describe, expect, it, vi } from 'vitest';

import { criarSearchProvider } from './index.js';

// fetch fake que serve aos dois provedores — o teste só olha qual URL foi chamada.
function stubFetch() {
  const fetchFake = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ organic: [], items: [] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchFake);
  return fetchFake;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('criarSearchProvider', () => {
  it('usa o Serper por padrão, quando SEARCH_PROVIDER não está definido', async () => {
    vi.stubEnv('SEARCH_PROVIDER', undefined);
    vi.stubEnv('SERPER_API_KEY', 'chave-serper');
    const fetchFake = stubFetch();

    await criarSearchProvider().search('q');

    expect(fetchFake.mock.calls[0][0]).toBe('https://google.serper.dev/search');
  });

  it('usa o Google Custom Search quando SEARCH_PROVIDER=google', async () => {
    vi.stubEnv('SEARCH_PROVIDER', 'google');
    vi.stubEnv('GOOGLE_CUSTOM_SEARCH_API_KEY', 'chave-google');
    vi.stubEnv('GOOGLE_CUSTOM_SEARCH_CX', 'cx-teste');
    const fetchFake = stubFetch();

    await criarSearchProvider().search('q');

    expect(fetchFake.mock.calls[0][0]).toContain('https://www.googleapis.com/customsearch/v1');
  });

  it('lança erro claro quando falta SERPER_API_KEY', () => {
    vi.stubEnv('SEARCH_PROVIDER', 'serper');
    vi.stubEnv('SERPER_API_KEY', undefined);

    expect(() => criarSearchProvider()).toThrow('SERPER_API_KEY');
  });

  it('lança erro claro quando falta o cx do Google Custom Search', () => {
    vi.stubEnv('SEARCH_PROVIDER', 'google');
    vi.stubEnv('GOOGLE_CUSTOM_SEARCH_API_KEY', 'chave-google');
    vi.stubEnv('GOOGLE_CUSTOM_SEARCH_CX', undefined);

    expect(() => criarSearchProvider()).toThrow('GOOGLE_CUSTOM_SEARCH_CX');
  });

  it('lança erro claro para provider desconhecido', () => {
    vi.stubEnv('SEARCH_PROVIDER', 'bing');

    expect(() => criarSearchProvider()).toThrow('SEARCH_PROVIDER desconhecido: "bing"');
  });

  it('protege o provedor real com retry: um 503 vira 3 tentativas', async () => {
    vi.useFakeTimers();
    vi.stubEnv('DEMO', undefined);
    vi.stubEnv('SEARCH_PROVIDER', 'serper');
    vi.stubEnv('SERPER_API_KEY', 'chave-serper');
    const fetchFake = vi.fn(() => Promise.resolve(new Response('{}', { status: 503 })));
    vi.stubGlobal('fetch', fetchFake);

    const busca = criarSearchProvider().search('q');
    const verificacao = expect(busca).rejects.toThrow('HTTP 503');
    // Avança os backoffs (500 ms + 1000 ms) sem esperar de verdade.
    await vi.runAllTimersAsync();
    await verificacao;

    expect(fetchFake).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
