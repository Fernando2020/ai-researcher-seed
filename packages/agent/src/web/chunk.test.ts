import { describe, expect, it } from 'vitest';

import { dividirEmChunks } from './chunk.js';

describe('dividirEmChunks', () => {
  it('devolve um único chunk quando o texto é menor que o tamanho', () => {
    expect(dividirEmChunks('texto curto', 1000, 100)).toEqual(['texto curto']);
  });

  it('devolve lista vazia para texto vazio', () => {
    expect(dividirEmChunks('', 1000, 100)).toEqual([]);
  });

  it('sobrepõe o fim de um chunk com o começo do próximo', () => {
    const chunks = dividirEmChunks('abcdefghij', 4, 1);

    expect(chunks).toEqual(['abcd', 'defg', 'ghij']);
  });

  it('com os valores padrão, gera chunks de 1000 caracteres e 100 de sobreposição', () => {
    const texto = 'x'.repeat(2500);
    const chunks = dividirEmChunks(texto);

    expect(chunks.map((chunk) => chunk.length)).toEqual([1000, 1000, 700]);
  });

  it('recusa sobreposição maior ou igual ao tamanho, que nunca avançaria', () => {
    expect(() => dividirEmChunks('abc', 10, 10)).toThrow();
  });
});
