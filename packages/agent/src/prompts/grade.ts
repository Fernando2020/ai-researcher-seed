import type { RetrievedDoc } from '../db/retrieve-similar.js';
import { formatarContexto } from './contexto.js';

export function gradePrompt({
  question,
  documents,
}: {
  question: string;
  documents: RetrievedDoc[];
}): string {
  return `Você avalia se o contexto abaixo é suficiente pra responder a pergunta do usuário.

Contexto recuperado:
${formatarContexto(documents)}

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
