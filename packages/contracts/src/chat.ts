import { z } from 'zod';

// Limite de tamanho: a pergunta vira prompt de LLM e query de busca — texto gigante só
// aumenta custo, nunca a qualidade da resposta.
export const chatRequestSchema = z.object({
  question: z.string().trim().min(1, 'A pergunta não pode ser vazia.').max(1000),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
