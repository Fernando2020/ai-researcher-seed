import { afterEach, describe, expect, it, vi } from 'vitest';

import { SearchProviderError } from './search-provider.js';
import { makeSerperProvider } from './serper.js';

// fetch fake: devolve a resposta pronta, sem sair pra rede.
function stubFetch(status: number, corpo: unknown) {
  const fetchFake = vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status }));
  vi.stubGlobal('fetch', fetchFake);
  return fetchFake;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('makeSerperProvider', () => {
  it('faz POST com a chave no header X-API-KEY e a query no corpo', async () => {
    const fetchFake = stubFetch(200, { organic: [] });

    await makeSerperProvider('chave-teste').search('lucro Vale');

    const [url, init] = fetchFake.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://google.serper.dev/search');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'X-API-KEY': 'chave-teste' });
    expect(JSON.parse(init.body as string)).toEqual({ q: 'lucro Vale' });
  });

  it('mapeia organic[] para SearchResult[]', async () => {
    stubFetch(200, {
      organic: [{ title: 'Vale lucra', link: 'https://exemplo.com/vale', snippet: 'Resumo' }],
    });

    const resultados = await makeSerperProvider('k').search('q');

    expect(resultados).toEqual([
      { title: 'Vale lucra', snippet: 'Resumo', url: 'https://exemplo.com/vale' },
    ]);
  });

  it('devolve lista vazia quando a resposta não tem organic', async () => {
    stubFetch(200, {});

    expect(await makeSerperProvider('k').search('q')).toEqual([]);
  });

  it('lança SearchProviderError quando a API responde com erro', async () => {
    stubFetch(403, { message: 'Unauthorized' });

    await expect(makeSerperProvider('k').search('q')).rejects.toThrow(SearchProviderError);
  });

  it('lança SearchProviderError quando a API não responde dentro do timeout', async () => {
    // fetch que nunca responde: só termina quando o signal do timeout aborta a requisição.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
          }),
      ),
    );

    await expect(makeSerperProvider('k', 20).search('q')).rejects.toThrow('sem resposta em 20 ms');
  });

  it('transforma falha de rede em SearchProviderError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(makeSerperProvider('k').search('q')).rejects.toThrow(SearchProviderError);
  });
});
