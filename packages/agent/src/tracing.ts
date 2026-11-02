import { CallbackHandler } from '@langfuse/langchain';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

// Observabilidade é opcional: sem as duas chaves, o processo roda igual, só que sem trace.
function langfuseConfigurado(): boolean {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

// Chamada uma vez, no boot de cada processo que pode invocar o grafo. O provider é global: é por
// ele que os spans criados pelo CallbackHandler chegam ao Langfuse. As chaves e o LANGFUSE_BASE_URL
// o próprio processor lê do ambiente.
export function registrarTracing(): void {
  if (!langfuseConfigurado()) return;

  const provider = new NodeTracerProvider({
    // `immediate` envia cada span ao terminar, sem esperar um lote. O Cloud Run congela a CPU entre
    // requisições e o cliente MCP encerra o processo stdio quando quer: um lote parado em memória
    // atrasaria ou perderia o trace.
    spanProcessors: [new LangfuseSpanProcessor({ exportMode: 'immediate' })],
  });
  provider.register();
}

// Um handler novo por chamada de graph.stream()/graph.invoke(): é ele que transforma a execução
// em um trace, com um span por nó. Sem as chaves, a lista vazia faz o LangChain não chamar nada.
export function criarCallbacksDeTracing(): CallbackHandler[] {
  return langfuseConfigurado() ? [new CallbackHandler()] : [];
}
