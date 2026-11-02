import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CallbackHandler } from '@langfuse/langchain';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { criarCallbacksDeTracing, registrarTracing } from './tracing.js';

// Os dois construtores que falariam com o mundo de fora viram fakes: o teste não registra provider
// global de verdade nem envia nada pela rede.
const register = vi.hoisted(() => vi.fn());
vi.mock('@opentelemetry/sdk-trace-node', () => ({
  NodeTracerProvider: vi.fn(function () {
    return { register };
  }),
}));
vi.mock('@langfuse/otel', () => ({ LangfuseSpanProcessor: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('LANGFUSE_PUBLIC_KEY', '');
  vi.stubEnv('LANGFUSE_SECRET_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function configurarChaves(): void {
  vi.stubEnv('LANGFUSE_PUBLIC_KEY', 'pk-teste');
  vi.stubEnv('LANGFUSE_SECRET_KEY', 'sk-teste');
}

describe('registrarTracing', () => {
  it('sem as chaves, não registra nada', () => {
    registrarTracing();

    expect(LangfuseSpanProcessor).not.toHaveBeenCalled();
    expect(NodeTracerProvider).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it('com só uma das chaves, também não registra nada', () => {
    vi.stubEnv('LANGFUSE_PUBLIC_KEY', 'pk-teste');

    registrarTracing();

    expect(register).not.toHaveBeenCalled();
  });

  it('com as chaves, registra o provider com o processor do Langfuse', () => {
    configurarChaves();

    registrarTracing();

    expect(LangfuseSpanProcessor).toHaveBeenCalledWith({ exportMode: 'immediate' });
    expect(register).toHaveBeenCalledOnce();
  });
});

describe('criarCallbacksDeTracing', () => {
  it('sem as chaves, devolve uma lista vazia', () => {
    expect(criarCallbacksDeTracing()).toEqual([]);
  });

  it('com as chaves, cria um handler novo a cada chamada', () => {
    configurarChaves();

    const [primeiro] = criarCallbacksDeTracing();
    const [segundo] = criarCallbacksDeTracing();

    expect(primeiro).toBeInstanceOf(CallbackHandler);
    expect(segundo).toBeInstanceOf(CallbackHandler);
    expect(primeiro).not.toBe(segundo);
  });
});
