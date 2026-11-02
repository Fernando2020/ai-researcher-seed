import { describe, expect, it } from 'vitest';
import { ORIGEM_BASE_LOCAL, parseAnswer } from './citation';

const ZIP = 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2026.zip';
const PAGINA = 'https://www.estadao.com.br/einvestidor/klabin?id=1';

describe('parseAnswer', () => {
  it('separa o corpo do bloco de fontes', () => {
    const { body, citations } = parseAnswer(
      `Primeiro parágrafo.\n\nSegundo parágrafo.\n\nFontes:\n- KLBN · 1T26 (data-base 31/03/2026) (${ZIP})`,
    );

    expect(body).toBe('Primeiro parágrafo.\n\nSegundo parágrafo.');
    expect(citations).toHaveLength(1);
  });

  it('extrai período e data-base da citação da CVM, com a origem de base local', () => {
    const { citations } = parseAnswer(
      `Texto.\n\nFontes:\n- KLBN · 1T26 (data-base 31/03/2026) (${ZIP})`,
    );

    expect(citations).toEqual([
      {
        label: 'KLBN · 1T26 (data-base 31/03/2026)',
        url: ZIP,
        origin: ORIGEM_BASE_LOCAL,
        period: '1T26',
        baseDate: '31/03/2026',
      },
    ]);
  });

  it('usa o hostname como origem da citação da web, sem período', () => {
    const { citations } = parseAnswer(`Texto.\n\nFontes:\n- Klabin divulga resultado (${PAGINA})`);

    expect(citations).toEqual([
      {
        label: 'Klabin divulga resultado',
        url: PAGINA,
        origin: 'www.estadao.com.br',
        period: null,
        baseDate: null,
      },
    ]);
  });

  it('aceita parênteses no título: a URL é o último parêntese da linha', () => {
    const { citations } = parseAnswer(
      `Texto.\n\nFontes:\n- Lucro da Petrobras (PETR4) pode cair (${PAGINA})`,
    );

    expect(citations[0].label).toBe('Lucro da Petrobras (PETR4) pode cair');
    expect(citations[0].url).toBe(PAGINA);
  });

  it('mantém a ordem de várias citações', () => {
    const { citations } = parseAnswer(
      `Texto.\n\nFontes:\n- KLBN · 1T26 (data-base 31/03/2026) (${ZIP})\n- Página (${PAGINA})`,
    );

    expect(citations.map((citation) => citation.origin)).toEqual([
      ORIGEM_BASE_LOCAL,
      'www.estadao.com.br',
    ]);
  });

  it('usa o último bloco quando o corpo também menciona "Fontes:"', () => {
    const { body, citations } = parseAnswer(
      `Veja abaixo.\n\nFontes: são citadas no fim.\n\nFontes:\n- Página (${PAGINA})`,
    );

    expect(body).toBe('Veja abaixo.\n\nFontes: são citadas no fim.');
    expect(citations).toHaveLength(1);
  });

  it('sem documentos, o corpo fica limpo e não há citações', () => {
    expect(parseAnswer('Não encontrei.\n\nFontes: nenhum documento recuperado.')).toEqual({
      body: 'Não encontrei.',
      citations: [],
    });
  });

  it('sem bloco de fontes, devolve o texto inteiro como corpo', () => {
    expect(parseAnswer('Só o texto.')).toEqual({ body: 'Só o texto.', citations: [] });
  });

  it('ignora uma linha do bloco que não tem URL', () => {
    expect(parseAnswer('Texto.\n\nFontes:\n- Sem link nenhum').citations).toEqual([]);
  });
});
