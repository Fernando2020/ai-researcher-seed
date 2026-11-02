import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import type { Citation } from '../../state/citation';
import { CitationPanelComponent } from './citation-panel';

const ZIP = 'https://dados.cvm.gov.br/itr_cia_aberta_2025.zip';

const DA_CVM: Citation = {
  label: 'VALE · 3T25 (data-base 30/09/2025)',
  url: ZIP,
  origin: 'Base local (CVM)',
  period: '3T25',
  baseDate: '30/09/2025',
};

const DA_WEB: Citation = {
  label: 'Vale explica queda',
  url: 'https://exemplo.com/vale',
  origin: 'exemplo.com',
  period: null,
  baseDate: null,
};

function montar(citacao: Citation): ComponentFixture<CitationPanelComponent> {
  const fixture = TestBed.createComponent(CitationPanelComponent);
  fixture.componentRef.setInput('citacao', citacao);
  fixture.detectChanges();
  return fixture;
}

const tela = (fixture: ComponentFixture<CitationPanelComponent>) =>
  fixture.nativeElement as HTMLElement;

describe('CitationPanelComponent', () => {
  it('mostra data-base, origem e o link para o documento original', () => {
    const elemento = tela(montar(DA_CVM));

    expect(elemento.textContent).toContain('30/09/2025');
    expect(elemento.textContent).toContain('Base local (CVM)');
    expect(elemento.querySelector('a.link')?.getAttribute('href')).toBe(ZIP);
  });

  it('o link abre em outra aba, sem dar acesso a esta', () => {
    const link = tela(montar(DA_CVM)).querySelector('a.link');

    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('explica quando a fonte da web não tem data-base', () => {
    const elemento = tela(montar(DA_WEB));

    expect(elemento.textContent).toContain('Não se aplica');
    expect(elemento.textContent).toContain('exemplo.com');
  });

  it('avisa que quer fechar ao clicar no botão', () => {
    const fixture = montar(DA_CVM);
    const fechou = vi.fn();
    fixture.componentInstance.fechar.subscribe(fechou);

    tela(fixture).querySelector<HTMLButtonElement>('button.close')?.click();

    expect(fechou).toHaveBeenCalled();
  });

  it('avisa que quer fechar ao pressionar Esc', () => {
    const fixture = montar(DA_CVM);
    const fechou = vi.fn();
    fixture.componentInstance.fechar.subscribe(fechou);

    tela(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(fechou).toHaveBeenCalled();
  });
});
