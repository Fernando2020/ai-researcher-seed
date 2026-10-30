import type { SearchProvider, SearchResult } from '../search/search-provider.js';
import { FIXTURE_GENERICA, FIXTURES_DEMO } from './fixtures.js';
import type { FixtureDemo } from './fixtures.js';

// Minúsculas e sem acento: "Petróbras", "PETR4" e "petrobras" caem nas mesmas chaves.
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function escolherFixture(query: string): FixtureDemo {
  const normalizada = normalizar(query);
  return (
    FIXTURES_DEMO.find((fixture) => fixture.chaves.some((chave) => normalizada.includes(chave))) ??
    FIXTURE_GENERICA
  );
}

// Implementa a mesma interface que o Serper: o nó webSearch não sabe que está em modo demo.
export function makeDemoSearchProvider(): SearchProvider {
  return {
    search(query: string): Promise<SearchResult[]> {
      const resultados = escolherFixture(query).resultados.map(({ title, snippet, url }) => ({
        title,
        snippet,
        url,
      }));
      return Promise.resolve(resultados);
    },
  };
}

// Mesmo contrato do buscarHtml: recebe a URL, devolve o HTML. URL sem fixture recebe a página
// genérica — no modo demo, nenhuma página "cai".
export function buscarPaginaDemo(url: string): Promise<string> {
  const todos = [...FIXTURES_DEMO, FIXTURE_GENERICA].flatMap((fixture) => fixture.resultados);
  const encontrado = todos.find((resultado) => resultado.url === url);
  return Promise.resolve((encontrado ?? FIXTURE_GENERICA.resultados[0]).html);
}
