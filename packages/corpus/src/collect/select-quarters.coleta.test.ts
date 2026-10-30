import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Empresa, PeriodoColetado } from '../types.js';
import { nomeArquivoCsv, urlZipCvm, type TipoDocumento } from './cvm-urls.js';
import { coletarUltimosTrimestres } from './select-quarters.js';

// Só o download é trocado: em vez de baixar o ZIP da CVM, devolve um diretório temporário com
// CSVs escritos aqui (em latin1, como os reais). Parser e seleção rodam de verdade.
const diretorios = vi.hoisted(() => new Map<string, string>());

vi.mock('./fetch-cvm.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./fetch-cvm.js')>();
  return {
    ...original,
    baixarEDescompactar: (tipo: TipoDocumento, ano: number) => {
      const dir = diretorios.get(`${tipo}_${ano}`);
      if (!dir)
        return Promise.reject(new original.ArquivoCvmNaoEncontradoError(urlZipCvm(tipo, ano)));
      return Promise.resolve(dir);
    },
  };
});

const HEADER = [
  'CD_CVM',
  'DT_REFER',
  'VERSAO',
  'ORDEM_EXERC',
  'DT_INI_EXERC',
  'CD_CONTA',
  'DS_CONTA',
  'VL_CONTA',
  'ESCALA_MOEDA',
  'ST_CONTA_FIXA',
];

type Linha = [
  cdCvm: string,
  dtRefer: string,
  ordem: 'ÚLTIMO' | 'PENÚLTIMO',
  dtIni: string,
  cdConta: string,
  dsConta: string,
  valor: number,
];

const RECEITA = 'Receita de Venda de Bens e/ou Serviços';
const LUCRO_BRUTO = 'Resultado Bruto';
const LUCRO_LIQUIDO = 'Lucro/Prejuízo Consolidado do Período';
const PL = 'Patrimônio Líquido Consolidado';

const VALE = '004170'; // consolidado
const ASAI = '006505'; // só individual

const DEMONSTRATIVOS = ['BPA', 'BPP', 'DRE', 'DFC_MI'] as const;
type Demonstrativo = (typeof DEMONSTRATIVOS)[number];

// Grava os 8 CSVs de um (tipo, ano). O que não for informado vira arquivo só com cabeçalho.
function escreverAno(
  tipo: TipoDocumento,
  ano: number,
  dados: Partial<Record<`${Demonstrativo}_${'con' | 'ind'}`, Linha[]>>,
) {
  const dir = mkdtempSync(path.join(tmpdir(), `cvm-${tipo}-${ano}-`));
  for (const demonstrativo of DEMONSTRATIVOS) {
    for (const variante of ['con', 'ind'] as const) {
      const linhas = (dados[`${demonstrativo}_${variante}`] ?? []).map(
        ([cdCvm, dtRefer, ordem, dtIni, cdConta, dsConta, valor]) =>
          [cdCvm, dtRefer, '1', ordem, dtIni, cdConta, dsConta, String(valor), 'MIL', 'S'].join(
            ';',
          ),
      );
      const conteudo = [HEADER.join(';'), ...linhas].join('\r\n') + '\r\n';
      writeFileSync(
        path.join(dir, nomeArquivoCsv(tipo, `${demonstrativo}_${variante}`, ano)),
        Buffer.from(conteudo, 'latin1'),
      );
    }
  }
  diretorios.set(`${tipo}_${ano}`, dir);
}

// ITR 2025 de uma empresa: o 3T25 isolado, o acumulado até setembro (que o 4T25 subtrai) e o
// caixa acumulado até junho e até setembro (o caixa da CVM é sempre acumulado do ano).
function itr2025(cdCvm: string, base: number): Record<Demonstrativo, Linha[]> {
  return {
    DRE: [
      [cdCvm, '2025-09-30', 'ÚLTIMO', '2025-07-01', '3.01', RECEITA, base + 300],
      [cdCvm, '2025-09-30', 'ÚLTIMO', '2025-07-01', '3.03', LUCRO_BRUTO, base + 30],
      [cdCvm, '2025-09-30', 'ÚLTIMO', '2025-07-01', '3.11', LUCRO_LIQUIDO, base + 3],
      [cdCvm, '2025-09-30', 'ÚLTIMO', '2025-01-01', '3.01', RECEITA, base + 900],
      [cdCvm, '2025-09-30', 'ÚLTIMO', '2025-01-01', '3.03', LUCRO_BRUTO, base + 90],
      [cdCvm, '2025-09-30', 'ÚLTIMO', '2025-01-01', '3.11', LUCRO_LIQUIDO, base + 9],
      [cdCvm, '2025-09-30', 'PENÚLTIMO', '2024-07-01', '3.01', RECEITA, base + 250],
    ],
    BPA: [[cdCvm, '2025-09-30', 'ÚLTIMO', '', '1', 'Ativo Total', base + 5000]],
    BPP: [[cdCvm, '2025-09-30', 'ÚLTIMO', '', '2.03', PL, base + 2000]],
    DFC_MI: [
      [
        cdCvm,
        '2025-06-30',
        'ÚLTIMO',
        '2025-01-01',
        '6.01',
        'Caixa Líquido Atividades Operacionais',
        base + 600,
      ],
      [
        cdCvm,
        '2025-09-30',
        'ÚLTIMO',
        '2025-01-01',
        '6.01',
        'Caixa Líquido Atividades Operacionais',
        base + 1000,
      ],
    ],
  };
}

// DFP 2025: o ano inteiro, de onde sai o 4T25 por subtração.
function dfp2025(cdCvm: string, base: number): Record<Demonstrativo, Linha[]> {
  return {
    DRE: [
      [cdCvm, '2025-12-31', 'ÚLTIMO', '2025-01-01', '3.01', RECEITA, base + 1200],
      [cdCvm, '2025-12-31', 'ÚLTIMO', '2025-01-01', '3.03', LUCRO_BRUTO, base + 120],
      [cdCvm, '2025-12-31', 'ÚLTIMO', '2025-01-01', '3.11', LUCRO_LIQUIDO, base + 12],
    ],
    BPA: [[cdCvm, '2025-12-31', 'ÚLTIMO', '', '1', 'Ativo Total', base + 5500]],
    BPP: [[cdCvm, '2025-12-31', 'ÚLTIMO', '', '2.03', PL, base + 2100]],
    DFC_MI: [
      [
        cdCvm,
        '2025-12-31',
        'ÚLTIMO',
        '2025-01-01',
        '6.01',
        'Caixa Líquido Atividades Operacionais',
        base + 1500,
      ],
    ],
  };
}

const empresas: Empresa[] = [
  { ticker: 'VALE', razaoSocial: 'Vale S.A.', cdCvm: VALE, setor: 'Mineração' },
  { ticker: 'ASAI', razaoSocial: 'Sendas Distribuidora S.A.', cdCvm: ASAI, setor: 'Varejo' },
];

function porPeriodo(resultado: PeriodoColetado[], ticker: string, period: string) {
  const encontrado = resultado.find((p) => p.empresa.ticker === ticker && p.period === period);
  if (!encontrado) throw new Error(`${ticker} ${period} não coletado`);
  return encontrado;
}

describe('coletarUltimosTrimestres (download trocado por CSVs locais)', () => {
  let resultado: PeriodoColetado[];

  beforeAll(async () => {
    const vale = itr2025(VALE, 0);
    const asai = itr2025(ASAI, 10_000);
    escreverAno('ITR', 2025, {
      DRE_con: vale.DRE,
      BPA_con: vale.BPA,
      BPP_con: vale.BPP,
      DFC_MI_con: vale.DFC_MI,
      DRE_ind: asai.DRE,
      BPA_ind: asai.BPA,
      BPP_ind: asai.BPP,
      DFC_MI_ind: asai.DFC_MI,
    });
    const valeDfp = dfp2025(VALE, 0);
    const asaiDfp = dfp2025(ASAI, 10_000);
    escreverAno('DFP', 2025, {
      DRE_con: valeDfp.DRE,
      BPA_con: valeDfp.BPA,
      BPP_con: valeDfp.BPP,
      DFC_MI_con: valeDfp.DFC_MI,
      DRE_ind: asaiDfp.DRE,
      BPA_ind: asaiDfp.BPA,
      BPP_ind: asaiDfp.BPP,
      DFC_MI_ind: asaiDfp.DFC_MI,
    });
    // ITR 2026 não existe: o 1T26 tem de ser ignorado, não derrubar a coleta.

    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    resultado = await coletarUltimosTrimestres(empresas, {
      hoje: new Date(Date.UTC(2026, 0, 15)),
      quantidadeTrimestres: 2,
      candidatosMax: 3,
    });
  });

  it('pula o trimestre cujo ZIP a CVM ainda não publicou e segue pros anteriores', () => {
    expect(new Set(resultado.map((p) => p.period))).toEqual(new Set(['4T25', '3T25']));
  });

  it('4T25 = anual da DFP menos o acumulado até setembro do ITR (não o 3T25 isolado)', () => {
    const { indicadores, periodEnd, sourceUrl } = porPeriodo(resultado, 'VALE', '4T25');

    expect(periodEnd).toBe('2025-12-31');
    expect(sourceUrl).toBe(urlZipCvm('DFP', 2025));
    expect(indicadores.receitaLiquida.valor).toBe(1200 - 900);
    expect(indicadores.lucroBruto.valor).toBe(120 - 90);
    expect(indicadores.lucroLiquido.valor).toBe(12 - 9);
    expect(indicadores.caixaOperacional.valor).toBe(1500 - 1000);
  });

  it('4T25 usa o balanço do fim do ano direto, sem subtração', () => {
    const { indicadores, receitaMesmoTrimestreAnoAnterior } = porPeriodo(resultado, 'VALE', '4T25');

    expect(indicadores.ativoTotal.valor).toBe(5500);
    expect(indicadores.patrimonioLiquido.valor).toBe(2100);
    expect(receitaMesmoTrimestreAnoAnterior).toBeUndefined();
  });

  it('3T25 usa a DRE do trimestre isolado, e o caixa = acumulado set − acumulado jun', () => {
    const { indicadores, receitaMesmoTrimestreAnoAnterior } = porPeriodo(resultado, 'VALE', '3T25');

    expect(indicadores.receitaLiquida.valor).toBe(300);
    expect(indicadores.lucroLiquido.valor).toBe(3);
    expect(indicadores.caixaOperacional.valor).toBe(1000 - 600);
    // PENÚLTIMO com início no 3º trimestre do ano anterior.
    expect(receitaMesmoTrimestreAnoAnterior?.valor).toBe(250);
  });

  it('coleta pelo demonstrativo individual a empresa que não consolida', () => {
    const asai4T = porPeriodo(resultado, 'ASAI', '4T25');
    const asai3T = porPeriodo(resultado, 'ASAI', '3T25');

    expect(asai4T.indicadores.receitaLiquida.valor).toBe(10_000 + 1200 - (10_000 + 900));
    expect(asai3T.indicadores.receitaLiquida.valor).toBe(10_300);
  });
});
