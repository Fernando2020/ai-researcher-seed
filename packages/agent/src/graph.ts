import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import type { RetrievedDoc } from './db/retrieve-similar.js';
import { makeGradeNode } from './nodes/grade.js';
import type { GradeLlmClient } from './nodes/grade.js';
import { makeRetrieveNode } from './nodes/retrieve.js';
import type { Buscar, EmbeddingsClient } from './nodes/retrieve.js';
import { makeWebSearchNode } from './nodes/web-search.js';
import type {
  BuscarPagina,
  DocumentEmbeddingsClient,
  SalvarDocumentosWeb,
} from './nodes/web-search.js';
import type { SearchProvider } from './search/search-provider.js';

// Quantas vezes o grade pode rodar. Na segunda resposta "insuficiente", o grafo termina mesmo
// assim — estourar o limite não é erro, é resposta com menos confiança.
export const MAX_ITERATIONS = 2;

// O estado é o contrato entre os nós: cada nó lê o que precisa e devolve só o que mudou.
export const ResearchState = Annotation.Root({
  question: Annotation<string>,
  // Reducer de substituição: cada passada do retrieve traz o conjunto inteiro de novo, já com
  // os documentos web que o webSearch acabou de salvar — acumular duplicaria documentos.
  documents: Annotation<RetrievedDoc[]>({
    reducer: (_anterior, novo) => novo,
    default: () => [],
  }),
  sufficient: Annotation<boolean>({
    reducer: (_anterior, novo) => novo,
    default: () => false,
  }),
  missingAspects: Annotation<string[]>({
    reducer: (_anterior, novo) => novo,
    default: () => [],
  }),
  // O grade devolve sempre `iterations: 1`; o reducer soma. Não há contador fora do estado.
  iterations: Annotation<number>({
    reducer: (anterior, novo) => anterior + novo,
    default: () => 0,
  }),
});

export type ResearchStateType = typeof ResearchState.State;

// O grafo recebe funções e clientes mínimos, nunca o banco ou o SDK direto — nos testes, todos
// viram fakes, e o grafo inteiro roda sem rede nem Postgres.
export interface GraphDeps {
  // Um cliente só serve aos dois nós: o retrieve embeda a pergunta, o webSearch embeda os chunks.
  embeddings: EmbeddingsClient & DocumentEmbeddingsClient;
  buscar: Buscar;
  gradeLlm: GradeLlmClient;
  searchProvider: SearchProvider;
  buscarPagina: BuscarPagina;
  salvarDocumentosWeb: SalvarDocumentosWeb;
}

// A decisão de rota vive aqui, não dentro do grade: o nó só produz o dado, a aresta lê.
export function decidirAposGrade(state: ResearchStateType): 'webSearch' | typeof END {
  if (state.sufficient) return END;
  if (state.iterations >= MAX_ITERATIONS) return END;
  return 'webSearch';
}

export function buildGraph(deps: GraphDeps) {
  return (
    new StateGraph(ResearchState)
      .addNode('retrieve', makeRetrieveNode(deps.embeddings, deps.buscar))
      .addNode('grade', makeGradeNode(deps.gradeLlm))
      .addNode(
        'webSearch',
        makeWebSearchNode({
          searchProvider: deps.searchProvider,
          buscarPagina: deps.buscarPagina,
          embeddings: deps.embeddings,
          salvar: deps.salvarDocumentosWeb,
        }),
      )
      .addEdge(START, 'retrieve')
      .addEdge('retrieve', 'grade')
      .addConditionalEdges('grade', decidirAposGrade, ['webSearch', END])
      // Depois de buscar na web, volta a recuperar: os trechos novos já estão no banco e
      // competem pela distância com o corpus CVM.
      .addEdge('webSearch', 'retrieve')
      .compile()
  );
}
