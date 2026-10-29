import type { FastifyPluginAsync } from 'fastify';
import { chatRequestSchema } from '@hero/contracts';
import { paraEventos } from './chat-event.js';
import type { ChatEvent, GraphChunk } from './chat-event.js';

// Só o método que a rota usa. O grafo real do LangGraph satisfaz esta interface sem adaptador;
// nos testes, um objeto com um `stream` fake basta — sem LLM, sem Postgres.
export interface GraphLike {
  stream(
    input: { question: string },
    options: { streamMode: 'updates'; signal?: AbortSignal },
  ): Promise<AsyncIterable<GraphChunk>>;
}

export interface ChatRouteOptions {
  // `null` quando falta configuração (credencial, chave de busca): a rota responde 503 em vez
  // de impedir a API inteira — e o /health — de subir.
  graph: GraphLike | null;
}

const MENSAGEM_ERRO = 'Não foi possível concluir a resposta. Tente novamente em instantes.';

const chatRoute: FastifyPluginAsync<ChatRouteOptions> = async (app, { graph }) => {
  app.post('/chat', async (request, reply) => {
    const body = chatRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .code(400)
        .type('application/problem+json')
        .send({
          type: 'about:blank',
          title: 'Requisição inválida',
          status: 400,
          detail: body.error.issues.map((issue) => issue.message).join('; '),
        });
    }

    if (!graph) {
      return reply.code(503).type('application/problem+json').send({
        type: 'about:blank',
        title: 'Chat indisponível',
        status: 503,
        detail: 'O grafo não foi configurado neste ambiente.',
      });
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
        { question: body.data.question },
        { streamMode: 'updates', signal: abort.signal },
      );
      for await (const evento of paraEventos(chunks)) {
        escrever(evento);
      }
    } catch (error) {
      // O status 200 já foi enviado: o erro vira um evento no próprio stream. O detalhe fica
      // no log, nunca na resposta. Cancelamento pelo cliente não é erro.
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
