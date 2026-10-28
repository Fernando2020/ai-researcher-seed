import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sql } from 'drizzle-orm';

import { db, pool } from '../db/client.js';
import { documentos } from '../db/schema.js';
import { criarEmbeddingsReal } from '../embeddings.js';
import { emLotes } from './lotes.js';
import { lerDocumentos } from './read-documentos.js';
import { paraLinha } from './to-row.js';

const DOCUMENTOS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../corpus/data/documentos',
);

// Uma chamada à Vertex AI por lote, não por documento: 80 documentos viram 8 requisições.
const TAMANHO_LOTE = 10;

export async function semear(dir = DOCUMENTOS_DIR): Promise<number> {
  const items = lerDocumentos(dir);
  // O seed sempre usa o cliente real: semear o banco com vetores fake não faz sentido.
  const embeddings = criarEmbeddingsReal();

  let indexados = 0;
  for (const lote of emLotes(items, TAMANHO_LOTE)) {
    const vetores = await embeddings.embedDocuments(lote.map((documento) => documento.paragraph));
    const linhas = lote.map((documento, indice) => paraLinha(documento, vetores[indice]));

    // Upsert por (ticker, period): rodar o seed de novo atualiza a linha em vez de duplicar.
    // `excluded` é a linha que tentou entrar e colidiu com o índice único.
    await db
      .insert(documentos)
      .values(linhas)
      .onConflictDoUpdate({
        target: [documentos.ticker, documentos.period],
        set: {
          companyName: sql`excluded.company_name`,
          setor: sql`excluded.setor`,
          periodEnd: sql`excluded.period_end`,
          receitaLiquida: sql`excluded.receita_liquida`,
          lucroBruto: sql`excluded.lucro_bruto`,
          lucroLiquido: sql`excluded.lucro_liquido`,
          ativoTotal: sql`excluded.ativo_total`,
          patrimonioLiquido: sql`excluded.patrimonio_liquido`,
          caixaOperacional: sql`excluded.caixa_operacional`,
          receitaMesmoTrimestreAnoAnterior: sql`excluded.receita_mesmo_trimestre_ano_anterior`,
          sourceUrl: sql`excluded.source_url`,
          fetchedAt: sql`excluded.fetched_at`,
          paragraph: sql`excluded.paragraph`,
          embedding: sql`excluded.embedding`,
        },
      });

    indexados += linhas.length;
    console.log(`${indexados}/${items.length} documentos indexados.`);
  }

  return indexados;
}

const executadoDiretamente = process.argv[1] === fileURLToPath(import.meta.url);
if (executadoDiretamente) {
  semear()
    .then((total) => console.log(`Seed concluído: ${total} documento(s).`))
    .catch((erro: unknown) => {
      console.error(erro);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
