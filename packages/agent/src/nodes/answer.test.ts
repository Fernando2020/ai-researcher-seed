import { describe, expect, it, vi } from 'vitest';

import { AVISO_GUARDRAIL, contemRecomendacao } from '../answer/format-resposta.js';
import type { DocumentoCorpus, DocumentoWeb } from '../db/retrieve-similar.js';
import { answerPrompt } from '../prompts/answer.js';
import { makeAnswerNode } from './answer.js';

const documentoCvm: DocumentoCorpus = {
  origem: 'cvm',
  id: '1',
  ticker: 'PETR',
  companyName: 'Petróleo Brasileiro S.A. - Petrobras',
  setor: 'Petróleo, Gás e Biocombustíveis',
  period: '3T25',
  periodEnd: '2025-09-30',
  paragraph: 'No 3T25, a Petrobras reportou lucro líquido de R$ 32,7 bilhões.',
  sourceUrl: 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip',
  fetchedAt: new Date('2026-08-08T02:19:40.760Z'),
  distance: 0.1,
};

const documentoWeb: DocumentoWeb = {
  origem: 'web',
  id: '2',
  title: 'Petrobras divulga resultado do 3T25',
  content: 'O lucro foi impulsionado pela alta da produção.',
  sourceUrl: 'https://exemplo.com/petrobras-3t25',
  fetchedAt: new Date('2026-10-20T10:00:00.000Z'),
  distance: 0.2,
};

// LLM fake: devolve o texto pronto, sem chamar a Vertex AI.
function fakeLlm(texto: string) {
  return { invoke: vi.fn().mockResolvedValue({ text: texto }) };
}

describe('makeAnswerNode', () => {
  it('devolve a resposta do LLM com a citação e o bloco de fontes', async () => {
    const llm = fakeLlm(
      'A Petrobras teve lucro líquido de R$ 32,7 bilhões no 3T25 [CVM PETR 3T25].',
    );
    const node = makeAnswerNode(llm);

    const { response } = await node({
      question: 'Qual o lucro da Petrobras no 3T25?',
      documents: [documentoCvm, documentoWeb],
      sufficient: true,
    });

    expect(response).toContain('R$ 32,7 bilhões no 3T25 [CVM PETR 3T25]');
    expect(response).toContain('Fontes:');
    expect(response).toContain('- PETR 3T25, data-base 30/09/2025 (CVM Dados Abertos)');
    expect(response).toContain(
      '- Petrobras divulga resultado do 3T25 (https://exemplo.com/petrobras-3t25)',
    );
  });

  // Teste de guardrail obrigatório (CLAUDE.md): não pode ser removido. Se quebrar, o problema é
  // o comportamento, não o teste.
  it('substitui a resposta pelo aviso fixo quando o LLM tenta recomendar, mantendo as fontes', async () => {
    const llm = fakeLlm('Com esse lucro, recomendo comprar PETR4 agora [CVM PETR 3T25].');
    const node = makeAnswerNode(llm);

    const { response } = await node({
      question: 'Devo comprar PETR4?',
      documents: [documentoCvm],
      sufficient: true,
    });

    expect(response.startsWith(AVISO_GUARDRAIL)).toBe(true);
    expect(response).not.toContain('recomendo comprar');
    expect(contemRecomendacao(response)).toBe(false);
    expect(response).toContain('- PETR 3T25, data-base 30/09/2025 (CVM Dados Abertos)');
  });

  it('passa sufficient=false pro prompt, que manda avisar o contexto incompleto', async () => {
    const llm = fakeLlm('O contexto está incompleto.');
    const node = makeAnswerNode(llm);

    await node({ question: 'Qual o guidance da Petrobras?', documents: [], sufficient: false });

    expect(llm.invoke).toHaveBeenCalledWith(expect.stringContaining('incompleto'));
  });
});

describe('answerPrompt', () => {
  it('já instrui o modelo a nunca recomendar, mesmo quando a pergunta pede', () => {
    const prompt = answerPrompt({
      question: 'Devo comprar PETR4?',
      documents: [documentoCvm],
      sufficient: true,
    });

    expect(prompt).toContain('Nunca recomende comprar, vender ou manter');
    expect(prompt).toContain('mesmo que a pergunta peça isso diretamente');
    expect(prompt).toContain('Nunca invente número');
  });

  it('só inclui o aviso de contexto incompleto quando sufficient é false', () => {
    const base = { question: 'q', documents: [documentoCvm] };

    expect(answerPrompt({ ...base, sufficient: true })).not.toContain('incompleto');
    expect(answerPrompt({ ...base, sufficient: false })).toContain('incompleto');
  });
});
