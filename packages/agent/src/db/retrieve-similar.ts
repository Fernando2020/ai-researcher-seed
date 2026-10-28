import { cosineDistance, gt, sql } from 'drizzle-orm';

import type { Database } from './client.js';
import { documentos, documentosWeb } from './schema.js';

// Os dois tipos de documento têm formatos diferentes — o corpus tem empresa e trimestre, a web
// tem título e texto livre. O campo `origem` diz qual é qual, e o TypeScript estreita o tipo
// a partir dele (`if (doc.origem === 'cvm') doc.ticker`).
export interface DocumentoCorpus {
  origem: 'cvm';
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

export interface DocumentoWeb {
  origem: 'web';
  id: string;
  title: string;
  content: string;
  sourceUrl: string;
  fetchedAt: Date;
  distance: number;
}

export type RetrievedDoc = DocumentoCorpus | DocumentoWeb;

// O banco entra por parâmetro, não por import do cliente global — quem chama decide qual
// conexão usar, e o nó retrieve nem sabe que esta função existe (recebe uma `Buscar`).
export async function buscarDocumentosSimilares(
  db: Database,
  embedding: number[],
  k: number,
): Promise<RetrievedDoc[]> {
  // Cada tabela devolve os seus k melhores; só depois os dois conjuntos competem entre si.
  // Pedir k de cada garante que o resultado final é o mesmo de uma busca única nas duas.
  const [doCorpus, daWeb] = await Promise.all([
    buscarNoCorpus(db, embedding, k),
    buscarNaWeb(db, embedding, k),
  ]);
  return combinarPorDistancia([...doCorpus, ...daWeb], k);
}

// Corpus e web disputam pela mesma régua: a distância de cosseno até a pergunta. Nenhuma
// origem tem prioridade — o mais parecido vence.
export function combinarPorDistancia(docs: RetrievedDoc[], k: number): RetrievedDoc[] {
  return [...docs].sort((a, b) => a.distance - b.distance).slice(0, k);
}

async function buscarNoCorpus(
  db: Database,
  embedding: number[],
  k: number,
): Promise<DocumentoCorpus[]> {
  // cosineDistance vira `embedding <=> '[...]'` no SQL: 0 = mesma direção, 2 = oposta.
  // É o mesmo operador do índice HNSW (vector_cosine_ops) — com outro operador o índice
  // não seria usado.
  const distance = sql<number>`${cosineDistance(documentos.embedding, embedding)}`;

  const linhas = await db
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

  return linhas.map((linha) => ({ origem: 'cvm' as const, ...linha }));
}

async function buscarNaWeb(db: Database, embedding: number[], k: number): Promise<DocumentoWeb[]> {
  const distance = sql<number>`${cosineDistance(documentosWeb.embedding, embedding)}`;

  const linhas = await db
    .select({
      id: documentosWeb.id,
      title: documentosWeb.title,
      content: documentosWeb.content,
      sourceUrl: documentosWeb.sourceUrl,
      fetchedAt: documentosWeb.fetchedAt,
      distance,
    })
    .from(documentosWeb)
    // Trecho vencido não é apagado, só deixa de ser recuperado. `now()` é o relógio do banco.
    .where(gt(documentosWeb.expiresAt, sql`now()`))
    .orderBy(distance)
    .limit(k);

  return linhas.map((linha) => ({ origem: 'web' as const, ...linha }));
}
