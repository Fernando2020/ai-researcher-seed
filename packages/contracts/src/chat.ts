import { z } from 'zod';

// Limite de tamanho: a pergunta vira prompt de LLM e query de busca — texto gigante só
// aumenta custo, nunca a qualidade da resposta.
export const chatRequestSchema = z.object({
  question: z.string().trim().min(1, 'A pergunta não pode ser vazia.').max(1000),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

// Os dois tipos de documento têm metadados diferentes: o da CVM tem trimestre e data-base; o da
// web tem só a data da coleta. O campo `origem` diz qual é qual.
const documentoBase = {
  rotulo: z.string(),
  sourceUrl: z.string(),
  distance: z.number(),
};

export const documentoResumidoSchema = z.discriminatedUnion('origem', [
  z.object({
    origem: z.literal('cvm'),
    ...documentoBase,
    companyName: z.string(),
    period: z.string(),
    // Data-base do período, em ISO: "2026-03-31".
    periodEnd: z.string(),
  }),
  z.object({
    origem: z.literal('web'),
    ...documentoBase,
    fetchedAt: z.iso.datetime(),
  }),
]);

export type DocumentoResumido = z.infer<typeof documentoResumidoSchema>;

// Um evento SSE por nó concluído do grafo. O campo `type` diz qual nó terminou.
export const chatEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('retrieve'), documents: z.array(documentoResumidoSchema) }),
  z.object({
    type: z.literal('grade'),
    sufficient: z.boolean(),
    missingAspects: z.array(z.string()),
    iterations: z.number().int(),
  }),
  z.object({ type: z.literal('webSearch') }),
  z.object({ type: z.literal('answer'), response: z.string() }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);

export type ChatEvent = z.infer<typeof chatEventSchema>;
