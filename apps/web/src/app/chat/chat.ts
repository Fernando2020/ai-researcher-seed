import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { GraphPanelComponent } from '../graph/graph-panel/graph-panel';
import { ChatStore } from '../state/chat-store';
import type { Mensagem } from '../state/chat-store';
import { parseAnswer } from '../state/citation';
import type { Citation } from '../state/citation';
import { CitationPanelComponent } from './citation-panel/citation-panel';

interface MensagemNaTela extends Mensagem {
  corpo: string;
  citacoes: Citation[];
}

@Component({
  selector: 'app-chat',
  imports: [CitationPanelComponent, GraphPanelComponent],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat {
  protected readonly store = inject(ChatStore);

  protected readonly pergunta = signal('');
  protected readonly citacaoAberta = signal<Citation | null>(null);

  protected readonly podeEnviar = computed(
    () => this.pergunta().trim() !== '' && !this.store.ocupado(),
  );

  // A resposta do assistente traz o bloco de fontes no fim do texto; a tela mostra o corpo e as
  // citações separados. As citações só aparecem quando o texto termina de ser revelado.
  protected readonly mensagens = computed<MensagemNaTela[]>(() =>
    this.store.mensagens().map((mensagem) => {
      if (mensagem.autor === 'usuario') {
        return { ...mensagem, corpo: mensagem.texto, citacoes: [] };
      }
      const { body, citations } = parseAnswer(mensagem.texto);
      return {
        ...mensagem,
        corpo: body,
        citacoes: mensagem.estado === 'concluida' ? citations : [],
      };
    }),
  );

  private readonly areaDeMensagens = viewChild.required<ElementRef<HTMLElement>>('areaDeMensagens');
  private readonly campo = viewChild.required<ElementRef<HTMLTextAreaElement>>('campo');

  // Quem abriu o painel recebe o foco de volta quando ele fecha.
  private pilulaDaCitacao: HTMLElement | null = null;

  constructor() {
    // Depois que cada palavra entra na tela, a conversa rola até o fim.
    afterRenderEffect(() => {
      this.mensagens();
      const area = this.areaDeMensagens().nativeElement;
      area.scrollTop = area.scrollHeight;
    });
  }

  protected aoDigitar(evento: Event): void {
    this.pergunta.set((evento.target as HTMLTextAreaElement).value);
  }

  // Enter envia e Shift+Enter quebra a linha. Durante a composição de um acento pelo teclado, o
  // Enter pertence ao sistema operacional, não ao chat.
  protected aoPressionarEnter(evento: Event): void {
    const tecla = evento as KeyboardEvent;
    if (tecla.shiftKey || tecla.isComposing) return;
    tecla.preventDefault();
    this.enviar();
  }

  protected enviar(): void {
    if (!this.podeEnviar()) return;
    this.citacaoAberta.set(null);
    void this.store.send(this.pergunta());
    this.pergunta.set('');
    // Limpa o DOM também: se o texto foi colado e enviado antes de um render, o signal foi de ''
    // a '' do ponto de vista do binding, que então não atualizaria o campo.
    this.campo().nativeElement.value = '';
  }

  // O texto é refeito a cada render, então a citação é comparada pelo conteúdo, não pelo objeto.
  protected estaAberta(citacao: Citation): boolean {
    const aberta = this.citacaoAberta();
    return aberta?.url === citacao.url && aberta.label === citacao.label;
  }

  protected alternarCitacao(citacao: Citation, evento: Event): void {
    if (this.estaAberta(citacao)) {
      this.citacaoAberta.set(null);
      return;
    }
    this.pilulaDaCitacao = evento.currentTarget as HTMLElement;
    this.citacaoAberta.set(citacao);
  }

  protected fecharCitacao(): void {
    this.citacaoAberta.set(null);
    this.pilulaDaCitacao?.focus();
  }
}
