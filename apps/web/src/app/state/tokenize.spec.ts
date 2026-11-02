import { describe, expect, it } from 'vitest';
import { tokenize } from './tokenize';

describe('tokenize', () => {
  it('divide em palavras, mantendo o espaço depois de cada uma', () => {
    expect(tokenize('Receita de R$ 56,7 bilhões.')).toEqual([
      'Receita ',
      'de ',
      'R$ ',
      '56,7 ',
      'bilhões.',
    ]);
  });

  it('juntar os tokens devolve o texto, com as quebras de parágrafo', () => {
    const texto = 'Primeiro parágrafo.\n\nSegundo parágrafo.\nFontes:\n- VALE 3T25';

    expect(tokenize(texto).join('')).toBe(texto);
  });

  it('ignora espaços nas pontas', () => {
    expect(tokenize('  uma palavra \n')).toEqual(['uma ', 'palavra']);
  });

  it('devolve lista vazia para texto vazio ou só com espaços', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('  \n ')).toEqual([]);
  });
});
