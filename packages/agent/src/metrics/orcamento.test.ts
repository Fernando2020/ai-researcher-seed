import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarMetricsCallback } from './llm-metrics.js';
import { consumirOrcamento, orcamentoEsgotado } from './orcamento.js';

// A conta vive no módulo. Cada teste começa num dia novo, e é a própria virada que a zera.
let diaDoTeste = 1;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(2026, 0, diaDoTeste, 12)));
  diaDoTeste += 2;
  vi.stubEnv('DAILY_TOKEN_BUDGET', '1000');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('orçamento diário de tokens', () => {
  it('esgota ao atingir o limite, não antes', () => {
    consumirOrcamento(999);
    expect(orcamentoEsgotado()).toBe(false);

    consumirOrcamento(1);
    expect(orcamentoEsgotado()).toBe(true);
  });

  it('zera na virada do dia UTC, e não antes dela', () => {
    consumirOrcamento(1000);
    const hoje = new Date();

    vi.setSystemTime(
      Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate(), 23, 59, 59),
    );
    expect(orcamentoEsgotado()).toBe(true);

    vi.setSystemTime(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + 1));
    expect(orcamentoEsgotado()).toBe(false);
  });

  it('lê o limite do ambiente a cada verificação', () => {
    consumirOrcamento(1000);
    expect(orcamentoEsgotado()).toBe(true);

    vi.stubEnv('DAILY_TOKEN_BUDGET', '2000');
    expect(orcamentoEsgotado()).toBe(false);
  });

  it('limite inválido não libera nem bloqueia tudo: avisa e usa o padrão', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('DAILY_TOKEN_BUDGET', 'abc');

    expect(orcamentoEsgotado()).toBe(false);
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('DAILY_TOKEN_BUDGET'));
    aviso.mockRestore();
  });

  it('é alimentado pelo callback de métricas, com o total real da chamada', async () => {
    const callback = criarMetricsCallback();
    await callback.handleChatModelStart?.(
      { lc: 1, type: 'not_implemented', id: [] },
      [],
      'run-1',
      undefined,
      undefined,
      undefined,
      { langgraph_node: 'answer', ls_model_name: 'gemini-3.6-flash' },
    );

    await callback.handleLLMEnd?.(
      {
        generations: [
          [
            {
              text: 'ok',
              message: {
                usage_metadata: { input_tokens: 600, output_tokens: 400, total_tokens: 1000 },
              },
            } as never,
          ],
        ],
      },
      'run-1',
    );

    expect(orcamentoEsgotado()).toBe(true);
  });
});
