import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCsvCvm } from './parse-csv.js';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/dre-latin1.csv');

describe('parseCsvCvm', () => {
  it('a fixture está mesmo em ISO-8859-1, e não em UTF-8', () => {
    const bytes = readFileSync(FIXTURE);

    // "ç" em latin1 é um byte só (0xE7); em UTF-8 seriam dois (0xC3 0xA7). Se alguém
    // regravar a fixture em UTF-8 pelo editor, este teste quebra antes dos outros mentirem.
    expect(bytes.includes(0xe7)).toBe(true);
    expect(bytes.includes(Buffer.from([0xc3, 0xa7]))).toBe(false);
    // Lidos como UTF-8, os bytes latin1 viram o caractere de substituição (U+FFFD).
    expect(bytes.toString('utf8')).toContain('�');
  });

  it('decodifica os acentos de um arquivo latin1 real', () => {
    const linhas = parseCsvCvm(FIXTURE);

    expect(linhas[0].DS_CONTA).toBe('Receita de Venda de Bens e/ou Serviços');
    expect(linhas[0].ORDEM_EXERC).toBe('ÚLTIMO');
    expect(linhas[0].GRUPO_DFP).toBe('DF Consolidado - Demonstração do Resultado');
    expect(linhas[1].ORDEM_EXERC).toBe('PENÚLTIMO');
    expect(linhas[2].DS_CONTA).toBe('Lucro/Prejuízo Consolidado do Período');
  });

  it('indexa cada linha pelo cabeçalho e ignora a quebra de linha final', () => {
    const linhas = parseCsvCvm(FIXTURE);

    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toMatchObject({
      CD_CVM: '004170',
      DT_REFER: '2025-09-30',
      DT_INI_EXERC: '2025-07-01',
      CD_CONTA: '3.01',
      VL_CONTA: '56701000.0000000000',
      ST_CONTA_FIXA: 'S',
    });
  });

  it('aceita CRLF e LF, e completa com string vazia o campo que falta no fim da linha', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'parse-csv-'));
    const arquivo = path.join(dir, 'misto.csv');
    writeFileSync(arquivo, Buffer.from('A;B;C\r\n1;2;3\nx;y\n', 'latin1'));

    expect(parseCsvCvm(arquivo)).toEqual([
      { A: '1', B: '2', C: '3' },
      { A: 'x', B: 'y', C: '' },
    ]);
  });
});
