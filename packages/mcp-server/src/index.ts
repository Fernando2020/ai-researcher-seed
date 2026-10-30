// Superfície pública do pacote — o que o apps/api importa. Só módulos sem efeito colateral:
// importar daqui nunca conecta o stdio nem abre porta. Os pontos de entrada que fazem isso
// (stdio.ts e http.ts) são executados direto pelo node e não são exportados.
export { mcpHttpPlugin } from './http-plugin.js';
export type { McpHttpPluginOptions } from './http-plugin.js';
export { criarServidorMcp, DESCRICAO_PERGUNTAR } from './server.js';
export type { GetGraph, GrafoPerguntar } from './server.js';
