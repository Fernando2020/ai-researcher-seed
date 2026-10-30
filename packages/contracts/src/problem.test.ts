import { describe, expect, it } from 'vitest';
import { problemDetailsSchema } from './problem.js';

describe('problemDetailsSchema', () => {
  it('aceita um problem details completo', () => {
    const problema = {
      type: 'about:blank',
      title: 'Requisição inválida',
      status: 400,
      detail: 'question: A pergunta não pode ser vazia.',
    };

    expect(problemDetailsSchema.parse(problema)).toEqual(problema);
  });

  it('rejeita status fora da faixa de erro HTTP', () => {
    expect(() =>
      problemDetailsSchema.parse({ type: 'about:blank', title: 'OK', status: 200, detail: '' }),
    ).toThrow();
  });

  it('rejeita payload sem detail', () => {
    expect(() =>
      problemDetailsSchema.parse({ type: 'about:blank', title: 'Erro', status: 500 }),
    ).toThrow();
  });
});
