import type { RetrievedDoc } from '@hero/agent';

// O que a interface precisa pra mostrar um documento no painel do grafo — não o parágrafo
// inteiro nem o embedding, que só pesariam no stream.
export interface DocumentoResumido {
  origem: 'cvm' | 'web';
  rotulo: string;
  sourceUrl: string;
  distance: number;
}

// Um evento por nó concluído. O campo `type` diz qual nó terminou, e o resto é o que mudou.
export type ChatEvent =
  | { type: 'retrieve'; documents: DocumentoResumido[] }
  | { type: 'grade'; sufficient: boolean; missingAspects: string[]; iterations: number }
  | { type: 'webSearch' }
  | { type: 'answer'; response: string }
  | { type: 'error'; message: string };

// O que cada nó devolve no `stream({ streamMode: 'updates' })`: só os campos que ele mudou.
export interface GraphUpdate {
  documents?: RetrievedDoc[];
  sufficient?: boolean;
  missingAspects?: string[];
  iterations?: number;
  response?: string;
}

// Cada chunk do stream é `{ nomeDoNo: update }`.
export type GraphChunk = Record<string, GraphUpdate | null | undefined>;

function resumirDocumento(doc: RetrievedDoc): DocumentoResumido {
  return {
    origem: doc.origem,
    rotulo: doc.origem === 'cvm' ? `${doc.ticker} ${doc.period}` : doc.title,
    sourceUrl: doc.sourceUrl,
    distance: doc.distance,
  };
}

// Traduz o stream do grafo em eventos tipados. Guarda um único dado entre chunks: o total de
// iterações — o grade devolve só o incremento (sempre 1), e a soma do reducer fica dentro do
// grafo, invisível pro modo 'updates'.
export async function* paraEventos(chunks: AsyncIterable<GraphChunk>): AsyncGenerator<ChatEvent> {
  let iterations = 0;

  for await (const chunk of chunks) {
    for (const [no, valor] of Object.entries(chunk)) {
      const update = valor ?? {};

      switch (no) {
        case 'retrieve':
          yield { type: 'retrieve', documents: (update.documents ?? []).map(resumirDocumento) };
          break;
        case 'grade':
          iterations += update.iterations ?? 0;
          yield {
            type: 'grade',
            sufficient: update.sufficient ?? false,
            missingAspects: update.missingAspects ?? [],
            iterations,
          };
          break;
        case 'webSearch':
          // O resultado do webSearch fica no banco, não no estado: o evento só marca a passagem.
          yield { type: 'webSearch' };
          break;
        case 'answer':
          yield { type: 'answer', response: update.response ?? '' };
          break;
        // Nó desconhecido não vira evento: a interface só conhece os quatro acima.
      }
    }
  }
}
