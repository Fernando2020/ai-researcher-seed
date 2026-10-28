import type { NovoDocumentoWeb } from '../db/save-web-documents.js';
import type { SearchProvider } from '../search/search-provider.js';
import { emLotes } from '../seed/lotes.js';
import { dividirEmChunks } from '../web/chunk.js';
import { extrairTexto } from '../web/extract-text.js';

const RESULTADOS_POR_QUERY = 3;
const TTL_DIAS_PADRAO = 7;
const TAMANHO_LOTE_EMBEDDING = 10;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

// Só a parte do estado que este nó lê.
export interface WebSearchState {
  question: string;
  missingAspects: string[];
}

export interface DocumentEmbeddingsClient {
  embedDocuments(texts: string[]): Promise<number[][]>;
}

export type BuscarPagina = (url: string) => Promise<string>;
export type SalvarDocumentosWeb = (documentos: NovoDocumentoWeb[]) => Promise<void>;

export interface WebSearchDeps {
  searchProvider: SearchProvider;
  buscarPagina: BuscarPagina;
  embeddings: DocumentEmbeddingsClient;
  salvar: SalvarDocumentosWeb;
  ttlDias?: number;
}

// Uma busca por aspecto faltante: o grade já disse o que falta, e buscar cada lacuna
// separadamente traz resultados mais focados que uma busca única com tudo junto.
export function montarQueries(question: string, missingAspects: string[]): string[] {
  if (missingAspects.length === 0) return [question];
  return missingAspects.map((aspecto) => `${question} ${aspecto}`);
}

export function makeWebSearchNode({
  searchProvider,
  buscarPagina,
  embeddings,
  salvar,
  ttlDias = TTL_DIAS_PADRAO,
}: WebSearchDeps) {
  return async (state: WebSearchState) => {
    // Aspectos diferentes podem trazer a mesma página — ela só é processada uma vez.
    const urlsVistas = new Set<string>();

    for (const query of montarQueries(state.question, state.missingAspects)) {
      const resultados = await searchProvider.search(query);

      for (const resultado of resultados.slice(0, RESULTADOS_POR_QUERY)) {
        if (urlsVistas.has(resultado.url)) continue;
        urlsVistas.add(resultado.url);

        let html: string;
        try {
          html = await buscarPagina(resultado.url);
        } catch {
          // Página fora do ar ou lenta demais: perde-se um resultado, não a busca inteira.
          continue;
        }

        const chunks = dividirEmChunks(extrairTexto(html));
        if (chunks.length === 0) continue;

        const fetchedAt = new Date();
        const expiresAt = new Date(fetchedAt.getTime() + ttlDias * UM_DIA_MS);

        for (const lote of emLotes(chunks, TAMANHO_LOTE_EMBEDDING)) {
          const vetores = await embeddings.embedDocuments(lote);
          await salvar(
            lote.map((content, indice) => ({
              query,
              title: resultado.title,
              content,
              sourceUrl: resultado.url,
              fetchedAt,
              expiresAt,
              embedding: vetores[indice],
            })),
          );
        }
      }
    }

    // O resultado deste nó fica no banco, não no estado: o retrieve da próxima iteração
    // encontra os trechos novos pela busca por similaridade.
    return {};
  };
}
