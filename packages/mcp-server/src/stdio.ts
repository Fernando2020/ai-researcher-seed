import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { obterGrafoReal, registrarTracing } from '@hero/agent';
import { criarServidorMcp } from './server.js';

// Ponto de entrada do transporte stdio — é o que o `claude mcp add` executa. O cliente MCP
// conversa com este processo pelo stdin/stdout, então nada aqui pode escrever no stdout: logs
// vão pro stderr. O grafo real só é construído na primeira chamada da tool.
registrarTracing();

const server = criarServidorMcp(obterGrafoReal);

server.connect(new StdioServerTransport()).catch((erro: unknown) => {
  console.error('[mcp-server] não foi possível iniciar o transporte stdio:', erro);
  process.exit(1);
});
