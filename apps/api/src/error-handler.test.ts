import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { CircuitoAbertoError } from '@hero/agent';
import { chatRequestSchema, problemDetailsSchema } from '@hero/contracts';
import { build } from './app.js';
import { registrarTratamentoDeErros } from './error-handler.js';
import { ChatIndisponivelError } from './errors.js';

// App mínimo só com o tratamento de erros e uma rota que lança o erro pedido — testa o
// mapeamento sem depender de nenhuma rota real.
function appQueLanca(erro: () => unknown) {
  const app = Fastify({ logger: false });
  registrarTratamentoDeErros(app);
  app.get('/falha', () => {
    throw erro();
  });
  return app;
}

async function problemaDe(erro: () => unknown) {
  const response = await appQueLanca(erro).inject({ method: 'GET', url: '/falha' });
  return {
    status: response.statusCode,
    contentType: response.headers['content-type'],
    corpo: problemDetailsSchema.parse(response.json()),
  };
}

describe('error handler central', () => {
  it('ZodError vira 400 com o campo e a mensagem de cada problema', async () => {
    const { status, contentType, corpo } = await problemaDe(() => {
      try {
        chatRequestSchema.parse({ question: '   ' });
      } catch (erro) {
        return erro;
      }
    });

    expect(status).toBe(400);
    expect(contentType).toContain('application/problem+json');
    expect(corpo).toEqual({
      type: 'about:blank',
      title: 'Requisição inválida',
      status: 400,
      detail: 'question: A pergunta não pode ser vazia.',
    });
  });

  it('CircuitoAbertoError vira 503', async () => {
    const { status, corpo } = await problemaDe(() => new CircuitoAbertoError('Serper', 30_000));

    expect(status).toBe(503);
    expect(corpo.title).toBe('Busca web indisponível');
  });

  it('ChatIndisponivelError vira 503', async () => {
    const { status, corpo } = await problemaDe(() => new ChatIndisponivelError());

    expect(status).toBe(503);
    expect(corpo.title).toBe('Chat indisponível');
  });

  it('qualquer outro erro vira 500 genérico, sem vazar mensagem nem stack', async () => {
    const segredo = 'connection to postgres://app_user:senha@10.0.0.1 failed';
    const response = await appQueLanca(() => new Error(segredo)).inject({
      method: 'GET',
      url: '/falha',
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Erro interno',
      status: 500,
      detail: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
    });
    expect(response.body).not.toContain('postgres');
    expect(response.body).not.toContain('at ');
  });

  it('algo lançado que nem é Error também vira 500', async () => {
    const { status } = await problemaDe(() => 'string solta');

    expect(status).toBe(500);
  });
});

describe('error handler na API montada', () => {
  const app = () => build({ checkDatabase: async () => true });

  it('JSON malformado vira 400 em problem+json, não 500', async () => {
    const response = await app().inject({
      method: 'POST',
      url: '/api/chat',
      headers: { 'content-type': 'application/json' },
      payload: '{"question": ',
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(problemDetailsSchema.parse(response.json()).status).toBe(400);
  });

  it('rota inexistente vira 404 em problem+json', async () => {
    const response = await app().inject({ method: 'GET', url: '/api/nao-existe' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(problemDetailsSchema.parse(response.json()).title).toBe('Não encontrado');
  });
});
