import { formatarResposta } from '../answer/format-resposta.js';
import type { RetrievedDoc } from '../db/retrieve-similar.js';
import { answerPrompt } from '../prompts/answer.js';

// Só a parte do estado que este nó lê.
export interface AnswerState {
  question: string;
  documents: RetrievedDoc[];
  sufficient: boolean;
}

// Estruturalmente compatível com ChatVertexAI.invoke(): a mensagem devolvida tem `.text`.
// O nó só conhece esta operação — no teste, um fake sem rede.
export interface AnswerLlmClient {
  invoke(prompt: string): Promise<{ text: string }>;
}

export function makeAnswerNode(llm: AnswerLlmClient) {
  return async (state: AnswerState) => {
    const mensagem = await llm.invoke(
      answerPrompt({
        question: state.question,
        documents: state.documents,
        sufficient: state.sufficient,
      }),
    );

    // O texto do LLM nunca chega ao usuário sem passar pelo filtro do guardrail.
    return { response: formatarResposta(mensagem.text, state.documents) };
  };
}
