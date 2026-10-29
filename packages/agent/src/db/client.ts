import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema.js';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Erro em cliente ocioso do pool (ex.: o banco derrubou a conexão) emite 'error' no Pool. Sem
// este listener o Node trata como exceção não tratada e derruba o processo — agora que a API
// importa este pool, isso levaria o /health junto.
pool.on('error', (error) => {
  console.error('Erro em cliente ocioso do pool do Postgres (agent):', error);
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;
