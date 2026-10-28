export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// O nó webSearch só conhece esta interface. Quem implementa (Serper, Custom Search, o fake dos
// testes) é escolhido fora do nó — trocar de provedor não muda uma linha do grafo.
export interface SearchProvider {
  search(query: string): Promise<SearchResult[]>;
}
