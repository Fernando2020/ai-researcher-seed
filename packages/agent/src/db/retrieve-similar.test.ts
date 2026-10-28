import { describe, expect, it } from 'vitest';

import type { DocumentoCorpus, DocumentoWeb } from './retrieve-similar.js';
import { combinarPorDistancia } from './retrieve-similar.js';

function doCorpus(id: string, distance: number): DocumentoCorpus {
  return {
    origem: 'cvm',
    id,
    ticker: 'VALE',
    companyName: 'Vale S.A.',
    setor: 'Mineração',
    period: '3T25',
    periodEnd: '2025-09-30',
    paragraph: 'No 3T25, a Vale S.A. reportou receita líquida de R$ 56,7 bilhões.',
    sourceUrl: 'https://dados.cvm.gov.br/...',
    fetchedAt: new Date('2026-08-08T02:19:40.760Z'),
    distance,
  };
}

function daWeb(id: string, distance: number): DocumentoWeb {
  return {
    origem: 'web',
    id,
    title: 'Vale divulga resultado',
    content: 'A queda da receita se deve ao preço do minério.',
    sourceUrl: 'https://exemplo.com/vale',
    fetchedAt: new Date('2026-10-20T10:00:00.000Z'),
    distance,
  };
}

describe('combinarPorDistancia', () => {
  it('intercala corpus e web ordenando só pela distância', () => {
    const resultado = combinarPorDistancia(
      [doCorpus('c1', 0.1), doCorpus('c2', 0.4), daWeb('w1', 0.2), daWeb('w2', 0.3)],
      10,
    );

    expect(resultado.map((doc) => doc.id)).toEqual(['c1', 'w1', 'w2', 'c2']);
  });

  it('corta no k depois de combinar', () => {
    const resultado = combinarPorDistancia(
      [doCorpus('c1', 0.5), daWeb('w1', 0.1), daWeb('w2', 0.2)],
      2,
    );

    expect(resultado.map((doc) => doc.id)).toEqual(['w1', 'w2']);
  });

  it('não altera a lista recebida', () => {
    const docs = [doCorpus('c1', 0.5), daWeb('w1', 0.1)];

    combinarPorDistancia(docs, 1);

    expect(docs.map((doc) => doc.id)).toEqual(['c1', 'w1']);
  });
});
