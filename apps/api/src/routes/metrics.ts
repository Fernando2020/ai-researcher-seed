import type { FastifyPluginAsync } from 'fastify';

// Só o que a rota usa do Registry. O do prom-client satisfaz esta interface sem adaptador, e
// apps/api não ganha a dependência; nos testes, um objeto fake basta.
export interface RegistroDeMetricas {
  contentType: string;
  metrics(): Promise<string>;
}

export interface MetricsRouteOptions {
  registro: RegistroDeMetricas;
}

const metricsRoute: FastifyPluginAsync<MetricsRouteOptions> = async (app, { registro }) => {
  // Fora do rate limit: o coletor de métricas não pode ser barrado justamente num pico de tráfego.
  app.get('/metrics', { config: { rateLimit: false } }, async (_request, reply) => {
    // O Content-Type traz a versão do formato de texto, que o Prometheus usa pra interpretar o corpo.
    return reply.type(registro.contentType).send(await registro.metrics());
  });
};

export default metricsRoute;
