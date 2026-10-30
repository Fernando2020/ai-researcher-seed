import Fastify from 'fastify';
import { mcpHttpPlugin } from '@hero/mcp-server';
import type { GrafoPerguntar } from '@hero/mcp-server';
import { registrarTratamentoDeErros } from './error-handler.js';
import { ChatIndisponivelError } from './errors.js';
import chatRoute from './routes/chat.js';
import type { GraphLike } from './routes/chat.js';
import healthRoute from './routes/health.js';
import { checkDatabase as defaultCheckDatabase } from './db.js';

// O grafo que a API inteira usa: o /chat chama `stream`, a tool MCP chama `invoke`. O grafo
// real do LangGraph tem os dois.
export type GrafoDaApi = GraphLike & GrafoPerguntar;

export interface BuildOptions {
  checkDatabase?: () => Promise<boolean>;
  // Uma única função pras duas rotas — e, em produção, memoizada (obterGrafoReal): /chat e
  // /mcp recebem a mesma instância do grafo, e portanto o mesmo SearchProvider e o mesmo
  // circuit breaker. Dois grafos seriam dois circuitos independentes pra mesma API externa.
  getGraph?: () => GrafoDaApi;
}

// Sem getGraph, nenhuma rota que precisa do grafo funciona — útil nos testes que só olham o
// /health ou o tratamento de erro.
const semGrafo = (): GrafoDaApi => {
  throw new ChatIndisponivelError();
};

export function build({
  checkDatabase = defaultCheckDatabase,
  getGraph = semGrafo,
}: BuildOptions = {}) {
  const app = Fastify({ logger: true });

  registrarTratamentoDeErros(app);

  app.register(
    async (api) => {
      api.register(healthRoute, { checkDatabase });
      api.register(chatRoute, { getGraph });
      // Gateway MCP na mesma porta e atrás do mesmo proxy /api do /chat: o Angular chama
      // /api/mcp sem CORS, como já chama /api/chat.
      api.register(mcpHttpPlugin, { getGraph, path: '/mcp' });
    },
    { prefix: '/api' },
  );

  return app;
}
