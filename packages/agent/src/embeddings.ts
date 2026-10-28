import { VertexAIEmbeddings } from '@langchain/google-vertexai';

import { EMBEDDING_DIMENSIONS } from './db/schema.js';

// Cliente real, que chama a Vertex AI pela rede. Fica numa função própria porque o modo
// DEMO (aula futura) troca esse ponto por um fake sem rede — quem consome embeddings não
// deve saber qual dos dois recebeu.
export function criarEmbeddingsReal(): VertexAIEmbeddings {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      'GOOGLE_CLOUD_PROJECT_ID não configurada — necessária pra autenticar na Vertex AI. Ver infra/README.md.',
    );
  }

  return new VertexAIEmbeddings({
    model: process.env.MODEL_EMBEDDING ?? 'gemini-embedding-001',
    location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
    dimensions: EMBEDDING_DIMENSIONS,
    // A Vertex AI só aceita OAuth2/ADC, nunca API key — mas o @langchain/google-vertexai
    // usa GOOGLE_API_KEY do ambiente se existir, mesmo pra Vertex, e a Predict API
    // rejeita API key com 401. String vazia é falsy e força o fallback pra ADC
    // ("gcloud auth application-default login").
    apiKey: '',
    // GOOGLE_CLOUD_PROJECT no ambiente é ambíguo (qualquer projeto Gemini/AI Studio anterior
    // do desenvolvedor pode tê-lo setado) — GOOGLE_CLOUD_PROJECT_ID é explícita deste projeto.
    authOptions: { projectId },
  });
}
