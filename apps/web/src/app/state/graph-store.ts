import { Injectable, signal } from '@angular/core';
import type { GraphEvent } from '../api/chat.service';

// Espelho de MAX_ITERATIONS em packages/agent/src/graph.ts. A constante é copiada, não importada:
// @hero/agent carrega LangGraph, Vertex AI e Postgres, que não pertencem ao bundle do navegador.
// Se o limite mudar no grafo, precisa mudar aqui também.
export const MAX_ITERATIONS = 2;

export type NoDoGrafo = GraphEvent['type'];

export interface EtapaDoGrafo {
  no: NoDoGrafo;
  estado: 'em-execucao' | 'concluida' | 'interrompida';
  inicioMs: number;
  // Preenchida quando a etapa termina. Medida aqui no navegador: inclui o tempo de rede.
  duracaoMs: number | null;
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

function novaEtapa(no: NoDoGrafo, agora: number): EtapaDoGrafo {
  return { no, estado: 'em-execucao', inicioMs: agora, duracaoMs: null };
}

@Injectable({ providedIn: 'root' })
export class GraphStore {
  // Lista só cresce: quando o grafo volta ao retrieve, entra uma etapa nova, e o loop aparece.
  private readonly _etapas = signal<EtapaDoGrafo[]>([]);
  readonly etapas = this._etapas.asReadonly();

  // Uma pergunta nova recomeça a lista: o grafo sempre começa pelo retrieve.
  iniciar(): void {
    this._etapas.set([novaEtapa('retrieve', Date.now())]);
  }

  aplicar(evento: GraphEvent): void {
    const agora = Date.now();
    const proximo = preverProximoNo(evento);
    this._etapas.update((etapas) => {
      const atualizadas = this.encerrarUltima(etapas, 'concluida', agora);
      return proximo ? [...atualizadas, novaEtapa(proximo, agora)] : atualizadas;
    });
  }

  // A chamada falhou: nenhum evento novo vai chegar, e o spinner não pode girar para sempre.
  interromper(): void {
    this._etapas.update((etapas) => this.encerrarUltima(etapas, 'interrompida', Date.now()));
  }

  private encerrarUltima(
    etapas: EtapaDoGrafo[],
    estado: 'concluida' | 'interrompida',
    agora: number,
  ): EtapaDoGrafo[] {
    return etapas.map((etapa, indice) =>
      indice === etapas.length - 1 && etapa.estado === 'em-execucao'
        ? { ...etapa, estado, duracaoMs: agora - etapa.inicioMs }
        : etapa,
    );
  }
}
