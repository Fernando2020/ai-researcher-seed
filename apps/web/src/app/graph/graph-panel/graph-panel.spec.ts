import { signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GraphStore } from '../../state/graph-store';
import type { EtapaDoGrafo, NoDoGrafo } from '../../state/graph-store';
import { formatDuration } from './format-duration';
import { GraphPanelComponent } from './graph-panel';

function concluida(no: NoDoGrafo, duracaoMs: number): EtapaDoGrafo {
  return { no, estado: 'concluida', inicioMs: 0, duracaoMs };
}

function emExecucao(no: NoDoGrafo): EtapaDoGrafo {
  return { no, estado: 'em-execucao', inicioMs: 0, duracaoMs: null };
}

describe('formatDuration', () => {
  it('usa milissegundos abaixo de um segundo', () => {
    expect(formatDuration(850)).toBe('850 ms');
  });

  it('usa segundos com uma casa decimal e vírgula a partir de um segundo', () => {
    expect(formatDuration(1000)).toBe('1,0 s');
    expect(formatDuration(12345)).toBe('12,3 s');
  });
});

describe('GraphPanelComponent', () => {
  const etapas = signal<EtapaDoGrafo[]>([]);
  let fixture: ComponentFixture<GraphPanelComponent>;

  beforeEach(() => {
    etapas.set([]);
    TestBed.configureTestingModule({
      providers: [{ provide: GraphStore, useValue: { etapas } }],
    });
    fixture = TestBed.createComponent(GraphPanelComponent);
    fixture.detectChanges();
  });

  const tela = () => fixture.nativeElement as HTMLElement;
  const passos = () => [...tela().querySelectorAll<HTMLElement>('.step')];

  function mostrar(...lista: EtapaDoGrafo[]) {
    etapas.set(lista);
    fixture.detectChanges();
  }

  it('antes da primeira pergunta, explica que as etapas vão aparecer', () => {
    expect(passos()).toHaveLength(0);
    expect(tela().querySelector('.empty')?.textContent).toContain('enviar uma pergunta');
  });

  it('etapa em execução tem spinner e status, sem duração', () => {
    mostrar(emExecucao('retrieve'));

    expect(passos()[0].querySelector('.spinner')).not.toBeNull();
    expect(passos()[0].textContent).toContain('Em execução');
    expect(passos()[0].querySelector('.duration')).toBeNull();
  });

  it('etapa concluída tem check, descrição e duração formatada, sem spinner', () => {
    mostrar(concluida('retrieve', 1234));

    const passo = passos()[0];
    expect(passo.querySelector('.spinner')).toBeNull();
    expect(passo.querySelector('.check')).not.toBeNull();
    expect(passo.textContent).toContain('Retrieve');
    expect(passo.textContent).toContain('Busca os trechos');
    expect(passo.textContent).toContain('Concluído');
    expect(passo.querySelector('.duration')?.textContent).toContain('1,2 s');
  });

  it('etapa interrompida para o spinner e diz isso em texto', () => {
    mostrar({ no: 'grade', estado: 'interrompida', inicioMs: 0, duracaoMs: 300 });

    expect(passos()[0].querySelector('.spinner')).toBeNull();
    expect(passos()[0].textContent).toContain('Interrompido');
  });

  it('o webSearch aparece com o rótulo Search', () => {
    mostrar(emExecucao('webSearch'));

    expect(passos()[0].textContent).toContain('Search');
  });

  it('não mostra o banner enquanto não houver webSearch', () => {
    mostrar(concluida('retrieve', 100), emExecucao('grade'));

    expect(tela().querySelector('[role="status"]')).toBeNull();
  });

  it('mostra o banner de contexto insuficiente assim que o webSearch entra', () => {
    mostrar(concluida('retrieve', 100), concluida('grade', 100), emExecucao('webSearch'));

    expect(tela().querySelector('[role="status"]')?.textContent).toContain(
      'contexto local não foi suficiente',
    );
  });

  it('não esconde o loop: a segunda passada aparece como etapa própria, e se explica', () => {
    mostrar(
      concluida('retrieve', 100),
      concluida('grade', 100),
      concluida('webSearch', 100),
      emExecucao('retrieve'),
    );

    expect(passos()).toHaveLength(4);
    expect(passos()[0].textContent).not.toContain('Segunda passada');
    expect(passos()[3].textContent).toContain('Segunda passada');
  });
});
