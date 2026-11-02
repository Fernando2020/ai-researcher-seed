import { db } from './db/client.js';
import { buscarDocumentosSimilares } from './db/retrieve-similar.js';
import { salvarDocumentosWeb } from './db/save-web-documents.js';
import { criarAnswerLlmDemo, criarBuscarDemo, criarGradeLlmDemo } from './demo/grafo-demo.js';
import { criarEmbeddings } from './embeddings.js';
import { buildGraph } from './graph.js';
import { criarChatModelReal } from './llm.js';
import { criarSearchProvider } from './search/index.js';
import { criarBuscarPagina } from './web/criar-buscar-pagina.js';

// O único lugar que liga o grafo às dependências reais: Vertex AI, Postgres, busca web.
// Lança erro se faltar configuração (GOOGLE_CLOUD_PROJECT_ID, SERPER_API_KEY...) — quem chama
// decide o que fazer com isso. Com DEMO=true, o grafo inteiro vira fixture: nada de Vertex AI,
// Postgres ou busca web, e nenhuma credencial é exigida.
export function criarGrafoReal() {
  const demo = process.env.DEMO === 'true';

  return buildGraph({
    embeddings: criarEmbeddings(),
    buscar: demo
      ? criarBuscarDemo()
      : (embedding, k) => buscarDocumentosSimilares(db, embedding, k),
    gradeLlm: demo
      ? criarGradeLlmDemo()
      : criarChatModelReal(process.env.MODEL_GRADE ?? 'gemini-3.5-flash-lite'),
    searchProvider: criarSearchProvider(),
    buscarPagina: criarBuscarPagina(),
    // Em demo o grade sempre aprova, então o webSearch não roda; e, se rodasse, não grava nada.
    salvarDocumentosWeb: demo
      ? () => Promise.resolve()
      : (documentos) => salvarDocumentosWeb(db, documentos),
    answerLlm: demo
      ? criarAnswerLlmDemo()
      : criarChatModelReal(process.env.MODEL_ANSWER ?? 'gemini-3.6-flash'),
  });
}

// Uma instância por processo: o circuito do SearchProvider e os clientes da Vertex AI são
// compartilhados por todas as chamadas. Construída na primeira chamada, não no import — um
// processo que nunca recebe pergunta (o servidor MCP só listando tools, por exemplo) não abre
// conexão nem exige credencial. Se a construção falhar (falta configuração), nada é guardado e
// a próxima chamada tenta de novo.
let grafoReal: ReturnType<typeof criarGrafoReal> | undefined;

export function obterGrafoReal(): ReturnType<typeof criarGrafoReal> {
  grafoReal ??= criarGrafoReal();
  return grafoReal;
}
