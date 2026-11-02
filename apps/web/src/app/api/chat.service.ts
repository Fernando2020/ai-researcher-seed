import { Injectable } from '@angular/core';
import { chatEventSchema, problemDetailsSchema } from '@hero/contracts';
import type { ChatEvent } from '@hero/contracts';

// Os eventos que chegam a quem consome o serviço: o `error` do stream vira exceção.
export type GraphEvent = Exclude<ChatEvent, { type: 'error' }>;

export class ChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatError';
  }
}

const SEPARADOR_DE_FRAMES = '\n\n';
const PREFIXO_DE_DADOS = 'data: ';
const MENSAGEM_GENERICA = 'Não foi possível consultar o assistente. Tente novamente em instantes.';

// Um POST com resposta em stream: o HttpClient entrega o corpo só no final, e o EventSource só
// faz GET. Por isso, fetch e leitura direta do ReadableStream.
@Injectable({ providedIn: 'root' })
export class ChatService {
  // O signal permite cancelar a requisição — conexão esquecida mantém a instância do Cloud Run
  // viva e aparece na conta. Parar de iterar o generator também encerra a leitura.
  async *ask(question: string, signal?: AbortSignal): AsyncGenerator<GraphEvent> {
    const resposta = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
      signal,
    });

    if (!resposta.ok || !resposta.body) {
      throw new ChatError(await lerMensagemDeErro(resposta));
    }

    for await (const evento of lerEventos(resposta.body)) {
      if (evento.type === 'error') throw new ChatError(evento.message);
      yield evento;
    }
  }
}

// O status de erro vem antes do stream começar, em problem+json. Se o corpo vier em outro formato
// (um proxy fora do ar, por exemplo), a mensagem é a genérica.
async function lerMensagemDeErro(resposta: Response): Promise<string> {
  try {
    return problemDetailsSchema.parse(await resposta.json()).detail;
  } catch {
    return MENSAGEM_GENERICA;
  }
}

// Frames são blocos separados por linha em branco, cada um com `data: {json}`. Um pedaço lido da
// rede pode terminar no meio de um frame, ou até no meio de um caractere acentuado: o buffer
// guarda o frame incompleto, e o `stream: true` faz o decoder guardar o caractere incompleto.
async function* lerEventos(corpo: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  const leitor = corpo.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) return;

      buffer += decoder.decode(value, { stream: true });

      let fim = buffer.indexOf(SEPARADOR_DE_FRAMES);
      while (fim !== -1) {
        const frame = buffer.slice(0, fim);
        buffer = buffer.slice(fim + SEPARADOR_DE_FRAMES.length);
        if (frame.startsWith(PREFIXO_DE_DADOS)) {
          yield chatEventSchema.parse(JSON.parse(frame.slice(PREFIXO_DE_DADOS.length)));
        }
        fim = buffer.indexOf(SEPARADOR_DE_FRAMES);
      }
    }
  } finally {
    // Roda também quando quem consome para de iterar antes do fim: fecha a conexão.
    await leitor.cancel();
  }
}
