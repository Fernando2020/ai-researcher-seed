import { defineConfig } from 'drizzle-kit';

// `drizzle-kit generate` só compara o schema com as migrations já geradas — não conecta
// no banco. A URL só é usada por comandos que falam com o Postgres (ex.: `drizzle-kit studio`).
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
