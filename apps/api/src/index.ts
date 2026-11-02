import { obterGrafoReal } from '@hero/agent';
import { build } from './app.js';

// O grafo real nasce na primeira pergunta, não aqui: sem a configuração (GOOGLE_CLOUD_PROJECT_ID,
// SERPER_API_KEY...), a API sobe mesmo assim — o /health responde, e só /chat e /mcp falham.
// A mesma função memoizada vai pras duas rotas: um grafo só por processo.
const app = build({ getChatGraph: obterGrafoReal, getMcpGraph: obterGrafoReal });

app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
