import { describe, expect, it } from 'vitest';
import { chatEventSchema, chatRequestSchema } from './chat.js';

describe('chatRequestSchema', () => {
  it('aceita uma pergunta e remove espaços das pontas', () => {
    expect(chatRequestSchema.parse({ question: '  Qual a receita da Vale?  ' })).toEqual({
      question: 'Qual a receita da Vale?',
    });
  });

  it('rejeita pergunta vazia ou só com espaços', () => {
    expect(() => chatRequestSchema.parse({ question: '   ' })).toThrow();
  });

  it('rejeita corpo sem question', () => {
    expect(() => chatRequestSchema.parse({})).toThrow();
  });

  it('rejeita pergunta acima de 1000 caracteres', () => {
    expect(() => chatRequestSchema.parse({ question: 'x'.repeat(1001) })).toThrow();
  });
});

describe('chatEventSchema', () => {
  it('aceita documentos da CVM com data-base e da web com data de coleta', () => {
    const evento = {
      type: 'retrieve',
      documents: [
        {
          origem: 'cvm',
          rotulo: 'KLBN 1T26',
          sourceUrl: 'https://dados.cvm.gov.br/itr.zip',
          distance: 0.15,
          companyName: 'Klabin S.A.',
          period: '1T26',
          periodEnd: '2026-03-31',
        },
        {
          origem: 'web',
          rotulo: 'Página',
          sourceUrl: 'https://exemplo.com',
          distance: 0.2,
          fetchedAt: '2026-10-20T10:00:00.000Z',
        },
      ],
    };

    expect(chatEventSchema.parse(evento)).toEqual(evento);
  });

  it('rejeita documento da CVM sem data-base', () => {
    expect(() =>
      chatEventSchema.parse({
        type: 'retrieve',
        documents: [
          {
            origem: 'cvm',
            rotulo: 'KLBN 1T26',
            sourceUrl: 'https://x',
            distance: 0.1,
            companyName: 'Klabin S.A.',
            period: '1T26',
          },
        ],
      }),
    ).toThrow();
  });

  it('rejeita tipo de evento desconhecido', () => {
    expect(() => chatEventSchema.parse({ type: 'token', text: 'a' })).toThrow();
  });
});
