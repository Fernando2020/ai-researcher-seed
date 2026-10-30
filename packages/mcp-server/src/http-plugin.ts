import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { criarServidorMcp } from './server.js';
import type { GetGraph } from './server.js';

export interface McpHttpPluginOptions {
  getGraph: GetGraph;
  // Caminho dentro do contexto em que o plugin é registrado. No apps/api, com o prefixo /api,
  // vira /api/mcp; no servidor standalone, /mcp.
  path?: string;
}

// Só POST existe no modo stateless: GET abriria um stream SSE de notificações do servidor e
// DELETE encerraria uma sessão — e aqui não há sessão nenhuma.
function metodoNaoPermitido(reply: FastifyReply) {
  return reply
    .code(405)
    .header('Allow', 'POST')
    .send({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Método não permitido: este servidor MCP é stateless, use POST.',
      },
      id: null,
    });
}

// O mesmo servidor MCP do stdio (a tool perguntar), exposto via Streamable HTTP. Plugin Fastify
// pra ser registrado em mais de um lugar: no servidor standalone e dentro do apps/api.
export const mcpHttpPlugin: FastifyPluginAsync<McpHttpPluginOptions> = async (
  app,
  { getGraph, path = '/mcp' },
) => {
  app.post(path, async (request, reply) => {
    // Stateless: um servidor e um transporte novos por requisição, descartados no fim. Nada
    // fica em memória entre chamadas — qualquer instância do Cloud Run atende qualquer POST.
    // O que é caro (o grafo) não é recriado: vem do getGraph, que é memoizado.
    const server = criarServidorMcp(getGraph);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      // Resposta JSON única em vez de stream SSE: a tool não emite progresso, e JSON simples
      // atravessa qualquer proxy no caminho sem risco de buffering.
      enableJsonResponse: true,
    });

    // A resposta é escrita pelo transporte do SDK direto no socket — o Fastify não deve
    // tentar enviar nada depois do handler.
    reply.hijack();
    reply.raw.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    // O Fastify já fez o parse do JSON; o transporte recebe o corpo pronto.
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  app.get(path, (_request, reply) => metodoNaoPermitido(reply));
  app.delete(path, (_request, reply) => metodoNaoPermitido(reply));
};
