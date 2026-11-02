import Fastify from 'fastify';
import { mcpHttpPlugin } from '@hero/mcp-server';
import type { GetGraph } from '@hero/mcp-server';
import { registrarTratamentoDeErros } from './error-handler.js';
import { ChatIndisponivelError } from './errors.js';
import chatRoute from './routes/chat.js';
import type { ChatRouteOptions } from './routes/chat.js';
import healthRoute from './routes/health.js';
import { checkDatabase as defaultCheckDatabase } from './db.js';

export interface BuildOptions {
  checkDatabase?: () => Promise<boolean>;
  // Uma opção por rota, cada uma com o tipo mínimo de que a rota precisa: o /chat chama `stream`,
  // a tool MCP chama `invoke`. Em produção, as duas recebem a mesma função memoizada (ver
  // index.ts) — grafos separados duplicariam Postgres, Vertex AI e circuit breaker.
  getChatGraph?: ChatRouteOptions['getGraph'];
  getMcpGraph?: GetGraph;
}

// Sem grafo, a rota que precisa dele falha — útil nos testes que só olham o /health ou o
// tratamento de erro.
const semGrafo = (): never => {
  throw new ChatIndisponivelError();
};

export function build({
  checkDatabase = defaultCheckDatabase,
  getChatGraph = semGrafo,
  getMcpGraph = semGrafo,
}: BuildOptions = {}) {
  const app = Fastify({ logger: true });

  registrarTratamentoDeErros(app);

  app.register(
    async (api) => {
      api.register(healthRoute, { checkDatabase });
      api.register(chatRoute, { getGraph: getChatGraph });
      // Gateway MCP na mesma porta e atrás do mesmo proxy /api do /chat: o Angular chama
      // /api/mcp sem CORS, como já chama /api/chat.
      api.register(mcpHttpPlugin, { getGraph: getMcpGraph, path: '/mcp' });
    },
    { prefix: '/api' },
  );

  return app;
}
