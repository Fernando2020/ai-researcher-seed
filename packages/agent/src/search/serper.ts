import { z } from 'zod';

import { SearchProviderError } from './search-provider.js';
import type { SearchProvider, SearchResult } from './search-provider.js';

const SERPER_URL = 'https://google.serper.dev/search';

// Só os campos que usamos. A resposta é validada na fronteira: se o Serper mudar o formato,
// o erro aparece aqui, com mensagem clara, e não como `undefined` lá no nó.
const serperResponseSchema = z.object({
  organic: z
    .array(z.object({ title: z.string(), link: z.string(), snippet: z.string().default('') }))
    .default([]),
});

export function makeSerperProvider(apiKey: string): SearchProvider {
  return {
    async search(query: string): Promise<SearchResult[]> {
      const resposta = await fetch(SERPER_URL, {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query }),
      });
      if (!resposta.ok) {
        throw new SearchProviderError('Serper', `HTTP ${resposta.status}`);
      }

      const { organic } = serperResponseSchema.parse(await resposta.json());
      return organic.map((item) => ({ title: item.title, snippet: item.snippet, url: item.link }));
    },
  };
}
