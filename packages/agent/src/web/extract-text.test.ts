import { describe, expect, it } from 'vitest';

import { extrairTexto } from './extract-text.js';

describe('extrairTexto', () => {
  it('remove as tags e mantém o texto, separando elementos vizinhos', () => {
    expect(extrairTexto('<h1>Petrobras</h1><p>anuncia <b>dividendos</b></p>')).toBe(
      'Petrobras anuncia dividendos',
    );
  });

  it('descarta script, style, head e comentários', () => {
    const html = `<html><head><title>T</title></head><body>
      <script>var x = 1;</script><style>p { color: red }</style><!-- menu -->
      <p>Conteúdo</p></body></html>`;

    expect(extrairTexto(html)).toBe('Conteúdo');
  });

  it('decodifica entidades HTML comuns e numéricas', () => {
    expect(extrairTexto('<p>Lucro &amp; receita&nbsp;&#233;</p>')).toBe('Lucro & receita é');
  });
});
