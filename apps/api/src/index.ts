import { criarGrafoReal } from '@hero/agent';
import { build } from './app.js';
import type { GraphLike } from './routes/chat.js';

// Sem a configuração do grafo (GOOGLE_CLOUD_PROJECT_ID, SERPER_API_KEY...), a API sobe mesmo
// assim: o /health continua respondendo, e só o /chat devolve 503.
function criarGrafoOuNulo(): GraphLike | null {
  try {
    return criarGrafoReal();
  } catch (error) {
    console.warn('POST /api/chat indisponível:', error instanceof Error ? error.message : error);
    return null;
  }
}

const app = build({ graph: criarGrafoOuNulo() });

app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
