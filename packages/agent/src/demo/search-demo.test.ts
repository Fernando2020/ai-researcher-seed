import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildGraph } from '../graph.js';
import { criarSearchProvider } from '../search/index.js';
import { criarBuscarPagina } from '../web/criar-buscar-pagina.js';
import { extrairTexto } from '../web/extract-text.js';
import { buscarHtml } from '../web/fetch-html.js';
import { FIXTURE_GENERICA } from './fixtures.js';
import { buscarPaginaDemo, escolherFixture, makeDemoSearchProvider } from './search-demo.js';

interface PerguntaDataset {
  id: string;
  pergunta: string;
}

// As perguntas vêm do próprio dataset de evals: se o texto delas mudar, o teste acompanha.
const dataset = JSON.parse(
  readFileSync(new URL('../../../../evals/dataset.json', import.meta.url), 'utf-8'),
) as PerguntaDataset[];
const pergunta = (id: string) => {
  const encontrada = dataset.find((item) => item.id === id);
  if (!encontrada) throw new Error(`${id} não está no dataset`);
  return encontrada.pergunta;
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('escolherFixture', () => {
  it.each([
    ['B01', 'https://demo.invalid/vale/receita-trimestral'],
    ['B02', 'https://demo.invalid/vale/receita-trimestral'],
    ['B03', 'https://demo.invalid/petrobras/fatos-relevantes'],
    ['B05', 'https://demo.invalid/klabin/resultado-trimestral'],
  ])('casa a pergunta %s do grupo B com a fixture da empresa', (id, primeiraUrl) => {
    expect(escolherFixture(pergunta(id)).resultados[0].url).toBe(primeiraUrl);
  });

  it('casa pelo ticker, sem diferenciar maiúscula nem acento', () => {
    expect(escolherFixture('Resultado de PETR4').resultados[0].url).toContain('petrobras');
    expect(escolherFixture('notícias KLBN11').resultados[0].url).toContain('klabin');
    expect(escolherFixture('PETRÓBRAS dividendos').resultados[0].url).toContain('petrobras');
  });

  it('com duas empresas na query, a de fixture mais específica vence o "vale" de "vale a pena"', () => {
    expect(escolherFixture('Vale a pena olhar a Petrobras?').resultados[0].url).toContain(
      'petrobras',
    );
  });

  it('pergunta sem fixture cadastrada cai na genérica', () => {
    expect(escolherFixture(pergunta('B06'))).toBe(FIXTURE_GENERICA);
  });
});

describe('makeDemoSearchProvider e buscarPaginaDemo', () => {
  it('devolve resultados no formato do SearchProvider, sem o HTML', async () => {
    const resultados = await makeDemoSearchProvider().search(pergunta('B03'));

    expect(resultados[0]).toEqual({
      title: '[DEMO] Petrobras: como acompanhar fatos relevantes',
      snippet: expect.any(String) as string,
      url: 'https://demo.invalid/petrobras/fatos-relevantes',
    });
  });

  it('toda URL de fixture tem página, e o texto extraído se identifica como demonstração', async () => {
    const resultados = await makeDemoSearchProvider().search(pergunta('B05'));
    const texto = extrairTexto(await buscarPaginaDemo(resultados[0].url));

    expect(texto).toContain('Conteúdo de demonstração do AI Researcher');
    expect(texto).toContain('celulose');
    expect(texto).not.toContain('ignorado pela extração');
  });

  it('URL desconhecida recebe a página genérica, nunca erro', async () => {
    await expect(buscarPaginaDemo('https://qualquer.coisa/x')).resolves.toBe(
      FIXTURE_GENERICA.resultados[0].html,
    );
  });
});

describe('DEMO=true nas fábricas', () => {
  it('criarSearchProvider usa as fixtures, mesmo sem SERPER_API_KEY', async () => {
    vi.stubEnv('DEMO', 'true');
    vi.stubEnv('SERPER_API_KEY', undefined);
    const fetchFake = vi.fn();
    vi.stubGlobal('fetch', fetchFake);

    const resultados = await criarSearchProvider().search(pergunta('B01'));

    expect(resultados[0].url).toContain('demo.invalid/vale');
    expect(fetchFake).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('sem DEMO, criarSearchProvider continua exigindo a chave do provedor real', () => {
    vi.stubEnv('DEMO', undefined);
    vi.stubEnv('SERPER_API_KEY', undefined);

    expect(() => criarSearchProvider()).toThrow('SERPER_API_KEY');
  });

  it('criarBuscarPagina troca o download real pelas fixtures só com DEMO=true', () => {
    vi.stubEnv('DEMO', 'true');
    expect(criarBuscarPagina()).toBe(buscarPaginaDemo);

    vi.stubEnv('DEMO', 'false');
    expect(criarBuscarPagina()).toBe(buscarHtml);
  });
});

describe('grafo com a busca demo', () => {
  it('o fallback web grava os trechos das fixtures e volta ao retrieve', async () => {
    const salvos: { sourceUrl: string; content: string }[] = [];
    let rodadaGrade = 0;

    // Só a busca é demo; embeddings, banco e LLMs aqui são fakes de teste, como no graph.test.
    const app = buildGraph({
      embeddings: {
        embedQuery: () => Promise.resolve([0.1]),
        embedDocuments: (texts: string[]) => Promise.resolve(texts.map(() => [0.1])),
      },
      buscar: () => Promise.resolve([]),
      gradeLlm: {
        withStructuredOutput: () => ({
          invoke: () =>
            Promise.resolve(
              rodadaGrade++ === 0
                ? { sufficient: false, missingAspects: ['fato relevante recente'] }
                : { sufficient: true, missingAspects: [] },
            ),
        }),
      },
      searchProvider: makeDemoSearchProvider(),
      buscarPagina: buscarPaginaDemo,
      salvarDocumentosWeb: (documentos) => {
        salvos.push(...documentos);
        return Promise.resolve();
      },
      answerLlm: { invoke: () => Promise.resolve({ text: 'Resposta.' }) },
    });

    await app.invoke({ question: pergunta('B03') });

    expect(salvos.length).toBeGreaterThan(0);
    expect(salvos.every((doc) => doc.sourceUrl.startsWith('https://demo.invalid/petrobras'))).toBe(
      true,
    );
    expect(salvos[0].content).toContain('Resolução CVM 44');
  });
});
