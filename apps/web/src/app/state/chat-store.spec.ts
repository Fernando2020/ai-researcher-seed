import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatService } from '../api/chat.service';
import type { GraphEvent } from '../api/chat.service';
import { ChatStore, MENSAGEM_ERRO, MS_POR_PALAVRA } from './chat-store';

const ANSWER: GraphEvent = { type: 'answer', response: 'Receita de R$ 56,7 bilhões.' };
const PALAVRAS = 5;

// ChatService fake: entrega os eventos dados e, se `erro` vier, lança depois deles.
function montar(eventos: GraphEvent[], erro?: Error) {
  const ask = vi.fn(async function* (): AsyncGenerator<GraphEvent> {
    for (const evento of eventos) yield evento;
    if (erro) throw erro;
  });
  TestBed.configureTestingModule({
    providers: [{ provide: ChatService, useValue: { ask } }],
  });
  return { store: TestBed.inject(ChatStore), ask };
}

const avancar = (ms: number) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ChatStore.send', () => {
  it('adiciona a pergunta e um placeholder do assistente, e chama o serviço', () => {
    const { store, ask } = montar([]);

    void store.send('  Qual a receita da Vale?  ');

    expect(store.mensagens()).toMatchObject([
      { autor: 'usuario', texto: 'Qual a receita da Vale?', estado: 'concluida' },
      { autor: 'assistente', texto: '', estado: 'aguardando' },
    ]);
    expect(store.ocupado()).toBe(true);
    expect(ask).toHaveBeenCalledWith('Qual a receita da Vale?', expect.any(AbortSignal));
  });

  it('ignora os eventos que não são answer: o placeholder continua vazio', async () => {
    const { store } = montar([{ type: 'retrieve', documents: [] }, { type: 'webSearch' }, ANSWER]);

    void store.send('x');
    await avancar(0);

    expect(store.mensagens()[1].texto).toBe('');
    expect(store.mensagens()[1].estado).toBe('revelando');
  });

  it('revela o texto palavra por palavra, a cada 70 ms', async () => {
    const { store } = montar([ANSWER]);

    void store.send('x');
    await avancar(0);

    await avancar(MS_POR_PALAVRA - 1);
    expect(store.mensagens()[1].texto).toBe('');

    await avancar(1);
    expect(store.mensagens()[1].texto).toBe('Receita ');

    await avancar(MS_POR_PALAVRA);
    expect(store.mensagens()[1].texto).toBe('Receita de ');
    expect(store.mensagens()[1].estado).toBe('revelando');
  });

  it('ao fim da revelação, a mensagem conclui com o texto completo', async () => {
    const { store } = montar([ANSWER]);

    void store.send('x');
    await avancar(0);
    await avancar(MS_POR_PALAVRA * PALAVRAS);

    expect(store.mensagens()[1]).toMatchObject({
      texto: 'Receita de R$ 56,7 bilhões.',
      estado: 'concluida',
    });
    expect(store.ocupado()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('se a chamada falhar, mostra a mensagem fixa, de uma vez e sem o detalhe do erro', async () => {
    const { store } = montar([], new Error('connect ECONNREFUSED 10.0.0.5'));

    void store.send('x');
    await avancar(0);

    expect(store.mensagens()[1]).toMatchObject({ texto: MENSAGEM_ERRO, estado: 'erro' });
    expect(vi.getTimerCount()).toBe(0);
    expect(store.ocupado()).toBe(false);
  });

  it('se o stream terminar sem answer, também mostra a mensagem de erro', async () => {
    const { store } = montar([{ type: 'webSearch' }]);

    void store.send('x');
    await avancar(0);

    expect(store.mensagens()[1]).toMatchObject({ texto: MENSAGEM_ERRO, estado: 'erro' });
  });

  it('ignora pergunta vazia', () => {
    const { store, ask } = montar([]);

    void store.send('   ');

    expect(store.mensagens()).toEqual([]);
    expect(ask).not.toHaveBeenCalled();
  });

  it('ignora uma nova pergunta enquanto a anterior não termina', async () => {
    const { store, ask } = montar([ANSWER]);

    void store.send('primeira');
    await avancar(0);
    void store.send('segunda');

    expect(ask).toHaveBeenCalledTimes(1);
    expect(store.mensagens()).toHaveLength(2);
  });

  it('aceita a próxima pergunta depois de concluir, sem misturar as respostas', async () => {
    const { store } = montar([ANSWER]);

    void store.send('primeira');
    await avancar(0);
    await avancar(MS_POR_PALAVRA * PALAVRAS);
    void store.send('segunda');
    await avancar(0);
    await avancar(MS_POR_PALAVRA);

    expect(store.mensagens()).toHaveLength(4);
    expect(store.mensagens()[1].texto).toBe('Receita de R$ 56,7 bilhões.');
    expect(store.mensagens()[3].texto).toBe('Receita ');
  });
});

describe('ChatStore ao ser destruído', () => {
  it('limpa o timer da revelação em andamento', async () => {
    const { store } = montar([ANSWER]);

    void store.send('x');
    await avancar(0);
    await avancar(MS_POR_PALAVRA);
    expect(vi.getTimerCount()).toBe(1);

    TestBed.resetTestingModule();

    expect(vi.getTimerCount()).toBe(0);
    await avancar(MS_POR_PALAVRA * PALAVRAS);
    expect(store.mensagens()[1].texto).toBe('Receita ');
  });

  it('cancela a conexão aberta, sem mostrar erro', async () => {
    let signalRecebido: AbortSignal | undefined;
    const ask = vi.fn(async function* (
      _pergunta: string,
      signal: AbortSignal,
    ): AsyncGenerator<GraphEvent> {
      signalRecebido = signal;
      await new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('abortado')));
      });
      yield { type: 'webSearch' };
    });
    TestBed.configureTestingModule({
      providers: [{ provide: ChatService, useValue: { ask } }],
    });
    const store = TestBed.inject(ChatStore);

    void store.send('x');
    await avancar(0);
    TestBed.resetTestingModule();
    await avancar(0);

    expect(signalRecebido?.aborted).toBe(true);
    expect(store.mensagens()[1].estado).toBe('aguardando');
  });
});
