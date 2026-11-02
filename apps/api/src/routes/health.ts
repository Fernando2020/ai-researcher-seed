import type { FastifyPluginAsync } from 'fastify';
import { healthResponseSchema } from '@hero/contracts';

export interface HealthRouteOptions {
  checkDatabase: () => Promise<boolean>;
}

const healthRoute: FastifyPluginAsync<HealthRouteOptions> = async (app, { checkDatabase }) => {
  // Fora do rate limit: quem checa a saúde da API não pode receber 429 no lugar da resposta.
  app.get('/health', { config: { rateLimit: false } }, async () => {
    const databaseOk = await checkDatabase();

    return healthResponseSchema.parse({
      status: databaseOk ? 'ok' : 'degraded',
      database: databaseOk ? 'ok' : 'error',
    });
  });
};

export default healthRoute;
