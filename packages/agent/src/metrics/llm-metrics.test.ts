import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import type { UsageMetadata } from '@langchain/core/messages';
import type { ChatResult, LLMResult } from '@langchain/core/outputs';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  criarMetricsCallback,
  llmCostUsdTotal,
  llmTokensTotal,
  registroDeMetricas,
} from './llm-metrics.js';

const USO: UsageMetadata = {
  input_tokens: 1000,
  output_tokens: 500,
  total_tokens: 1500,
  input_token_details: { cache_read: 200 },
  output_token_details: { reasoning: 300 },
};

function resultadoCom(usage_metadata?: UsageMetadata): LLMResult {
  const message = new AIMessage({ content: 'ok', usage_metadata });
  return { generations: [[{ text: 'ok', message } as LLMResult['generations'][0][0]]] };
}

// Simula o que o LangChain faz em volta de uma chamada ao modelo.
async function simularChamada(model: string, uso?: UsageMetadata): Promise<void> {
  const callback = criarMetricsCallback();
  const metadata = { langgraph_node: 'answer', ls_model_name: model };
  await callback.handleChatModelStart?.(
    { lc: 1, type: 'not_implemented', id: [] },
    [],
    'run-1',
    undefined,
    undefined,
    undefined,
    metadata,
  );
  await callback.handleLLMEnd?.(resultadoCom(uso), 'run-1');
}

async function tokens(kind: string, node = 'answer', model = 'gemini-3.6-flash') {
  const { values } = await llmTokensTotal.get();
  return values.find(
    (v) => v.labels.node === node && v.labels.model === model && v.labels.kind === kind,
  )?.value;
}

async function custo(node: string, model: string) {
  const { values } = await llmCostUsdTotal.get();
  return values.find((v) => v.labels.node === node && v.labels.model === model)?.value;
}

beforeEach(() => {
  registroDeMetricas.resetMetrics();
});

describe('criarMetricsCallback', () => {
  it('conta os tokens reais por tipo, sem contar cache e raciocínio duas vezes', async () => {
    await simularChamada('gemini-3.6-flash', USO);

    expect(await tokens('input')).toBe(800);
    expect(await tokens('cached_input')).toBe(200);
    expect(await tokens('output')).toBe(200);
    expect(await tokens('reasoning')).toBe(300);
  });

  it('calcula o custo pela tabela: raciocínio a preço de saída, cache a preço de cache', async () => {
    await simularChamada('gemini-3.6-flash', USO);

    // (800 × 0,75 + 200 × 0,075 + 500 × 3,75) / 1 milhão
    expect(await custo('answer', 'gemini-3.6-flash')).toBeCloseTo(0.00249, 8);
  });

  it('modelo fora da tabela: avisa, conta os tokens e não soma custo', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await simularChamada('modelo-novo', USO);

    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('modelo-novo'));
    expect(await tokens('input', 'answer', 'modelo-novo')).toBe(800);
    expect(await custo('answer', 'modelo-novo')).toBeUndefined();
    aviso.mockRestore();
  });

  it('sem usage_metadata, não inventa número', async () => {
    await simularChamada('gemini-3.6-flash');

    expect((await llmTokensTotal.get()).values).toEqual([]);
  });

  it('expõe as duas métricas no registry próprio', async () => {
    await simularChamada('gemini-3.6-flash', USO);

    const texto = await registroDeMetricas.metrics();
    expect(texto).toContain(
      'llm_tokens_total{node="answer",model="gemini-3.6-flash",kind="input"} 800',
    );
    expect(texto).toContain('llm_cost_usd_total{node="answer",model="gemini-3.6-flash"}');
  });
});

// Modelo fake sem rede, mas passando pelo caminho real do LangChain: é isso que preenche o metadata.
class ChatFake extends BaseChatModel {
  _llmType(): string {
    return 'fake';
  }

  override getLsParams(options: this['ParsedCallOptions']) {
    return { ...super.getLsParams(options), ls_model_name: 'gemini-3.5-flash-lite' };
  }

  _generate(): Promise<ChatResult> {
    const message = new AIMessage({ content: 'ok', usage_metadata: USO });
    return Promise.resolve({ generations: [{ text: 'ok', message }] });
  }
}

describe('criarMetricsCallback no grafo', () => {
  it('passado só no invoke, chega ao modelo dentro do nó e lê o nome do nó', async () => {
    const Estado = Annotation.Root({ texto: Annotation<string> });
    const modelo = new ChatFake({});
    const grafo = new StateGraph(Estado)
      .addNode('grade', async () => {
        const { text } = await modelo.invoke('oi');
        return { texto: text };
      })
      .addEdge(START, 'grade')
      .addEdge('grade', END)
      .compile();

    await grafo.invoke({ texto: '' }, { callbacks: [criarMetricsCallback()] });

    expect(await tokens('input', 'grade', 'gemini-3.5-flash-lite')).toBe(800);
    expect(await custo('grade', 'gemini-3.5-flash-lite')).toBeGreaterThan(0);
  });
});
