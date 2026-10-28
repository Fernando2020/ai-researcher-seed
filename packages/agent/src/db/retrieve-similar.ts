import { cosineDistance, sql } from 'drizzle-orm';

import type { Database } from './client.js';
import { documentos } from './schema.js';

export interface RetrievedDoc {
  id: string;
  ticker: string;
  companyName: string;
  setor: string;
  period: string;
  periodEnd: string;
  paragraph: string;
  sourceUrl: string;
  fetchedAt: Date;
  distance: number;
}

// O banco entra por parâmetro, não por import do cliente global — quem chama decide qual
// conexão usar, e o nó retrieve nem sabe que esta função existe (recebe uma `Buscar`).
export async function buscarDocumentosSimilares(
  db: Database,
  embedding: number[],
  k: number,
): Promise<RetrievedDoc[]> {
  // cosineDistance vira `embedding <=> '[...]'` no SQL: 0 = mesma direção, 2 = oposta.
  // É o mesmo operador do índice HNSW (vector_cosine_ops) — com outro operador o índice
  // não seria usado.
  const distance = sql<number>`${cosineDistance(documentos.embedding, embedding)}`;

  return db
    .select({
      id: documentos.id,
      ticker: documentos.ticker,
      companyName: documentos.companyName,
      setor: documentos.setor,
      period: documentos.period,
      periodEnd: documentos.periodEnd,
      paragraph: documentos.paragraph,
      sourceUrl: documentos.sourceUrl,
      fetchedAt: documentos.fetchedAt,
      distance,
    })
    .from(documentos)
    .orderBy(distance)
    .limit(k);
}
