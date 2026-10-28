export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

// O nó webSearch só conhece esta interface. Quem implementa (Serper, Custom Search, o fake dos
// testes) é escolhido fora do nó — trocar de provedor não muda uma linha do grafo.
export interface SearchProvider {
  search(query: string): Promise<SearchResult[]>;
}

// Resposta de erro de qualquer provedor vira este mesmo erro, com o nome do provedor — quem
// trata (retry, degradação graciosa) não precisa conhecer cada API.
export class SearchProviderError extends Error {
  constructor(provider: string, detalhe: string) {
    super(`Busca no ${provider} falhou: ${detalhe}`);
    this.name = 'SearchProviderError';
  }
}
