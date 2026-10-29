import { describe, expect, it } from 'vitest';

import type { DocumentoCorpus, DocumentoWeb } from '../db/retrieve-similar.js';
import {
  AVISO_GUARDRAIL,
  contemRecomendacao,
  formatarFontes,
  formatarResposta,
} from './format-resposta.js';

const ZIP_ITR_2025 =
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip';

function doCorpus(ticker: string, period: string, periodEnd: string): DocumentoCorpus {
  return {
    origem: 'cvm',
    id: `${ticker}-${period}`,
    ticker,
    companyName: ticker,
    setor: 'Setor',
    period,
    periodEnd,
    paragraph: 'Parágrafo.',
    sourceUrl: ZIP_ITR_2025,
    fetchedAt: new Date('2026-08-08T02:19:40.760Z'),
    distance: 0.1,
  };
}

function daWeb(title: string, sourceUrl: string): DocumentoWeb {
  return {
    origem: 'web',
    id: title,
    title,
    content: 'Trecho.',
    sourceUrl,
    fetchedAt: new Date('2026-10-20T10:00:00.000Z'),
    distance: 0.2,
  };
}

describe('contemRecomendacao', () => {
  it.each([
    'Recomendo comprar PETR4.',
    'Sugiro manter a posição.',
    'Eu aconselho vender agora.',
    'Minha recomendação é aguardar.',
    'Vale a pena comprar Vale neste trimestre.',
    'Você deveria investir em bancos.',
    'É um bom momento para comprar.',
  ])('detecta linguagem recomendatória: %s', (texto) => {
    expect(contemRecomendacao(texto)).toBe(true);
  });

  it.each([
    'A Petrobras teve lucro líquido de R$ 32,7 bilhões no 3T25.',
    'O indicador indica queda de receita.',
    'Não faço recomendações de investimento; os dados estão abaixo.',
  ])('não marca texto informativo: %s', (texto) => {
    expect(contemRecomendacao(texto)).toBe(false);
  });

  it('o próprio aviso do guardrail não é linguagem recomendatória', () => {
    expect(contemRecomendacao(AVISO_GUARDRAIL)).toBe(false);
  });
});

describe('formatarFontes', () => {
  it('lista ticker, período e data-base pro corpus, e título com URL pra web', () => {
    const fontes = formatarFontes([
      doCorpus('VALE', '3T25', '2025-09-30'),
      daWeb('Vale explica queda', 'https://exemplo.com/vale'),
    ]);

    expect(fontes).toBe(
      'Fontes:\n' +
        '- VALE 3T25, data-base 30/09/2025 (CVM Dados Abertos)\n' +
        '- Vale explica queda (https://exemplo.com/vale)',
    );
  });

  it('deduplica chunks da mesma página web pela sourceUrl', () => {
    const fontes = formatarFontes([
      daWeb('Página', 'https://exemplo.com/a'),
      daWeb('Página', 'https://exemplo.com/a'),
    ]);

    expect(fontes.match(/exemplo\.com\/a/g)).toHaveLength(1);
  });

  it('não junta empresas diferentes do corpus que compartilham o mesmo ZIP da CVM', () => {
    const fontes = formatarFontes([
      doCorpus('VALE', '3T25', '2025-09-30'),
      doCorpus('PETR', '3T25', '2025-09-30'),
    ]);

    expect(fontes).toContain('VALE 3T25');
    expect(fontes).toContain('PETR 3T25');
  });

  it('informa quando não há documentos', () => {
    expect(formatarFontes([])).toBe('Fontes: nenhum documento recuperado.');
  });
});

describe('formatarResposta', () => {
  it('mantém o texto do LLM e anexa as fontes', () => {
    const resposta = formatarResposta('Receita de R$ 10 bi.', [
      doCorpus('VALE', '3T25', '2025-09-30'),
    ]);

    expect(resposta).toBe(
      'Receita de R$ 10 bi.\n\nFontes:\n- VALE 3T25, data-base 30/09/2025 (CVM Dados Abertos)',
    );
  });

  it('troca o texto inteiro pelo aviso fixo quando há recomendação, mantendo as fontes', () => {
    const resposta = formatarResposta('Dados ótimos. Recomendo comprar.', [
      doCorpus('VALE', '3T25', '2025-09-30'),
    ]);

    expect(resposta).toBe(
      `${AVISO_GUARDRAIL}\n\nFontes:\n- VALE 3T25, data-base 30/09/2025 (CVM Dados Abertos)`,
    );
  });
});
