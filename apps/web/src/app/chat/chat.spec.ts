import { TestBed } from '@angular/core/testing';
import { Chat } from './chat';

describe('Chat', () => {
  function renderizar(): HTMLElement {
    const fixture = TestBed.createComponent(Chat);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('mostra o wordmark no header', () => {
    expect(renderizar().querySelector('header h1')?.textContent).toContain('AI RESEARCHER');
  });

  it('mantém o disclaimer regulatório visível no layout', () => {
    expect(renderizar().querySelector('.disclaimer')?.textContent).toContain(
      'informa, não recomenda',
    );
  });

  it('começa com a área de mensagens vazia', () => {
    const mensagens = renderizar().querySelector('section[aria-label="Conversa"]');

    expect(mensagens).not.toBeNull();
    expect(mensagens?.children.length).toBe(0);
  });

  it('tem um input com label e o botão Enviar', () => {
    const tela = renderizar();
    const input = tela.querySelector('input');

    expect(tela.querySelector(`label[for="${input?.id}"]`)?.textContent).toContain('pergunta');
    expect(tela.querySelector('button[type="submit"]')?.textContent).toContain('Enviar');
  });
});
