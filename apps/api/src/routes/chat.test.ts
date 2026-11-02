import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RetrievedDoc } from '@hero/agent';
import { build } from '../app.js';
import type { GraphChunk } from './chat-event.js';
import type { GraphLike } from './chat.js';

const documentoCvm: RetrievedDoc = {
  origem: 'cvm',
  id: '1',
  ticker: 'VALE',
  companyName: 'Vale S.A.',
  setor: 'Mineração',
  period: '3T25',
  periodEnd: '2025-09-30',
  paragraph: 'No 3T25, a Vale S.A. reportou receita líquida de R$ 56,7 bilhões.',
  sourceUrl: 'https://dados.cvm.gov.br/itr_cia_aberta_2025.zip',
  fetchedAt: new Date('2026-08-08T02:19:40.760Z'),
  distance: 0.1,
};

const documentoWeb: RetrievedDoc = {
  origem: 'web',
  id: '2',
  title: 'Vale explica queda da receita',
  content: 'A queda se deve ao preço do minério.',
  sourceUrl: 'https://exemplo.com/vale',
  fetchedAt: new Date('2026-10-20T10:00:00.000Z'),
  distance: 0.2,
};

// Grafo fake: o stream devolve os chunks dados, na ordem — e, se `erro` vier, lança depois deles.
function grafoFake(chunks: GraphChunk[], erro?: Error): GraphLike {
  return {
    stream: () =>
      Promise.resolve(
        (async function* () {
          for (const chunk of chunks) yield chunk;
          if (erro) throw erro;
        })(),
      ),
  };
}

// Corpo SSE → lista de eventos. Cada evento é uma linha `data: {...}` seguida de linha vazia.
function lerEventos(corpo: string): unknown[] {
  return corpo
    .split('\n\n')
    .filter((bloco) => bloco.startsWith('data: '))
    .map((bloco) => JSON.parse(bloco.slice('data: '.length)) as unknown);
}

function postChat(graph: GraphLike | null, payload: unknown) {
  const app = build({
    checkDatabase: async () => true,
    getChatGraph: graph
      ? () => graph
      : () => {
          throw new Error('GOOGLE_CLOUD_PROJECT_ID não configurada');
        },
  });
  return app.inject({ method: 'POST', url: '/api/chat', payload: payload as object });
}

describe('POST /api/chat', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('passa um handler novo do Langfuse a cada pergunta, quando as chaves existem', async () => {
    vi.stubEnv('LANGFUSE_PUBLIC_KEY', 'pk-teste');
    vi.stubEnv('LANGFUSE_SECRET_KEY', 'sk-teste');
    const stream = vi.fn<GraphLike['stream']>(() => Promise.resolve((async function* () {})()));

    await postChat({ stream }, { question: 'primeira' });
    await postChat({ stream }, { question: 'segunda' });

    const [primeiro] = stream.mock.calls[0]?.[1].callbacks ?? [];
    const [segundo] = stream.mock.calls[1]?.[1].callbacks ?? [];
    expect(primeiro).toBeDefined();
    expect(segundo).toBeDefined();
    expect(primeiro).not.toBe(segundo);
  });

  it('transmite um evento por nó, com os headers que impedem buffering', async () => {
    const graph = grafoFake([
      { retrieve: { documents: [documentoCvm] } },
      { grade: { sufficient: false, missingAspects: ['motivo da queda'], iterations: 1 } },
      { webSearch: {} },
      { retrieve: { documents: [documentoCvm, documentoWeb] } },
      { grade: { sufficient: true, missingAspects: [], iterations: 1 } },
      { answer: { response: 'A receita caiu pelo preço do minério.\n\nFontes: ...' } },
    ]);

    const response = await postChat(graph, { question: 'Por que a receita da Vale caiu?' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.headers['cache-control']).toBe('no-cache, no-transform');
    expect(response.headers.connection).toBe('keep-alive');

    expect(lerEventos(response.body)).toEqual([
      {
        type: 'retrieve',
        documents: [
          {
            origem: 'cvm',
            rotulo: 'VALE 3T25',
            sourceUrl: documentoCvm.sourceUrl,
            distance: 0.1,
            companyName: 'Vale S.A.',
            period: '3T25',
            periodEnd: '2025-09-30',
          },
        ],
      },
      { type: 'grade', sufficient: false, missingAspects: ['motivo da queda'], iterations: 1 },
      { type: 'webSearch' },
      {
        type: 'retrieve',
        documents: [
          {
            origem: 'cvm',
            rotulo: 'VALE 3T25',
            sourceUrl: documentoCvm.sourceUrl,
            distance: 0.1,
            companyName: 'Vale S.A.',
            period: '3T25',
            periodEnd: '2025-09-30',
          },
          {
            origem: 'web',
            rotulo: 'Vale explica queda da receita',
            sourceUrl: documentoWeb.sourceUrl,
            distance: 0.2,
            fetchedAt: '2026-10-20T10:00:00.000Z',
          },
        ],
      },
      // Total acumulado, não o incremento de 1 que o nó devolve.
      { type: 'grade', sufficient: true, missingAspects: [], iterations: 2 },
      { type: 'answer', response: 'A receita caiu pelo preço do minério.\n\nFontes: ...' },
    ]);
  });

  it('escreve um evento de erro e encerra quando o grafo falha no meio do stream', async () => {
    const graph = grafoFake(
      [{ retrieve: { documents: [documentoCvm] } }],
      new Error('Vertex AI fora do ar'),
    );

    const response = await postChat(graph, { question: 'Qual a receita da Vale?' });

    expect(response.statusCode).toBe(200);
    const eventos = lerEventos(response.body);
    expect(eventos).toHaveLength(2);
    expect(eventos[1]).toEqual({ type: 'error', message: expect.any(String) as string });
    // O detalhe interno fica no log, não vaza pro cliente.
    expect(response.body).not.toContain('Vertex AI fora do ar');
  });

  it('continua atendendo depois de um erro no grafo — o processo não cai', async () => {
    const app = build({
      checkDatabase: async () => true,
      getChatGraph: () => grafoFake([], new Error('falha')),
    });

    await app.inject({ method: 'POST', url: '/api/chat', payload: { question: 'x' } });
    const health = await app.inject({ method: 'GET', url: '/api/health' });

    expect(health.statusCode).toBe(200);
  });

  it('responde 400 em problem+json quando a pergunta é inválida', async () => {
    const response = await postChat(grafoFake([]), { question: '   ' });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({ title: 'Requisição inválida', status: 400 });
  });

  it('responde 503 em problem+json quando o grafo não está configurado', async () => {
    const response = await postChat(null, { question: 'Qual a receita da Vale?' });

    expect(response.statusCode).toBe(503);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });
});
