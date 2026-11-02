import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { criarGrafoReal } from '../criar-grafo.js';
import type { DocumentoCorpus } from '../db/retrieve-similar.js';
import { EMBEDDING_DIMENSIONS } from '../db/schema.js';
import { criarEmbeddings } from '../embeddings.js';
import { criarAnswerLlmDemo, criarBuscarDemo, criarGradeLlmDemo } from './grafo-demo.js';

interface DocumentoDoCorpus {
  period: string;
  paragraph: string;
  periodEnd: string;
  sourceUrl: string;
  fetchedAt: string;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('peças do modo DEMO', () => {
  it('criarBuscarDemo devolve o documento da Vale 3T25 igual ao do corpus', async () => {
    const corpus = JSON.parse(
      readFileSync(new URL('../../../corpus/data/documentos/VALE.json', import.meta.url), 'utf-8'),
    ) as DocumentoDoCorpus[];
    const original = corpus.find((documento) => documento.period === '3T25');

    const [documento] = (await criarBuscarDemo()([0], 5)) as DocumentoCorpus[];

    expect(documento).toMatchObject({
      paragraph: original?.paragraph,
      periodEnd: original?.periodEnd,
      sourceUrl: original?.sourceUrl,
    });
    expect(documento.fetchedAt.toISOString()).toBe(original?.fetchedAt);
  });

  it('criarGradeLlmDemo sempre considera o contexto suficiente', async () => {
    const structured = criarGradeLlmDemo().withStructuredOutput({} as never);

    await expect(structured.invoke('qualquer prompt')).resolves.toEqual({
      sufficient: true,
      missingAspects: [],
    });
  });

  it('criarAnswerLlmDemo responde um texto fixo, que se identifica como demonstração', async () => {
    const { text } = await criarAnswerLlmDemo().invoke('qualquer prompt');

    expect(text).toContain('Modo demonstração');
    expect(text).toContain('[CVM VALE 3T25]');
  });
});

describe('criarEmbeddings', () => {
  it('em DEMO, devolve vetores de zeros na dimensão do índice, sem exigir credencial', async () => {
    vi.stubEnv('DEMO', 'true');
    vi.stubEnv('GOOGLE_CLOUD_PROJECT_ID', undefined);

    const embeddings = criarEmbeddings();
    const vetor = await embeddings.embedQuery('qualquer pergunta');

    expect(vetor).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(vetor.every((valor) => valor === 0)).toBe(true);
  });

  it('fora de DEMO, usa o cliente real, que exige credencial', () => {
    vi.stubEnv('DEMO', undefined);
    vi.stubEnv('GOOGLE_CLOUD_PROJECT_ID', undefined);

    expect(() => criarEmbeddings()).toThrow('GOOGLE_CLOUD_PROJECT_ID');
  });
});

describe('grafo inteiro em DEMO', () => {
  beforeEach(() => {
    vi.stubEnv('DEMO', 'true');
    // Sem nenhuma credencial, e com qualquer acesso à rede falhando o teste.
    vi.stubEnv('GOOGLE_CLOUD_PROJECT_ID', undefined);
    vi.stubEnv('SERPER_API_KEY', undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rede não deveria ser usada')));
  });

  it('percorre retrieve, grade e answer, sem credenciais, rede nem Postgres', async () => {
    const caminho: string[] = [];
    let response = '';

    for await (const evento of await criarGrafoReal().stream(
      { question: 'Qual o guidance da Petrobras?' },
      { streamMode: 'updates' },
    )) {
      caminho.push(...Object.keys(evento));
      if (evento.answer) response = evento.answer.response ?? '';
    }

    expect(caminho).toEqual(['retrieve', 'grade', 'answer']);
    expect(response).toContain('Modo demonstração');
    expect(response).toContain('R$ 56,7 bilhões');
    expect(response).toContain('- VALE · 3T25 (data-base 30/09/2025)');
    expect(fetch).not.toHaveBeenCalled();
  });
});
