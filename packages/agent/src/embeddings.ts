import { VertexAIEmbeddings } from '@langchain/google-vertexai';

import { EMBEDDING_DIMENSIONS } from './db/schema.js';
import type { DocumentEmbeddingsClient } from './nodes/web-search.js';
import type { EmbeddingsClient } from './nodes/retrieve.js';

// O cliente de embeddings do grafo. Único ponto que lê DEMO pros embeddings: em modo demo, a busca
// por similaridade também é fixture, então o valor do vetor não importa.
export function criarEmbeddings(): EmbeddingsClient & DocumentEmbeddingsClient {
  if (process.env.DEMO !== 'true') return criarEmbeddingsReal();

  const vetorDeZeros = () => new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  return {
    embedQuery: () => Promise.resolve(vetorDeZeros()),
    embedDocuments: (textos) => Promise.resolve(textos.map(vetorDeZeros)),
  };
}

// Cliente real, que chama a Vertex AI pela rede. O seed usa esta função direto, e nunca roda em
// modo demo: vetores de zeros no índice quebrariam a busca de verdade. Em modo real, o nó
// webSearch também usa o embedDocuments() para gravar os trechos da web.
export function criarEmbeddingsReal(): VertexAIEmbeddings {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      'GOOGLE_CLOUD_PROJECT_ID não configurada — necessária pra autenticar na Vertex AI. Ver infra/README.md.',
    );
  }

  return new VertexAIEmbeddings({
    model: process.env.MODEL_EMBEDDING ?? 'gemini-embedding-001',
    // Mesmo endpoint do chat. O gemini-embedding-001 devolve vetores idênticos no global e no
    // us-central1 — trocar o endpoint não invalida o índice; trocar o modelo, sim.
    location: process.env.GOOGLE_CLOUD_LOCATION ?? 'global',
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
