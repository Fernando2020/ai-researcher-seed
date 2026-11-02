import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GraphEvent } from '../api/chat.service';
import { GraphStore, MAX_ITERATIONS } from './graph-store';

const RETRIEVE: GraphEvent = { type: 'retrieve', documents: [] };
const WEB_SEARCH: GraphEvent = { type: 'webSearch' };
const ANSWER: GraphEvent = { type: 'answer', response: 'Resposta.' };

function grade(sufficient: boolean, iterations: number): GraphEvent {
  return { type: 'grade', sufficient, missingAspects: [], iterations };
}

describe('GraphStore', () => {
  let store: GraphStore;

  beforeEach(() => {
    store = TestBed.inject(GraphStore);
    store.iniciar();
  });

  const caminho = () => store.etapas().map((etapa) => `${etapa.no}:${etapa.estado}`);
  const proximoNo = () => store.etapas().at(-1)?.no;

  it('começa vazio, antes de qualquer pergunta', () => {
    TestBed.resetTestingModule();

    expect(TestBed.inject(GraphStore).etapas()).toEqual([]);
  });

  it('ao iniciar, o retrieve já está em execução', () => {
    expect(caminho()).toEqual(['retrieve:em-execucao']);
  });

  it('depois de retrieve, conclui a etapa e prevê o grade', () => {
    store.aplicar(RETRIEVE);

    expect(caminho()).toEqual(['retrieve:concluida', 'grade:em-execucao']);
  });

  it('depois de webSearch, prevê o retrieve', () => {
    store.aplicar(WEB_SEARCH);

    expect(proximoNo()).toBe('retrieve');
  });

  it('depois de grade suficiente, prevê o answer', () => {
    store.aplicar(grade(true, 1));

    expect(proximoNo()).toBe('answer');
  });

  it('depois de grade insuficiente com iterações sobrando, prevê o webSearch', () => {
    store.aplicar(grade(false, MAX_ITERATIONS - 1));

    expect(proximoNo()).toBe('webSearch');
  });

  it('depois de grade insuficiente no limite de iterações, vai direto pro answer', () => {
    store.aplicar(grade(false, MAX_ITERATIONS));

    expect(proximoNo()).toBe('answer');
  });

  it('o answer conclui a última etapa e não prevê mais nada', () => {
    store.aplicar(RETRIEVE);
    store.aplicar(grade(true, 1));
    store.aplicar(ANSWER);

    expect(caminho()).toEqual(['retrieve:concluida', 'grade:concluida', 'answer:concluida']);
  });

  it('mostra o loop completo, com o retrieve e o grade repetidos', () => {
    store.aplicar(RETRIEVE);
    store.aplicar(grade(false, 1));
    store.aplicar(WEB_SEARCH);
    store.aplicar(RETRIEVE);
    store.aplicar(grade(false, 2));
    store.aplicar(ANSWER);

    expect(store.etapas().map((etapa) => etapa.no)).toEqual([
      'retrieve',
      'grade',
      'webSearch',
      'retrieve',
      'grade',
      'answer',
    ]);
    expect(store.etapas().every((etapa) => etapa.estado === 'concluida')).toBe(true);
  });

  it('uma nova pergunta recomeça a lista', () => {
    store.aplicar(RETRIEVE);

    store.iniciar();

    expect(caminho()).toEqual(['retrieve:em-execucao']);
  });
});
