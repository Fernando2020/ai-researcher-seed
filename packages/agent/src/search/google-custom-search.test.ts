import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeGoogleCustomSearchProvider } from './google-custom-search.js';
import { SearchProviderError } from './search-provider.js';

// fetch fake: devolve a resposta pronta, sem sair pra rede.
function stubFetch(status: number, corpo: unknown) {
  const fetchFake = vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status }));
  vi.stubGlobal('fetch', fetchFake);
  return fetchFake;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('makeGoogleCustomSearchProvider', () => {
  it('faz GET com key, cx e q como query params', async () => {
    const fetchFake = stubFetch(200, { items: [] });

    await makeGoogleCustomSearchProvider('chave-teste', 'cx-teste').search('lucro Vale & cia');

    const url = new URL(fetchFake.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe('https://www.googleapis.com/customsearch/v1');
    expect(url.searchParams.get('key')).toBe('chave-teste');
    expect(url.searchParams.get('cx')).toBe('cx-teste');
    expect(url.searchParams.get('q')).toBe('lucro Vale & cia');
  });

  it('mapeia items[] para SearchResult[]', async () => {
    stubFetch(200, {
      items: [{ title: 'Vale lucra', link: 'https://exemplo.com/vale', snippet: 'Resumo' }],
    });

    const resultados = await makeGoogleCustomSearchProvider('k', 'cx').search('q');

    expect(resultados).toEqual([
      { title: 'Vale lucra', snippet: 'Resumo', url: 'https://exemplo.com/vale' },
    ]);
  });

  it('devolve lista vazia quando a API omite items (nenhum resultado)', async () => {
    stubFetch(200, { searchInformation: { totalResults: '0' } });

    expect(await makeGoogleCustomSearchProvider('k', 'cx').search('q')).toEqual([]);
  });

  it('lança SearchProviderError quando a API responde com erro', async () => {
    stubFetch(429, { error: { message: 'Quota exceeded' } });

    await expect(makeGoogleCustomSearchProvider('k', 'cx').search('q')).rejects.toThrow(
      SearchProviderError,
    );
  });
});
