import { computed, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatStore } from '../state/chat-store';
import type { Mensagem } from '../state/chat-store';
import { Chat } from './chat';

const ZIP = 'https://dados.cvm.gov.br/itr_cia_aberta_2026.zip';

const pergunta: Mensagem = {
  id: 1,
  autor: 'usuario',
  texto: 'Qual a receita?',
  estado: 'concluida',
};

function resposta(texto: string, estado: Mensagem['estado']): Mensagem {
  return { id: 2, autor: 'assistente', texto, estado };
}

describe('Chat', () => {
  // Store fake: o teste decide as mensagens e olha o que o componente pediu.
  const mensagens = signal<Mensagem[]>([]);
  const send = vi.fn();
  let fixture: ComponentFixture<Chat>;

  beforeEach(() => {
    mensagens.set([]);
    send.mockClear();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ChatStore,
          useValue: {
            mensagens,
            send,
            ocupado: computed(() => {
              const estado = mensagens().at(-1)?.estado;
              return estado === 'aguardando' || estado === 'revelando';
            }),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(Chat);
    fixture.detectChanges();
  });

  const tela = () => fixture.nativeElement as HTMLElement;
  const textarea = () => tela().querySelector('textarea') as HTMLTextAreaElement;
  const botao = () => tela().querySelector('button[type="submit"]') as HTMLButtonElement;

  function digitar(texto: string) {
    textarea().value = texto;
    textarea().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function pressionarEnter(shiftKey = false) {
    const evento = new KeyboardEvent('keydown', { key: 'Enter', shiftKey, cancelable: true });
    textarea().dispatchEvent(evento);
    fixture.detectChanges();
    return evento;
  }

  function mostrar(...lista: Mensagem[]) {
    mensagens.set(lista);
    fixture.detectChanges();
  }

  it('mantém o wordmark e o disclaimer regulatório visíveis', () => {
    expect(tela().querySelector('header h1')?.textContent).toContain('AI RESEARCHER');
    expect(tela().querySelector('.disclaimer')?.textContent).toContain('informa, não recomenda');
  });

  it('começa sem mensagens, com a textarea rotulada', () => {
    expect(tela().querySelector('section[aria-label="Conversa"]')?.children.length).toBe(0);
    expect(tela().querySelector(`label[for="${textarea().id}"]`)?.textContent).toContain(
      'pergunta',
    );
  });

  describe('envio', () => {
    it('o botão fica desabilitado com o campo vazio ou só com espaços', () => {
      expect(botao().disabled).toBe(true);

      digitar('   ');
      expect(botao().disabled).toBe(true);

      digitar('Qual a receita?');
      expect(botao().disabled).toBe(false);
    });

    it('o botão fica desabilitado enquanto a última resposta não termina', () => {
      digitar('Próxima pergunta');

      mostrar(pergunta, resposta('', 'aguardando'));
      expect(botao().disabled).toBe(true);

      mostrar(pergunta, resposta('Receita ', 'revelando'));
      expect(botao().disabled).toBe(true);

      mostrar(pergunta, resposta('Receita de R$ 1.', 'concluida'));
      expect(botao().disabled).toBe(false);
    });

    it('o botão envia a pergunta e limpa o campo', () => {
      digitar('Qual a receita?');

      botao().click();
      fixture.detectChanges();

      expect(send).toHaveBeenCalledWith('Qual a receita?');
      expect(textarea().value).toBe('');
    });

    it('limpa o campo mesmo quando o texto é enviado antes de qualquer render', () => {
      textarea().value = 'Colado e enviado na hora';
      textarea().dispatchEvent(new Event('input'));

      pressionarEnter();

      expect(send).toHaveBeenCalledWith('Colado e enviado na hora');
      expect(textarea().value).toBe('');
    });

    it('Enter envia, sem inserir quebra de linha', () => {
      digitar('Qual a receita?');

      const evento = pressionarEnter();

      expect(send).toHaveBeenCalledWith('Qual a receita?');
      expect(evento.defaultPrevented).toBe(true);
    });

    it('Shift+Enter não envia: a quebra de linha acontece', () => {
      digitar('Primeira linha');

      const evento = pressionarEnter(true);

      expect(send).not.toHaveBeenCalled();
      expect(evento.defaultPrevented).toBe(false);
    });

    it('Enter não envia enquanto a resposta anterior não termina, e mantém o texto', () => {
      mostrar(pergunta, resposta('', 'aguardando'));
      digitar('Próxima');

      pressionarEnter();

      expect(send).not.toHaveBeenCalled();
      expect(textarea().value).toBe('Próxima');
    });
  });

  describe('mensagens', () => {
    it('mostra a pergunta do usuário em bolha própria', () => {
      mostrar(pergunta);

      expect(tela().querySelector('.message--user .bubble')?.textContent).toContain(
        'Qual a receita?',
      );
    });

    it('mostra o corpo da resposta sem o bloco de fontes, e as citações com link', () => {
      mostrar(
        pergunta,
        resposta(
          `Receita de R$ 4,9 bilhões.\n\nFontes:\n- KLBN · 1T26 (data-base 31/03/2026) (${ZIP})`,
          'concluida',
        ),
      );

      const bolha = tela().querySelector('.message--assistant .bubble');
      expect(bolha?.textContent).toContain('Receita de R$ 4,9 bilhões.');
      expect(bolha?.textContent).not.toContain('Fontes:');

      const link = tela().querySelector('a.citation') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe(ZIP);
      expect(link.textContent).toContain('data-base 31/03/2026');
      expect(link.textContent).toContain('Base local (CVM)');
    });

    it('não mostra a seção de citações quando a resposta não tem fontes', () => {
      mostrar(pergunta, resposta('Não encontrei.', 'concluida'));

      expect(tela().querySelector('.citations')).toBeNull();
    });

    it('mostra o cursor enquanto digita, e tira no fim', () => {
      mostrar(pergunta, resposta('Receita ', 'revelando'));
      expect(tela().querySelector('.cursor')).not.toBeNull();

      mostrar(pergunta, resposta('Receita de R$ 1.', 'concluida'));
      expect(tela().querySelector('.cursor')).toBeNull();
    });

    it('as citações só aparecem quando o texto termina de ser revelado', () => {
      const texto = `Corpo.\n\nFontes:\n- KLBN · 1T26 (data-base 31/03/2026) (${ZIP})`;

      mostrar(pergunta, resposta(texto, 'revelando'));
      expect(tela().querySelector('a.citation')).toBeNull();

      mostrar(pergunta, resposta(texto, 'concluida'));
      expect(tela().querySelector('a.citation')).not.toBeNull();
    });

    it('a mensagem de erro é anunciada como alerta', () => {
      mostrar(pergunta, resposta('Não foi possível responder agora.', 'erro'));

      expect(tela().querySelector('[role="alert"]')?.textContent).toContain(
        'Não foi possível responder agora.',
      );
    });
  });
});
