import { describe, expect, it, vi } from 'vitest';

import type { NovoDocumentoWeb } from '../db/save-web-documents.js';
import type { SearchResult } from '../search/search-provider.js';
import { makeWebSearchNode, montarQueries } from './web-search.js';

function resultado(numero: number): SearchResult {
  return {
    title: `Página ${numero}`,
    url: `https://exemplo.com/${numero}`,
    snippet: `Trecho ${numero}`,
  };
}

// Todas as dependências são fakes: sem Serper, sem fetch real, sem Vertex AI, sem Postgres.
function montarDeps(resultados: SearchResult[] = [resultado(1)]) {
  const salvos: NovoDocumentoWeb[] = [];
  const deps = {
    searchProvider: { search: vi.fn().mockResolvedValue(resultados) },
    buscarPagina: vi.fn().mockResolvedValue('<p>Conteúdo da página</p>'),
    embeddings: {
      embedDocuments: vi.fn((texts: string[]) => Promise.resolve(texts.map(() => [0.1, 0.2]))),
    },
    salvar: vi.fn((documentos: NovoDocumentoWeb[]) => {
      salvos.push(...documentos);
      return Promise.resolve();
    }),
  };
  return { deps, salvos };
}

describe('montarQueries', () => {
  it('monta uma query por aspecto faltante', () => {
    expect(montarQueries('Por que a Vale caiu?', ['notícias recentes', 'guidance'])).toEqual([
      'Por que a Vale caiu? notícias recentes',
      'Por que a Vale caiu? guidance',
    ]);
  });

  it('usa só a pergunta quando não há aspectos faltantes', () => {
    expect(montarQueries('Por que a Vale caiu?', [])).toEqual(['Por que a Vale caiu?']);
  });
});

describe('makeWebSearchNode', () => {
  it('busca uma vez por aspecto faltante', async () => {
    const { deps } = montarDeps();
    const node = makeWebSearchNode(deps);

    await node({ question: 'Pergunta', missingAspects: ['a', 'b'] });

    expect(deps.searchProvider.search).toHaveBeenCalledTimes(2);
    expect(deps.searchProvider.search).toHaveBeenCalledWith('Pergunta a');
    expect(deps.searchProvider.search).toHaveBeenCalledWith('Pergunta b');
  });

  it('processa só os 3 primeiros resultados de cada busca', async () => {
    const { deps } = montarDeps([1, 2, 3, 4, 5].map(resultado));
    const node = makeWebSearchNode(deps);

    await node({ question: 'Pergunta', missingAspects: [] });

    expect(deps.buscarPagina).toHaveBeenCalledTimes(3);
    expect(deps.buscarPagina).not.toHaveBeenCalledWith('https://exemplo.com/4');
  });

  it('salva cada chunk com texto extraído, metadados e o embedding correspondente', async () => {
    const { deps, salvos } = montarDeps();
    const node = makeWebSearchNode(deps);

    await node({ question: 'Pergunta', missingAspects: [] });

    expect(salvos).toHaveLength(1);
    expect(salvos[0]).toMatchObject({
      query: 'Pergunta',
      title: 'Página 1',
      content: 'Conteúdo da página',
      sourceUrl: 'https://exemplo.com/1',
      embedding: [0.1, 0.2],
    });
  });

  it('divide páginas longas em vários chunks, um documento por chunk', async () => {
    const { deps, salvos } = montarDeps();
    deps.buscarPagina.mockResolvedValue(`<p>${'x'.repeat(2500)}</p>`);
    const node = makeWebSearchNode(deps);

    await node({ question: 'Pergunta', missingAspects: [] });

    expect(salvos.map((documento) => documento.content.length)).toEqual([1000, 1000, 700]);
  });

  it('calcula expiresAt a partir do TTL — 7 dias por padrão', async () => {
    const { deps, salvos } = montarDeps();
    const node = makeWebSearchNode(deps);

    await node({ question: 'Pergunta', missingAspects: [] });

    const { fetchedAt, expiresAt } = salvos[0];
    expect(expiresAt.getTime() - fetchedAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('usa o TTL informado na factory', async () => {
    const { deps, salvos } = montarDeps();
    const node = makeWebSearchNode({ ...deps, ttlDias: 1 });

    await node({ question: 'Pergunta', missingAspects: [] });

    const { fetchedAt, expiresAt } = salvos[0];
    expect(expiresAt.getTime() - fetchedAt.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('ignora a página que falha e segue para as outras', async () => {
    const { deps, salvos } = montarDeps([1, 2, 3].map(resultado));
    deps.buscarPagina.mockImplementation((url: string) =>
      url.endsWith('/2')
        ? Promise.reject(new Error('timeout'))
        : Promise.resolve(`<p>Conteúdo de ${url}</p>`),
    );
    const node = makeWebSearchNode(deps);

    await expect(node({ question: 'Pergunta', missingAspects: [] })).resolves.toEqual({});

    expect(salvos.map((documento) => documento.sourceUrl)).toEqual([
      'https://exemplo.com/1',
      'https://exemplo.com/3',
    ]);
  });

  it('não processa duas vezes a mesma URL vinda de aspectos diferentes', async () => {
    const { deps } = montarDeps([resultado(1)]);
    const node = makeWebSearchNode(deps);

    await node({ question: 'Pergunta', missingAspects: ['a', 'b'] });

    expect(deps.buscarPagina).toHaveBeenCalledTimes(1);
  });

  it('não salva nada quando a página não tem texto legível', async () => {
    const { deps } = montarDeps();
    deps.buscarPagina.mockResolvedValue('<script>só código</script>');
    const node = makeWebSearchNode(deps);

    await node({ question: 'Pergunta', missingAspects: [] });

    expect(deps.salvar).not.toHaveBeenCalled();
  });

  it('se a busca de uma query falha, segue pra próxima sem propagar o erro', async () => {
    const { deps, salvos } = montarDeps();
    deps.searchProvider.search
      .mockRejectedValueOnce(new Error('HTTP 503'))
      .mockResolvedValueOnce([resultado(2)]);
    const node = makeWebSearchNode(deps);

    await expect(node({ question: 'Pergunta', missingAspects: ['a', 'b'] })).resolves.toEqual({});

    expect(deps.searchProvider.search).toHaveBeenCalledTimes(2);
    expect(salvos.map((documento) => documento.query)).toEqual(['Pergunta b']);
  });

  it('se todas as buscas falham, termina sem salvar nada e sem lançar erro', async () => {
    const { deps } = montarDeps();
    deps.searchProvider.search.mockRejectedValue(new Error('circuito aberto'));
    const node = makeWebSearchNode(deps);

    await expect(node({ question: 'Pergunta', missingAspects: ['a', 'b'] })).resolves.toEqual({});

    expect(deps.buscarPagina).not.toHaveBeenCalled();
    expect(deps.salvar).not.toHaveBeenCalled();
  });
});
