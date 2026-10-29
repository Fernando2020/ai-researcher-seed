import { db } from './db/client.js';
import { buscarDocumentosSimilares } from './db/retrieve-similar.js';
import { salvarDocumentosWeb } from './db/save-web-documents.js';
import { criarEmbeddingsReal } from './embeddings.js';
import { buildGraph } from './graph.js';
import { criarChatModelReal } from './llm.js';
import { criarSearchProvider } from './search/index.js';
import { buscarHtml } from './web/fetch-html.js';

// O único lugar que liga o grafo às dependências reais: Vertex AI, Postgres, busca web.
// Lança erro se faltar configuração (GOOGLE_CLOUD_PROJECT_ID, SERPER_API_KEY...) — quem chama
// decide o que fazer com isso.
export function criarGrafoReal() {
  return buildGraph({
    embeddings: criarEmbeddingsReal(),
    buscar: (embedding, k) => buscarDocumentosSimilares(db, embedding, k),
    gradeLlm: criarChatModelReal(process.env.MODEL_GRADE ?? 'gemini-3.5-flash-lite'),
    searchProvider: criarSearchProvider(),
    buscarPagina: buscarHtml,
    salvarDocumentosWeb: (documentos) => salvarDocumentosWeb(db, documentos),
    answerLlm: criarChatModelReal(process.env.MODEL_ANSWER ?? 'gemini-3.6-flash'),
  });
}
