import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { CircuitoAbertoError } from '@hero/agent';
import { problemDetailsSchema, ZodError } from '@hero/contracts';
import type { ProblemDetails } from '@hero/contracts';
import { ChatIndisponivelError } from './errors.js';

function problema(status: number, title: string, detail: string): ProblemDetails {
  return problemDetailsSchema.parse({ type: 'about:blank', title, status, detail });
}

// Erro de validação vira uma lista legível: "question: A pergunta não pode ser vazia."
function detalharValidacao(erro: ZodError): string {
  return erro.issues
    .map((issue) =>
      issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
    )
    .join('; ');
}

// Erros que o próprio Fastify lança antes da rota (JSON malformado, corpo grande demais,
// content-type não suportado) já trazem um status 4xx e uma mensagem segura pro cliente.
function ehErroDeClienteDoFastify(erro: unknown): erro is FastifyError {
  if (typeof erro !== 'object' || erro === null || !('statusCode' in erro)) return false;
  const { statusCode } = erro;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500;
}

// Traduz qualquer erro num problem details. É o único lugar da API que decide status de erro.
export function paraProblema(erro: unknown): ProblemDetails {
  if (erro instanceof ZodError) {
    return problema(400, 'Requisição inválida', detalharValidacao(erro));
  }
  if (erro instanceof CircuitoAbertoError) {
    return problema(
      503,
      'Busca web indisponível',
      'O serviço de busca está instável. Tente novamente em alguns segundos.',
    );
  }
  if (erro instanceof ChatIndisponivelError) {
    return problema(503, 'Chat indisponível', erro.message);
  }
  if (ehErroDeClienteDoFastify(erro)) {
    // Quem lança o 429 é o @fastify/rate-limit, que já deixou o Retry-After na resposta.
    if (erro.statusCode === 429) {
      return problema(
        429,
        'Muitas requisições',
        'Você fez muitas requisições em pouco tempo. Aguarde um instante e tente de novo.',
      );
    }
    return problema(erro.statusCode ?? 400, 'Requisição inválida', erro.message);
  }
  // Qualquer outro erro é falha nossa: a mensagem e a stack ficam no log, nunca na resposta.
  return problema(500, 'Erro interno', 'Ocorreu um erro inesperado. Tente novamente mais tarde.');
}

function tratarErro(erro: unknown, request: FastifyRequest, reply: FastifyReply) {
  const corpo = paraProblema(erro);

  if (corpo.status >= 500) {
    request.log.error(erro, 'Erro não tratado na rota');
  } else {
    request.log.info({ err: erro }, 'Requisição recusada');
  }

  return reply.code(corpo.status).type('application/problem+json').send(corpo);
}

// Registrado uma vez, na raiz, antes das rotas: os plugins registrados depois herdam os dois
// handlers. Rota de URL inexistente também responde em problem+json — formato único em toda a API.
export function registrarTratamentoDeErros(app: FastifyInstance) {
  app.setErrorHandler(tratarErro);
  app.setNotFoundHandler((request, reply) => {
    const corpo = problema(404, 'Não encontrado', `${request.method} ${request.url} não existe.`);
    return reply.code(404).type('application/problem+json').send(corpo);
  });
}
