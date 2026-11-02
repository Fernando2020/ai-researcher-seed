import { TestBed } from '@angular/core/testing';
import type { ChatEvent } from '@hero/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatError, ChatService } from './chat.service';
import type { GraphEvent } from './chat.service';

const RETRIEVE: ChatEvent = { type: 'retrieve', documents: [] };
const GRADE: ChatEvent = {
  type: 'grade',
  sufficient: false,
  missingAspects: ['motivo da queda'],
  iterations: 1,
};
const WEB_SEARCH: ChatEvent = { type: 'webSearch' };
const ANSWER: ChatEvent = { type: 'answer', response: 'Receita líquida de R$ 56,7 bilhões.' };

const frame = (evento: ChatEvent) => `data: ${JSON.stringify(evento)}\n\n`;

// Corpo em stream, entregue nos pedaços dados — cada um é o que uma leitura da rede devolveria.
function corpoEmPedacos(pedacos: Uint8Array[], aoCancelar?: () => void) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const pedaco of pedacos) controller.enqueue(pedaco);
      if (!aoCancelar) controller.close();
    },
    cancel: aoCancelar,
  });
}

const bytes = (texto: string) => new TextEncoder().encode(texto);

function stubFetch(resposta: Response) {
  const fetchFake = vi.fn().mockResolvedValue(resposta);
  vi.stubGlobal('fetch', fetchFake);
  return fetchFake;
}

async function coletar(question = 'Qual a receita da Vale?'): Promise<GraphEvent[]> {
  const eventos: GraphEvent[] = [];
  for await (const evento of TestBed.inject(ChatService).ask(question)) eventos.push(evento);
  return eventos;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ChatService.ask', () => {
  it('faz POST em /api/chat com a pergunta no corpo', async () => {
    const fetchFake = stubFetch(new Response(corpoEmPedacos([])));

    await coletar('Qual a receita da Vale?');

    const [url, init] = fetchFake.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/chat');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ question: 'Qual a receita da Vale?' });
  });

  it('produz os eventos do grafo na ordem, um por frame', async () => {
    const corpo = [RETRIEVE, GRADE, WEB_SEARCH, ANSWER].map(frame).join('');
    stubFetch(new Response(corpoEmPedacos([bytes(corpo)])));

    expect(await coletar()).toEqual([RETRIEVE, GRADE, WEB_SEARCH, ANSWER]);
  });

  it('remonta um frame que chega dividido em dois pedaços', async () => {
    const texto = frame(ANSWER);
    const meio = Math.floor(texto.length / 2);
    stubFetch(
      new Response(corpoEmPedacos([bytes(texto.slice(0, meio)), bytes(texto.slice(meio))])),
    );

    expect(await coletar()).toEqual([ANSWER]);
  });

  it('remonta um caractere acentuado dividido entre dois pedaços', async () => {
    const tudo = bytes(frame(ANSWER));
    // "í" de "líquida" ocupa dois bytes em UTF-8: o corte cai entre eles.
    const corte = tudo.indexOf(0xc3) + 1;
    stubFetch(new Response(corpoEmPedacos([tudo.slice(0, corte), tudo.slice(corte)])));

    expect(await coletar()).toEqual([ANSWER]);
  });

  it('lança a mensagem do evento error, depois de entregar os anteriores', async () => {
    const corpo = frame(RETRIEVE) + frame({ type: 'error', message: 'Tente novamente.' });
    stubFetch(new Response(corpoEmPedacos([bytes(corpo)])));

    const recebidos: GraphEvent[] = [];
    const consumir = async () => {
      for await (const evento of TestBed.inject(ChatService).ask('x')) recebidos.push(evento);
    };

    await expect(consumir()).rejects.toThrow(new ChatError('Tente novamente.'));
    expect(recebidos).toEqual([RETRIEVE]);
  });

  it('lança o detail do problem+json quando a API recusa a pergunta', async () => {
    stubFetch(
      new Response(
        JSON.stringify({
          type: 'about:blank',
          title: 'Requisição inválida',
          status: 400,
          detail: 'question: A pergunta não pode ser vazia.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );

    await expect(coletar()).rejects.toThrow('question: A pergunta não pode ser vazia.');
  });

  it('usa uma mensagem genérica quando o erro não vem em problem+json', async () => {
    stubFetch(new Response('Bad Gateway', { status: 502 }));

    await expect(coletar()).rejects.toThrow('Não foi possível consultar o assistente');
  });

  it('rejeita um evento fora do contrato', async () => {
    stubFetch(new Response(corpoEmPedacos([bytes('data: {"type":"token","text":"a"}\n\n')])));

    await expect(coletar()).rejects.toThrow();
  });

  it('encerra a leitura quando quem consome para de iterar', async () => {
    const cancelou = vi.fn();
    stubFetch(new Response(corpoEmPedacos([bytes(frame(RETRIEVE))], cancelou)));

    for await (const evento of TestBed.inject(ChatService).ask('x')) {
      expect(evento).toEqual(RETRIEVE);
      break;
    }

    expect(cancelou).toHaveBeenCalled();
  });

  it('repassa o signal para o fetch', async () => {
    const fetchFake = stubFetch(new Response(corpoEmPedacos([])));
    const { signal } = new AbortController();

    for await (const evento of TestBed.inject(ChatService).ask('x', signal)) {
      expect(evento).toBeUndefined();
    }

    expect((fetchFake.mock.calls[0] as [string, RequestInit])[1].signal).toBe(signal);
  });
});
