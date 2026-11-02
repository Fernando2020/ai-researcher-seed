import type { FastifyPluginAsync } from 'fastify';
import { criarCallbacksDeTracing, criarMetricsCallback } from '@hero/agent';
import type { BaseCallbackHandler } from '@hero/agent';
import { chatRequestSchema } from '@hero/contracts';
import type { ChatEvent } from '@hero/contracts';
import { ChatIndisponivelError } from '../errors.js';
import { paraEventos } from './chat-event.js';
import type { GraphChunk } from './chat-event.js';

// Só o método que a rota usa. O grafo real do LangGraph satisfaz esta interface sem adaptador;
// nos testes, um objeto com um `stream` fake basta — sem LLM, sem Postgres.
export interface GraphLike {
  stream(
    input: { question: string },
    options: {
      streamMode: 'updates';
      signal?: AbortSignal;
      callbacks: BaseCallbackHandler[];
    },
  ): Promise<AsyncIterable<GraphChunk>>;
}

export interface ChatRouteOptions {
  // Função, não o grafo pronto: o grafo nasce na primeira pergunta. Lança quando falta
  // configuração (credencial, chave de busca) — a rota responde 503, e o resto da API (o
  // /health) continua de pé.
  getGraph: () => GraphLike;
}

const MENSAGEM_ERRO = 'Não foi possível concluir a resposta. Tente novamente em instantes.';

const chatRoute: FastifyPluginAsync<ChatRouteOptions> = async (app, { getGraph }) => {
  app.post('/chat', async (request, reply) => {
    // Corpo inválido lança ZodError, e grafo indisponível lança ChatIndisponivelError: o error
    // handler central transforma os dois em problem+json. A rota não monta resposta de erro.
    const body = chatRequestSchema.parse(request.body);
    let graph: GraphLike;
    try {
      graph = getGraph();
    } catch (erro) {
      request.log.warn({ err: erro }, 'Grafo indisponível');
      throw new ChatIndisponivelError();
    }

    // Daqui em diante a resposta é escrita à mão no socket: o Fastify não deve tentar enviar
    // nada quando o handler terminar.
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // `no-transform` é o que impede o Cloud Run (e proxies no caminho) de bufferizar a
      // resposta inteira — sem ele, os eventos chegam todos juntos no final.
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    // Se o usuário fechar a aba, o grafo para — não faz sentido pagar LLM pra ninguém.
    const abort = new AbortController();
    reply.raw.on('close', () => {
      if (!reply.raw.writableEnded) abort.abort();
    });

    const escrever = (evento: ChatEvent) => {
      reply.raw.write(`data: ${JSON.stringify(evento)}\n\n`);
    };

    try {
      const chunks = await graph.stream(
        { question: body.question },
        {
          streamMode: 'updates',
          signal: abort.signal,
          callbacks: [...criarCallbacksDeTracing(), criarMetricsCallback()],
        },
      );
      for await (const evento of paraEventos(chunks)) {
        escrever(evento);
      }
    } catch (error) {
      // A única exceção ao error handler central: o status 200 e os headers do SSE já foram
      // enviados, então não há mais como responder problem+json. O erro vira um evento no
      // próprio stream. O detalhe fica no log, nunca na resposta. Cancelamento não é erro.
      if (!abort.signal.aborted) {
        request.log.error(error, 'Erro durante a execução do grafo');
        escrever({ type: 'error', message: MENSAGEM_ERRO });
      }
    } finally {
      reply.raw.end();
    }
  });
};

export default chatRoute;
