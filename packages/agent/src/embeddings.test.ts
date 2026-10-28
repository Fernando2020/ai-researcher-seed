import { VertexAIEmbeddings } from '@langchain/google-vertexai';
import { afterEach, describe, expect, it } from 'vitest';

import { criarEmbeddingsReal } from './embeddings.js';

// Criar o cliente não chama a rede — a primeira requisição só acontece no embedDocuments().
describe('criarEmbeddingsReal', () => {
  afterEach(() => {
    delete process.env.GOOGLE_CLOUD_PROJECT_ID;
  });

  it('com GOOGLE_CLOUD_PROJECT_ID, devolve o cliente da Vertex AI', () => {
    process.env.GOOGLE_CLOUD_PROJECT_ID = 'projeto-de-teste';

    expect(criarEmbeddingsReal()).toBeInstanceOf(VertexAIEmbeddings);
  });

  it('sem GOOGLE_CLOUD_PROJECT_ID, recusa criar o cliente em vez de deixar a Vertex AI falhar com erro obscuro', () => {
    delete process.env.GOOGLE_CLOUD_PROJECT_ID;

    expect(() => criarEmbeddingsReal()).toThrow('GOOGLE_CLOUD_PROJECT_ID');
  });
});
