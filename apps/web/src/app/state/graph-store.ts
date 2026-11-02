import { Injectable, signal } from '@angular/core';
import type { GraphEvent } from '../api/chat.service';

// Espelho de MAX_ITERATIONS em packages/agent/src/graph.ts. A constante é copiada, não importada:
// @hero/agent carrega LangGraph, Vertex AI e Postgres, que não pertencem ao bundle do navegador.
// Se o limite mudar no grafo, precisa mudar aqui também.
export const MAX_ITERATIONS = 2;

export type NoDoGrafo = GraphEvent['type'];

export interface EtapaDoGrafo {
  no: NoDoGrafo;
  estado: 'em-execucao' | 'concluida';
}

// A API só avisa quando um nó termina. Esta função prevê qual nó começou depois dele, para a tela
// mostrar a etapa em execução. Devolve null depois do answer, o último nó do grafo.
function preverProximoNo(evento: GraphEvent): NoDoGrafo | null {
  switch (evento.type) {
    case 'retrieve':
      return 'grade';
    case 'webSearch':
      return 'retrieve';
    case 'grade':
      return evento.sufficient || evento.iterations >= MAX_ITERATIONS ? 'answer' : 'webSearch';
    case 'answer':
      return null;
  }
}

@Injectable({ providedIn: 'root' })
export class GraphStore {
  // Lista só cresce: quando o grafo volta ao retrieve, entra uma etapa nova, e o loop aparece.
  private readonly _etapas = signal<EtapaDoGrafo[]>([]);
  readonly etapas = this._etapas.asReadonly();

  // Uma pergunta nova recomeça a lista: o grafo sempre começa pelo retrieve.
  iniciar(): void {
    this._etapas.set([{ no: 'retrieve', estado: 'em-execucao' }]);
  }

  aplicar(evento: GraphEvent): void {
    const proximo = preverProximoNo(evento);
    this._etapas.update((etapas) => {
      const concluidas = etapas.map((etapa, indice) =>
        indice === etapas.length - 1 ? { ...etapa, estado: 'concluida' as const } : etapa,
      );
      return proximo ? [...concluidas, { no: proximo, estado: 'em-execucao' }] : concluidas;
    });
  }
}
