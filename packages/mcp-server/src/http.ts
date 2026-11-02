import Fastify from 'fastify';
import { obterGrafoReal, registrarTracing } from '@hero/agent';
import { mcpHttpPlugin } from './http-plugin.js';

// Ponto de entrada do servidor MCP via Streamable HTTP, com porta própria. É executado direto
// (`pnpm --filter @hero/mcp-server start:http`), nunca importado: o listen abaixo roda ao carregar.
registrarTracing();

const porta = Number(process.env.MCP_HTTP_PORT ?? 3100);

const app = Fastify({ logger: true });
app.register(mcpHttpPlugin, { getGraph: obterGrafoReal });

app.listen({ port: porta, host: '0.0.0.0' }).catch((erro: unknown) => {
  app.log.error(erro);
  process.exit(1);
});
