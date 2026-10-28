import type { RetrievedDoc } from '../db/retrieve-similar.js';

// Cada documento é rotulado pela origem: o LLM precisa saber o que é indicador da CVM e o que
// é trecho de página da web, porque só o segundo pode responder pergunta qualitativa.
function formatarDocumento(doc: RetrievedDoc): string {
  if (doc.origem === 'cvm') {
    return `- [CVM ${doc.ticker} ${doc.period}] ${doc.paragraph}`;
  }
  return `- [WEB "${doc.title}" ${doc.sourceUrl}] ${doc.content}`;
}

export function gradePrompt({
  question,
  documents,
}: {
  question: string;
  documents: RetrievedDoc[];
}): string {
  const contexto = documents.map(formatarDocumento).join('\n');

  return `Você avalia se o contexto abaixo é suficiente pra responder a pergunta do usuário.

Contexto recuperado:
${contexto || '(nenhum documento encontrado)'}

Pergunta: ${question}

Há dois tipos de documento no contexto:
- [CVM ...]: indicadores financeiros trimestrais (receita, lucro, ativo total, patrimônio líquido,
  caixa operacional), por empresa e trimestre. São só números.
- [WEB ...]: trechos de páginas da web, encontrados numa busca anterior.

Perguntas qualitativas (motivo por trás de um número, notícia, fato relevante, guidance,
posicionamento de mercado, previsão de preço futuro) nunca são respondidas só com documentos [CVM] —
considere insuficiente nesses casos, mesmo que eles sejam da empresa certa. Elas só podem ser
consideradas suficientes se algum trecho [WEB] tratar diretamente do que foi perguntado.
Responda se o contexto é suficiente e, se não for, liste os aspectos que faltam.`;
}
