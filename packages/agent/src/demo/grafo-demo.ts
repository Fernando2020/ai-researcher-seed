import type { RetrievedDoc } from '../db/retrieve-similar.js';
import type { AnswerLlmClient } from '../nodes/answer.js';
import type { GradeLlmClient } from '../nodes/grade.js';
import type { Buscar } from '../nodes/retrieve.js';

// Peças do modo DEMO: o grafo inteiro roda sem Vertex AI, sem Postgres e sem custo. Os dados são
// reais; o que é fixo é o caminho: qualquer pergunta recebe a mesma resposta.

// Congelado de packages/corpus/data/documentos/VALE.json, período 3T25.
const DOCUMENTO_VALE_3T25: RetrievedDoc = {
  origem: 'cvm',
  id: 'demo-vale-3t25',
  ticker: 'VALE',
  companyName: 'Vale S.A.',
  setor: 'Extração Mineral',
  period: '3T25',
  periodEnd: '2025-09-30',
  paragraph:
    'No 3T25, a Vale S.A. reportou receita líquida de R$ 56,7 bilhões, alta de 7,0% frente ao 3T24 e alta de 13,8% frente ao 2T25. O lucro líquido foi de R$ 14,7 bilhões, com margem líquida de 25,9%. O caixa gerado nas operações somou R$ 13,7 bilhões.',
  sourceUrl: 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip',
  fetchedAt: new Date('2026-08-08T02:19:40.760Z'),
  distance: 0,
};

// A resposta se identifica como fixa: quem perguntar sobre outra empresa não pode achar que recebeu
// uma resposta sobre a Vale por engano do sistema.
const RESPOSTA_DEMO =
  'Modo demonstração: esta resposta é fixa e não depende da pergunta.\n\nNo 3T25, a Vale S.A. reportou receita líquida de R$ 56,7 bilhões, lucro líquido de R$ 14,7 bilhões e caixa gerado nas operações de R$ 13,7 bilhões [CVM VALE 3T25].';

export function criarBuscarDemo(): Buscar {
  return () => Promise.resolve([DOCUMENTO_VALE_3T25]);
}

// Sempre suficiente: o grafo vai direto do grade pro answer, e o webSearch nunca roda.
export function criarGradeLlmDemo(): GradeLlmClient {
  return {
    withStructuredOutput: () => ({
      invoke: () => Promise.resolve({ sufficient: true, missingAspects: [] }),
    }),
  };
}

export function criarAnswerLlmDemo(): AnswerLlmClient {
  return { invoke: () => Promise.resolve({ text: RESPOSTA_DEMO }) };
}
