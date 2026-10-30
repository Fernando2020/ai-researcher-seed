import { ChatVertexAI } from '@langchain/google-vertexai';

// Cliente real de chat na Vertex AI. O nome do modelo vem de quem chama (MODEL_GRADE,
// MODEL_ANSWER) — um cliente por papel, pra o custo de cada nó aparecer separado no trace.
export function criarChatModelReal(model: string): ChatVertexAI {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      'GOOGLE_CLOUD_PROJECT_ID não configurada — necessária pra autenticar na Vertex AI. Ver infra/README.md.',
    );
  }

  return new ChatVertexAI({
    model,
    // Os modelos Gemini 3.x são servidos no endpoint global, não no regional (us-central1).
    location: process.env.GOOGLE_CLOUD_LOCATION ?? 'global',
    // Temperatura zero: a mesma pergunta com o mesmo contexto dá a mesma resposta — é o que
    // torna os evals comparáveis entre execuções.
    temperature: 0,
    // Mesmo motivo do criarEmbeddingsReal: string vazia força ADC em vez de GOOGLE_API_KEY.
    apiKey: '',
    authOptions: { projectId },
  });
}
