import { z } from 'zod';

import { SearchProviderError } from './search-provider.js';
import type { SearchProvider, SearchResult } from './search-provider.js';

const CUSTOM_SEARCH_URL = 'https://www.googleapis.com/customsearch/v1';

// Sem resultados, a API omite `items` em vez de devolver lista vazia.
const customSearchResponseSchema = z.object({
  items: z
    .array(z.object({ title: z.string(), link: z.string(), snippet: z.string().default('') }))
    .default([]),
});

// `cx` é o ID do mecanismo de busca programável, criado no console do Google.
export function makeGoogleCustomSearchProvider(apiKey: string, cx: string): SearchProvider {
  return {
    async search(query: string): Promise<SearchResult[]> {
      // URLSearchParams faz o encoding da query (espaços, acentos, `&`).
      const params = new URLSearchParams({ key: apiKey, cx, q: query });
      const resposta = await fetch(`${CUSTOM_SEARCH_URL}?${params.toString()}`);
      if (!resposta.ok) {
        throw new SearchProviderError('Google Custom Search', `HTTP ${resposta.status}`);
      }

      const { items } = customSearchResponseSchema.parse(await resposta.json());
      return items.map((item) => ({ title: item.title, snippet: item.snippet, url: item.link }));
    },
  };
}
