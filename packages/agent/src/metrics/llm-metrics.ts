import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { LLMResult } from '@langchain/core/outputs';
import type { UsageMetadata } from '@langchain/core/messages';
import { Counter, Registry } from 'prom-client';
import { consumirOrcamento } from './orcamento.js';
import { PRECOS_USD_POR_MILHAO } from './precos.js';

// Registry próprio, em vez do global do prom-client: aqui só entra o que este projeto declarou.
export const registroDeMetricas = new Registry();

export const llmTokensTotal = new Counter({
  name: 'llm_tokens_total',
  help: 'Tokens informados pela Vertex AI, por nó do grafo, modelo e tipo.',
  labelNames: ['node', 'model', 'kind'] as const,
  registers: [registroDeMetricas],
});

export const llmCostUsdTotal = new Counter({
  name: 'llm_cost_usd_total',
  help: 'Custo em USD, calculado dos tokens informados pela Vertex AI e da tabela de preços.',
  labelNames: ['node', 'model'] as const,
  registers: [registroDeMetricas],
});

const DESCONHECIDO = 'desconhecido';

function lerTexto(metadata: Record<string, unknown> | undefined, chave: string): string {
  const valor = metadata?.[chave];
  return typeof valor === 'string' ? valor : DESCONHECIDO;
}

// O `usage_metadata` fica na mensagem da geração; o tipo genérico do LLMResult não sabe disso.
function lerUso(output: LLMResult): UsageMetadata | undefined {
  const geracao = output.generations[0]?.[0] as
    { message?: { usage_metadata?: UsageMetadata } } | undefined;
  return geracao?.message?.usage_metadata;
}

function registrarUso(node: string, model: string, uso: UsageMetadata): void {
  // A Vertex AI inclui o cache no input e o raciocínio no output. Separados aqui, os quatro tipos
  // somam o total da chamada, sem contar nada duas vezes.
  const cachedInput = uso.input_token_details?.cache_read ?? 0;
  const reasoning = uso.output_token_details?.reasoning ?? 0;
  const input = uso.input_tokens - cachedInput;
  const output = uso.output_tokens - reasoning;

  llmTokensTotal.inc({ node, model, kind: 'input' }, input);
  llmTokensTotal.inc({ node, model, kind: 'cached_input' }, cachedInput);
  llmTokensTotal.inc({ node, model, kind: 'output' }, output);
  llmTokensTotal.inc({ node, model, kind: 'reasoning' }, reasoning);
  consumirOrcamento(uso.total_tokens);

  const preco = PRECOS_USD_POR_MILHAO[model];
  if (!preco) {
    // Vai pro stderr: no transporte stdio do MCP, o stdout é o canal do protocolo.
    console.warn(`[metrics] modelo sem preço na tabela, custo contado como zero: ${model}`);
    return;
  }

  const custo =
    (input * preco.input + cachedInput * preco.cachedInput + (output + reasoning) * preco.output) /
    1_000_000;
  llmCostUsdTotal.inc({ node, model }, custo);
}

// O início da chamada sabe o nó e o modelo; só o fim sabe os tokens. O runId liga os dois.
class MetricsCallback extends BaseCallbackHandler {
  name = 'metrics-callback';
  private readonly chamadas = new Map<string, { node: string; model: string }>();

  override handleChatModelStart(
    _llm: unknown,
    _messages: unknown,
    runId: string,
    _parentRunId?: string,
    _extraParams?: unknown,
    _tags?: unknown,
    metadata?: Record<string, unknown>,
  ): void {
    this.chamadas.set(runId, {
      node: lerTexto(metadata, 'langgraph_node'),
      model: lerTexto(metadata, 'ls_model_name'),
    });
  }

  override handleLLMEnd(output: LLMResult, runId: string): void {
    const chamada = this.chamadas.get(runId);
    this.chamadas.delete(runId);

    const uso = lerUso(output);
    if (!chamada || !uso) return;
    registrarUso(chamada.node, chamada.model, uso);
  }
}

// Um callback por chamada de graph.stream()/graph.invoke(), somado aos do Langfuse no call site.
// Nunca dentro de um nó ou de llm.ts: um `callbacks` explícito ali substituiria os que o LangGraph
// propaga por AsyncLocalStorage, em vez de somar a eles.
export function criarMetricsCallback(): BaseCallbackHandler {
  return new MetricsCallback();
}
