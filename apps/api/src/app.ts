import Fastify from 'fastify';
import chatRoute from './routes/chat.js';
import type { GraphLike } from './routes/chat.js';
import healthRoute from './routes/health.js';
import { checkDatabase as defaultCheckDatabase } from './db.js';

export interface BuildOptions {
  checkDatabase?: () => Promise<boolean>;
  graph?: GraphLike | null;
}

export function build({ checkDatabase = defaultCheckDatabase, graph = null }: BuildOptions = {}) {
  const app = Fastify({ logger: true });

  app.register(
    async (api) => {
      api.register(healthRoute, { checkDatabase });
      api.register(chatRoute, { graph });
    },
    { prefix: '/api' },
  );

  return app;
}
