import { makeDemoSearchProvider } from '../demo/search-demo.js';
import { makeGoogleCustomSearchProvider } from './google-custom-search.js';
import { comResiliencia } from './resiliencia.js';
import type { SearchProvider } from './search-provider.js';
import { makeSerperProvider } from './serper.js';

export { makeGoogleCustomSearchProvider } from './google-custom-search.js';
export { CircuitoAbertoError, comResiliencia } from './resiliencia.js';
export type { OpcoesResiliencia } from './resiliencia.js';
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
  // real — e nenhuma chave de API é exigida. Sem rede, não há o que proteger com retry nem
  // circuito: a fixture não passa pela camada de resiliência.
  if (process.env.DEMO === 'true') return makeDemoSearchProvider();

  const provider = process.env.SEARCH_PROVIDER ?? 'serper';

  // Os provedores reais saem daqui já protegidos: retry com backoff e circuit breaker.
  switch (provider) {
    case 'serper':
      return comResiliencia(makeSerperProvider(exigirVariavel('SERPER_API_KEY', provider)), {
        nome: 'Serper',
      });
    case 'google':
      return comResiliencia(
        makeGoogleCustomSearchProvider(
          exigirVariavel('GOOGLE_CUSTOM_SEARCH_API_KEY', provider),
          exigirVariavel('GOOGLE_CUSTOM_SEARCH_CX', provider),
        ),
        { nome: 'Google Custom Search' },
      );
    default:
      throw new Error(
        `SEARCH_PROVIDER desconhecido: "${provider}". Valores aceitos: serper, google.`,
      );
  }
}
