import { makeDemoSearchProvider } from '../demo/search-demo.js';
import { makeGoogleCustomSearchProvider } from './google-custom-search.js';
import type { SearchProvider } from './search-provider.js';
import { makeSerperProvider } from './serper.js';

export { makeGoogleCustomSearchProvider } from './google-custom-search.js';
export { SearchProviderError } from './search-provider.js';
export type { SearchProvider, SearchResult } from './search-provider.js';
export { makeSerperProvider } from './serper.js';

// Lê uma variável obrigatória — falhar na inicialização é melhor que falhar na primeira busca.
function exigirVariavel(nome: string, provider: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`SEARCH_PROVIDER=${provider} exige a variável de ambiente ${nome}.`);
  }
  return valor;
}

// O provedor é escolhido por variável de ambiente, não no código: trocar Serper por Custom
// Search é uma mudança de configuração.
export function criarSearchProvider(): SearchProvider {
  // Único ponto que lê DEMO pra busca: com DEMO=true, as fixtures entram no lugar do provedor
  // real — e nenhuma chave de API é exigida.
  if (process.env.DEMO === 'true') return makeDemoSearchProvider();

  const provider = process.env.SEARCH_PROVIDER ?? 'serper';

  switch (provider) {
    case 'serper':
      return makeSerperProvider(exigirVariavel('SERPER_API_KEY', provider));
    case 'google':
      return makeGoogleCustomSearchProvider(
        exigirVariavel('GOOGLE_CUSTOM_SEARCH_API_KEY', provider),
        exigirVariavel('GOOGLE_CUSTOM_SEARCH_CX', provider),
      );
    default:
      throw new Error(
        `SEARCH_PROVIDER desconhecido: "${provider}". Valores aceitos: serper, google.`,
      );
  }
}
