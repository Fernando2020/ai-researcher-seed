import { describe, expect, it } from 'vitest';
import type { LinhaCvm } from '../types.js';
import {
  agruparPorEmpresa,
  buscarConta,
  buscarContaPorDescricao,
  candidatosTrimestres,
  demonstrativosDaEmpresa,
  DESCRICOES_LUCRO_LIQUIDO,
  DESCRICOES_PATRIMONIO_LIQUIDO,
  escolherMaiorVersao,
  inicioTrimestreIso,
  periodEndIso,
  periodoLabel,
  subtrairValorConta,
  valorConta,
  type DemonstrativosAno,
} from './select-quarters.js';

// Uma linha de CSV da CVM só com os campos que o seletor lê; o resto fica com valor padrão
// de um ITR consolidado do 3T25.
function linha(campos: Partial<LinhaCvm>): LinhaCvm {
  return {
    CD_CVM: '004170',
    DT_REFER: '2025-09-30',
    VERSAO: '1',
    ORDEM_EXERC: 'ÚLTIMO',
    DT_INI_EXERC: '2025-07-01',
    CD_CONTA: '3.01',
    DS_CONTA: 'Receita de Venda de Bens e/ou Serviços',
    VL_CONTA: '1000',
    ESCALA_MOEDA: 'MIL',
    ST_CONTA_FIXA: 'S',
    ...campos,
  };
}

describe('periodEndIso', () => {
  it('devolve o último dia do mês do fim de cada trimestre', () => {
    expect(periodEndIso(2025, 3)).toBe('2025-03-31');
    expect(periodEndIso(2025, 6)).toBe('2025-06-30');
    expect(periodEndIso(2025, 9)).toBe('2025-09-30');
    expect(periodEndIso(2025, 12)).toBe('2025-12-31');
  });

  it('acerta fevereiro em ano bissexto e não bissexto', () => {
    expect(periodEndIso(2024, 2)).toBe('2024-02-29');
    expect(periodEndIso(2025, 2)).toBe('2025-02-28');
    // 1900 é divisível por 4 mas não é bissexto (múltiplo de 100 que não é de 400); 2000 é.
    expect(periodEndIso(1900, 2)).toBe('1900-02-28');
    expect(periodEndIso(2000, 2)).toBe('2000-02-29');
  });
});

describe('inicioTrimestreIso', () => {
  it('devolve o primeiro dia do primeiro mês do trimestre', () => {
    expect(inicioTrimestreIso(2025, 3)).toBe('2025-01-01');
    expect(inicioTrimestreIso(2025, 6)).toBe('2025-04-01');
    expect(inicioTrimestreIso(2025, 9)).toBe('2025-07-01');
    expect(inicioTrimestreIso(2025, 12)).toBe('2025-10-01');
  });
});

describe('periodoLabel', () => {
  it('formata como NTAA', () => {
    expect(periodoLabel(3, 2026)).toBe('1T26');
    expect(periodoLabel(12, 2025)).toBe('4T25');
  });
});

describe('candidatosTrimestres', () => {
  it('começa no trimestre corrente e volta virando o ano', () => {
    const candidatos = candidatosTrimestres(new Date(Date.UTC(2026, 1, 15)), 6);

    expect(candidatos).toEqual([
      { ano: 2026, mes: 3 },
      { ano: 2025, mes: 12 },
      { ano: 2025, mes: 9 },
      { ano: 2025, mes: 6 },
      { ano: 2025, mes: 3 },
      { ano: 2024, mes: 12 },
    ]);
  });

  it('usa o mês em UTC: 31/12 às 23h em Brasília já é 1º trimestre do ano seguinte', () => {
    // 2025-12-31T23:30-03:00 = 2026-01-01T02:30Z.
    const candidatos = candidatosTrimestres(new Date('2025-12-31T23:30:00-03:00'), 1);

    expect(candidatos).toEqual([{ ano: 2026, mes: 3 }]);
  });

  it('o último dia do trimestre ainda pertence a ele', () => {
    expect(candidatosTrimestres(new Date(Date.UTC(2025, 8, 30)), 1)).toEqual([
      { ano: 2025, mes: 9 },
    ]);
  });
});

describe('escolherMaiorVersao', () => {
  it('fica com a versão retificada mais recente, comparando como número', () => {
    const escolhida = escolherMaiorVersao([
      linha({ VERSAO: '2', VL_CONTA: '200' }),
      // Como texto, '10' < '2'. Como número, a versão 10 é a mais recente.
      linha({ VERSAO: '10', VL_CONTA: '1000' }),
      linha({ VERSAO: '1', VL_CONTA: '100' }),
    ]);

    expect(escolhida?.VL_CONTA).toBe('1000');
  });

  it('devolve undefined pra lista vazia', () => {
    expect(escolherMaiorVersao([])).toBeUndefined();
  });
});

describe('buscarConta', () => {
  it('filtra por código, data de referência, ordem do exercício e início do período', () => {
    const linhas = [
      linha({ CD_CONTA: '3.01', VL_CONTA: 'trimestre' }),
      // Mesma conta, mas acumulado do ano (DT_INI_EXERC em janeiro).
      linha({ CD_CONTA: '3.01', DT_INI_EXERC: '2025-01-01', VL_CONTA: 'acumulado' }),
      // Mesma conta, mas do mesmo trimestre do ano anterior.
      linha({ CD_CONTA: '3.01', ORDEM_EXERC: 'PENÚLTIMO', VL_CONTA: 'ano anterior' }),
      linha({ CD_CONTA: '3.03', VL_CONTA: 'lucro bruto' }),
    ];

    expect(buscarConta(linhas, '3.01', '2025-09-30', 'ÚLTIMO', '2025-07-01')?.VL_CONTA).toBe(
      'trimestre',
    );
    expect(buscarConta(linhas, '3.01', '2025-09-30', 'ÚLTIMO', '2025-01-01')?.VL_CONTA).toBe(
      'acumulado',
    );
    expect(buscarConta(linhas, '3.01', '2025-09-30', 'PENÚLTIMO')?.VL_CONTA).toBe('ano anterior');
  });

  it('sem dtIniExerc, ignora o início do período — é o caso do balanço (BPA/BPP)', () => {
    const linhas = [linha({ CD_CONTA: '1', DT_INI_EXERC: '', VL_CONTA: '999' })];

    expect(buscarConta(linhas, '1', '2025-09-30', 'ÚLTIMO')?.VL_CONTA).toBe('999');
  });

  it('entre versões da mesma conta, devolve a retificada', () => {
    const linhas = [
      linha({ VERSAO: '1', VL_CONTA: 'original' }),
      linha({ VERSAO: '2', VL_CONTA: 'retificada' }),
    ];

    expect(buscarConta(linhas, '3.01', '2025-09-30', 'ÚLTIMO', '2025-07-01')?.VL_CONTA).toBe(
      'retificada',
    );
  });

  it('devolve undefined quando a conta não existe no período', () => {
    expect(buscarConta([linha({})], '3.01', '2025-06-30', 'ÚLTIMO')).toBeUndefined();
  });
});

describe('buscarContaPorDescricao', () => {
  const lucroLiquido = (cdConta: string, dsConta: string, vlConta: string) =>
    linha({ CD_CONTA: cdConta, DS_CONTA: dsConta, VL_CONTA: vlConta });

  it('acha o lucro líquido em posições diferentes conforme o setor', () => {
    // Industrial (Vale), Itaú e Bradesco: mesma linha, códigos diferentes.
    const industrial = [lucroLiquido('3.11', 'Lucro/Prejuízo Consolidado do Período', 'vale')];
    const itau = [lucroLiquido('3.09', 'Lucro ou Prejuízo Líquido Consolidado do Período', 'itau')];
    const bradesco = [lucroLiquido('3.11', 'Lucro ou Prejuízo do Período', 'bradesco')];

    const buscar = (linhas: LinhaCvm[]) =>
      buscarContaPorDescricao(
        linhas,
        DESCRICOES_LUCRO_LIQUIDO,
        '2025-09-30',
        'ÚLTIMO',
        '2025-07-01',
      )?.VL_CONTA;

    expect(buscar(industrial)).toBe('vale');
    expect(buscar(itau)).toBe('itau');
    expect(buscar(bradesco)).toBe('bradesco');
  });

  it('com dois candidatos de mesmo nome, fica com o de código mais raso (a linha-resumo)', () => {
    const linhas = [
      lucroLiquido('3.11.01', 'Lucro/Prejuízo Consolidado do Período', 'sub-linha'),
      lucroLiquido('3.11', 'Lucro/Prejuízo Consolidado do Período', 'resumo'),
    ];

    expect(
      buscarContaPorDescricao(linhas, DESCRICOES_LUCRO_LIQUIDO, '2025-09-30', 'ÚLTIMO')?.VL_CONTA,
    ).toBe('resumo');
  });

  it('ignora linhas que não são da taxonomia padrão (ST_CONTA_FIXA diferente de S)', () => {
    const linhas = [
      linha({
        CD_CONTA: '2.03',
        DS_CONTA: 'Patrimônio Líquido Consolidado',
        ST_CONTA_FIXA: 'N',
        DT_INI_EXERC: '',
      }),
    ];

    expect(
      buscarContaPorDescricao(linhas, DESCRICOES_PATRIMONIO_LIQUIDO, '2025-09-30', 'ÚLTIMO'),
    ).toBeUndefined();
  });

  it('acha o patrimônio líquido de banco (2.07) e de indústria (2.03) pelo nome', () => {
    const pl = (cdConta: string) =>
      linha({ CD_CONTA: cdConta, DS_CONTA: 'Patrimônio Líquido Consolidado', DT_INI_EXERC: '' });

    for (const cdConta of ['2.03', '2.07']) {
      expect(
        buscarContaPorDescricao(
          [pl(cdConta)],
          DESCRICOES_PATRIMONIO_LIQUIDO,
          '2025-09-30',
          'ÚLTIMO',
        )?.CD_CONTA,
      ).toBe(cdConta);
    }
  });
});

describe('valorConta e subtrairValorConta', () => {
  it('lê o valor como número e mantém a escala original, sem converter', () => {
    expect(valorConta(linha({ VL_CONTA: '56701000.0000000000' }))).toEqual({
      valor: 56701000,
      escalaMoeda: 'MIL',
    });
    expect(valorConta(linha({ ESCALA_MOEDA: 'UNIDADE' })).escalaMoeda).toBe('UNIDADE');
  });

  it('trata qualquer escala desconhecida como MIL', () => {
    expect(valorConta(linha({ ESCALA_MOEDA: '' })).escalaMoeda).toBe('MIL');
  });

  it('4º trimestre = anual da DFP menos o acumulado até o 3º trimestre do ITR', () => {
    const anual = { valor: 230_000, escalaMoeda: 'MIL' as const };
    const acumuladoAte3T = { valor: 170_000, escalaMoeda: 'MIL' as const };

    expect(subtrairValorConta(anual, acumuladoAte3T)).toEqual({
      valor: 60_000,
      escalaMoeda: 'MIL',
    });
  });

  it('funciona com prejuízo: o trimestre pode sair negativo', () => {
    expect(
      subtrairValorConta({ valor: 100, escalaMoeda: 'MIL' }, { valor: 250, escalaMoeda: 'MIL' }),
    ).toEqual({ valor: -150, escalaMoeda: 'MIL' });
  });

  it('recusa subtrair valores em escalas diferentes', () => {
    expect(() =>
      subtrairValorConta({ valor: 1, escalaMoeda: 'MIL' }, { valor: 1, escalaMoeda: 'UNIDADE' }),
    ).toThrow('ESCALA_MOEDA divergente');
  });
});

describe('agruparPorEmpresa e demonstrativosDaEmpresa', () => {
  function ano(campos: Partial<DemonstrativosAno>): DemonstrativosAno {
    return {
      bpaCon: new Map(),
      bpaInd: new Map(),
      bppCon: new Map(),
      bppInd: new Map(),
      dreCon: new Map(),
      dreInd: new Map(),
      dfcCon: new Map(),
      dfcInd: new Map(),
      ...campos,
    };
  }

  it('agrupa as linhas pelo CD_CVM, preservando a ordem', () => {
    const grupos = agruparPorEmpresa([
      linha({ CD_CVM: '004170', VL_CONTA: 'a' }),
      linha({ CD_CVM: '019348', VL_CONTA: 'b' }),
      linha({ CD_CVM: '004170', VL_CONTA: 'c' }),
    ]);

    expect(grupos.get('004170')?.map((l) => l.VL_CONTA)).toEqual(['a', 'c']);
    expect(grupos.get('019348')?.map((l) => l.VL_CONTA)).toEqual(['b']);
  });

  it('usa o consolidado quando a empresa tem DRE consolidada', () => {
    const dreCon = [linha({ VL_CONTA: 'con' })];
    const resultado = demonstrativosDaEmpresa(
      ano({
        dreCon: new Map([['004170', dreCon]]),
        dreInd: new Map([['004170', [linha({ VL_CONTA: 'ind' })]]]),
        bpaCon: new Map([['004170', [linha({ VL_CONTA: 'bpa con' })]]]),
      }),
      '004170',
    );

    expect(resultado?.dre).toBe(dreCon);
    expect(resultado?.bpa[0].VL_CONTA).toBe('bpa con');
  });

  it('cai pro individual quando não há consolidado — e não mistura as variantes', () => {
    const resultado = demonstrativosDaEmpresa(
      ano({
        dreInd: new Map([['006505', [linha({ VL_CONTA: 'dre ind' })]]]),
        bpaInd: new Map([['006505', [linha({ VL_CONTA: 'bpa ind' })]]]),
        // Um BPA consolidado solto não pode entrar junto com a DRE individual.
        bpaCon: new Map([['006505', [linha({ VL_CONTA: 'bpa con' })]]]),
      }),
      '006505',
    );

    expect(resultado?.dre[0].VL_CONTA).toBe('dre ind');
    expect(resultado?.bpa[0].VL_CONTA).toBe('bpa ind');
  });

  it('trata DRE consolidada vazia como ausente', () => {
    const resultado = demonstrativosDaEmpresa(
      ano({
        dreCon: new Map([['006505', []]]),
        dreInd: new Map([['006505', [linha({ VL_CONTA: 'dre ind' })]]]),
      }),
      '006505',
    );

    expect(resultado?.dre[0].VL_CONTA).toBe('dre ind');
  });

  it('devolve undefined quando a empresa não entregou o trimestre', () => {
    expect(demonstrativosDaEmpresa(ano({}), '004170')).toBeUndefined();
  });
});
