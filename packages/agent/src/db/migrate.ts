import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../migrations',
);

// Aplica só as migrations pendentes: o Drizzle anota cada uma aplicada em
// drizzle.__drizzle_migrations, então rodar de novo sem migration nova não faz nada.
// Roda manualmente (local e Cloud SQL) — nunca no boot da API, onde várias instâncias
// subindo ao mesmo tempo tentariam migrar juntas.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await migrate(drizzle(pool), { migrationsFolder });
  console.log('Migrations aplicadas.');
} finally {
  await pool.end();
}
