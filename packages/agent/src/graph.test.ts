import { describe, expect, it, vi } from 'vitest';

import { buildGraph, MAX_ITERATIONS } from './graph.js';
import type { GraphDeps } from './graph.js';

interface GradeFake {
  sufficient: boolean;
  missingAspects: string[];
}

const SUFICIENTE: GradeFake = { sufficient: true, missingAspects: [] };
const INSUFICIENTE: GradeFake = { sufficient: false, missingAspects: ['notícias recentes'] };

// Todas as dependências são fakes. O LLM do grade devolve as classificações na ordem dada e,
// depois que elas acabam, repete a última — assim dá pra simular um LLM que nunca se convence.
function montarDeps(classificacoes: GradeFake[]) {
  let chamada = 0;
  const invoke = vi.fn(() => {
    const resultado = classificacoes[Math.min(chamada, classificacoes.length - 1)];
    chamada++;
    return Promise.resolve(resultado);
  });

  const deps = {
    embeddings: {
      embedQuery: vi.fn().mockResolvedValue([0.1, 0.2]),
      embedDocuments: vi.fn((texts: string[]) => Promise.resolve(texts.map(() => [0.1, 0.2]))),
    },
    buscar: vi.fn().mockResolvedValue([]),
    gradeLlm: { withStructuredOutput: () => ({ invoke }) },
    searchProvider: {
      search: vi
        .fn()
        .mockResolvedValue([{ title: 'Página', snippet: 'Trecho', url: 'https://exemplo.com/1' }]),
    },
    buscarPagina: vi.fn().mockResolvedValue('<p>Conteúdo da página</p>'),
    salvarDocumentosWeb: vi.fn().mockResolvedValue(undefined),
    answerLlm: { invoke: vi.fn().mockResolvedValue({ text: 'Resposta do fake.' }) },
  } satisfies GraphDeps;

  return { deps, gradeInvoke: invoke };
}

// Roda o grafo com streamMode 'updates': cada evento é `{ nomeDoNo: atualização }`, então as
// chaves dos eventos, em ordem, são o caminho percorrido.
async function nosVisitados(deps: GraphDeps, question: string): Promise<string[]> {
  const app = buildGraph(deps);
  const visitados: string[] = [];
  for await (const evento of await app.stream({ question }, { streamMode: 'updates' })) {
    visitados.push(...Object.keys(evento));
  }
  return visitados;
}

describe('buildGraph', () => {
  it('vai direto pro answer quando o grade considera suficiente na primeira rodada', async () => {
    const { deps } = montarDeps([SUFICIENTE]);

    const caminho = await nosVisitados(deps, 'Qual a receita da Vale no 3T25?');

    expect(caminho).toEqual(['retrieve', 'grade', 'answer']);
    expect(deps.searchProvider.search).not.toHaveBeenCalled();
  });

  it('faz o loop completo quando insuficiente, e responde quando a web resolve', async () => {
    const { deps } = montarDeps([INSUFICIENTE, SUFICIENTE]);

    const caminho = await nosVisitados(deps, 'Por que a receita da Vale caiu?');

    expect(caminho).toEqual(['retrieve', 'grade', 'webSearch', 'retrieve', 'grade', 'answer']);
    // O webSearch recebeu os aspectos faltantes que o grade produziu.
    expect(deps.searchProvider.search).toHaveBeenCalledWith(
      'Por que a receita da Vale caiu? notícias recentes',
    );
    expect(deps.salvarDocumentosWeb).toHaveBeenCalled();
  });

  it('corta em MAX_ITERATIONS rodadas de grade mesmo com o LLM sempre insuficiente', async () => {
    const { deps, gradeInvoke } = montarDeps([INSUFICIENTE]);

    const caminho = await nosVisitados(deps, 'Qual o guidance da Vale?');

    expect(caminho.filter((no) => no === 'grade')).toHaveLength(MAX_ITERATIONS);
    expect(gradeInvoke).toHaveBeenCalledTimes(MAX_ITERATIONS);
    // Depois da última rodada não há outra busca na web: vai pro answer com contexto parcial.
    expect(caminho.slice(-2)).toEqual(['grade', 'answer']);
    expect(caminho.filter((no) => no === 'webSearch')).toHaveLength(MAX_ITERATIONS - 1);
  });

  it('soma iterations pelo reducer: o estado final tem uma por rodada de grade', async () => {
    const { deps } = montarDeps([INSUFICIENTE]);

    const final = await buildGraph(deps).invoke({ question: 'Qual o guidance da Vale?' });

    expect(final.iterations).toBe(MAX_ITERATIONS);
    expect(final.sufficient).toBe(false);
    // O answer recebeu sufficient=false e o prompt avisa o contexto incompleto.
    expect(deps.answerLlm.invoke).toHaveBeenCalledWith(expect.stringContaining('incompleto'));
    expect(final.response).toContain('Resposta do fake.');
  });

  it('com a busca web sempre falhando, o grafo ainda termina no answer com o corpus CVM', async () => {
    const { deps } = montarDeps([INSUFICIENTE]);
    // Serper fora do ar (ou circuito aberto): toda chamada de busca falha.
    deps.searchProvider.search.mockRejectedValue(new Error('Serper fora do ar'));
    // O corpus CVM continua respondendo.
    deps.buscar.mockResolvedValue([
      {
        origem: 'cvm',
        id: '1',
        ticker: 'VALE',
        companyName: 'Vale S.A.',
        setor: 'Mineração',
        period: '1T26',
        periodEnd: '2026-03-31',
        paragraph: 'No 1T26, a Vale S.A. reportou receita líquida de R$ 47,1 bilhões.',
        sourceUrl: 'https://dados.cvm.gov.br/itr_cia_aberta_2026.zip',
        fetchedAt: new Date('2026-08-08T02:19:40.760Z'),
        distance: 0.1,
      },
    ]);
    deps.answerLlm.invoke.mockResolvedValue({
      text: 'Não encontrei o motivo da queda; o contexto está incompleto. A receita no 1T26 foi de R$ 47,1 bilhões [CVM VALE 1T26].',
    });

    const app = buildGraph(deps);
    const caminho: string[] = [];
    let response = '';
    for await (const evento of await app.stream(
      { question: 'Por que a receita da Vale caiu do 4T25 para o 1T26?' },
      { streamMode: 'updates' },
    )) {
      caminho.push(...Object.keys(evento));
      if (evento.answer) response = evento.answer.response ?? '';
    }

    // Passou pelo webSearch, que falhou sem derrubar nada, e o guard cortou o loop.
    expect(caminho).toEqual(['retrieve', 'grade', 'webSearch', 'retrieve', 'grade', 'answer']);
    expect(deps.searchProvider.search).toHaveBeenCalled();
    expect(deps.salvarDocumentosWeb).not.toHaveBeenCalled();
    // O answer recebeu o aviso de contexto incompleto e respondeu com o que o corpus tinha.
    expect(deps.answerLlm.invoke).toHaveBeenCalledWith(expect.stringContaining('incompleto'));
    expect(response).toContain('R$ 47,1 bilhões [CVM VALE 1T26]');
    expect(response).toContain(
      '- VALE · 1T26 (data-base 31/03/2026) (https://dados.cvm.gov.br/itr_cia_aberta_2026.zip)',
    );
  });
});
