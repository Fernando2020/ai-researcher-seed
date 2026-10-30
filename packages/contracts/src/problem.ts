import { z } from 'zod';

// RFC 7807 (Problem Details for HTTP APIs): o formato único de erro da API, servido como
// `application/problem+json`. Fica em contracts porque o frontend lê o mesmo formato pra mostrar
// o erro na tela.
export const problemDetailsSchema = z.object({
  // URI que identifica o tipo de problema. `about:blank` quando o status HTTP já diz tudo.
  type: z.string(),
  // Resumo curto e fixo por tipo de problema — não muda de uma ocorrência pra outra.
  title: z.string(),
  status: z.number().int().min(400).max(599),
  // Explicação desta ocorrência, legível por humano. Nunca carrega stack trace nem detalhe interno.
  detail: z.string(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

// Reexportado pra API reconhecer erro de validação (`instanceof ZodError`) sem depender do zod
// diretamente — a validação já é responsabilidade deste pacote.
export { ZodError } from 'zod';
