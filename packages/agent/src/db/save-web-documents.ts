import type { Database } from './client.js';
import { documentosWeb } from './schema.js';

export type NovoDocumentoWeb = typeof documentosWeb.$inferInsert;

// Insert simples, sem upsert: a mesma página buscada de novo depois gera linhas novas, e as
// antigas somem da busca quando o TTL vence.
export async function salvarDocumentosWeb(
  db: Database,
  documentos: NovoDocumentoWeb[],
): Promise<void> {
  if (documentos.length === 0) return;
  await db.insert(documentosWeb).values(documentos);
}
