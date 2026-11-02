import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { ChatService } from '../api/chat.service';
import { tokenize } from './tokenize';

export const MS_POR_PALAVRA = 70;

export const MENSAGEM_ERRO = 'Não foi possível responder agora. Tente novamente em instantes.';

export type EstadoMensagem = 'aguardando' | 'revelando' | 'concluida' | 'erro';

export interface Mensagem {
  id: number;
  autor: 'usuario' | 'assistente';
  texto: string;
  estado: EstadoMensagem;
}

@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly chatService = inject(ChatService);

  private readonly _mensagens = signal<Mensagem[]>([]);
  readonly mensagens = this._mensagens.asReadonly();

  // Enquanto a última resposta não termina, uma nova pergunta não entra.
  readonly ocupado = computed(() => {
    const estado = this._mensagens().at(-1)?.estado;
    return estado === 'aguardando' || estado === 'revelando';
  });

  private proximoId = 1;
  private timer: ReturnType<typeof setInterval> | undefined;
  private conexao: AbortController | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearInterval(this.timer);
      this.conexao?.abort();
    });
  }

  async send(question: string): Promise<void> {
    const pergunta = question.trim();
    if (pergunta === '' || this.ocupado()) return;

    const idResposta = this.adicionarPergunta(pergunta);
    const conexao = new AbortController();
    this.conexao = conexao;

    try {
      for await (const evento of this.chatService.ask(pergunta, conexao.signal)) {
        if (evento.type === 'answer') {
          this.revelar(idResposta, evento.response);
          return;
        }
      }
      // O stream terminou sem resposta: para o usuário, é o mesmo que uma falha.
      this.mostrarErro(idResposta);
    } catch {
      // O texto é fixo: o detalhe técnico do erro nunca aparece na conversa. Cancelamento só
      // acontece quando o store é destruído, e aí não há mais ninguém olhando.
      if (!conexao.signal.aborted) this.mostrarErro(idResposta);
    }
  }

  private adicionarPergunta(pergunta: string): number {
    const idPergunta = this.proximoId++;
    const idResposta = this.proximoId++;
    this._mensagens.update((atuais) => [
      ...atuais,
      { id: idPergunta, autor: 'usuario', texto: pergunta, estado: 'concluida' },
      { id: idResposta, autor: 'assistente', texto: '', estado: 'aguardando' },
    ]);
    return idResposta;
  }

  // A API entrega o texto inteiro, já filtrado pelo guardrail. A revelação é só apresentação: uma
  // recomendação bloqueada nunca chega à tela, nem por um instante.
  private revelar(id: number, texto: string): void {
    const tokens = tokenize(texto);
    let revelados = 0;

    this.atualizar(id, { estado: 'revelando' });
    this.timer = setInterval(() => {
      revelados++;
      this.atualizar(id, { texto: tokens.slice(0, revelados).join('') });

      if (revelados >= tokens.length) {
        clearInterval(this.timer);
        this.atualizar(id, { estado: 'concluida' });
      }
    }, MS_POR_PALAVRA);
  }

  private mostrarErro(id: number): void {
    this.atualizar(id, { texto: MENSAGEM_ERRO, estado: 'erro' });
  }

  private atualizar(id: number, mudancas: Partial<Mensagem>): void {
    this._mensagens.update((atuais) =>
      atuais.map((mensagem) => (mensagem.id === id ? { ...mensagem, ...mudancas } : mensagem)),
    );
  }
}
