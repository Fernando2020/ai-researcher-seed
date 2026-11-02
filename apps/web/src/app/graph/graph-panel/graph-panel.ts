import { Component, computed, inject } from '@angular/core';
import { GraphStore } from '../../state/graph-store';
import type { EtapaDoGrafo, NoDoGrafo } from '../../state/graph-store';
import { formatDuration } from './format-duration';

const ROTULOS: Record<NoDoGrafo, string> = {
  retrieve: 'Retrieve',
  grade: 'Grade',
  webSearch: 'Search',
  answer: 'Answer',
};

const DESCRICOES: Record<NoDoGrafo, string> = {
  retrieve: 'Busca os trechos mais próximos da pergunta.',
  grade: 'Avalia se o contexto é suficiente.',
  webSearch: 'Busca na web o que faltou.',
  answer: 'Escreve a resposta com as citações.',
};

// A segunda passada existe: o loop é parte do que o painel ensina, então ele se explica.
const DESCRICOES_DA_SEGUNDA_PASSADA: Partial<Record<NoDoGrafo, string>> = {
  retrieve: 'Segunda passada, agora com o que veio da web.',
  grade: 'Reavalia o contexto com os trechos novos.',
};

const STATUS: Record<EtapaDoGrafo['estado'], string> = {
  'em-execucao': 'Em execução',
  concluida: 'Concluído',
  interrompida: 'Interrompido',
};

@Component({
  selector: 'app-graph-panel',
  templateUrl: './graph-panel.html',
  styleUrl: './graph-panel.scss',
})
export class GraphPanelComponent {
  private readonly graphStore = inject(GraphStore);

  protected readonly etapas = computed(() => {
    const etapas = this.graphStore.etapas();
    return etapas.map((etapa, indice) => {
      const repetida = etapas.slice(0, indice).some((anterior) => anterior.no === etapa.no);
      return {
        estado: etapa.estado,
        rotulo: ROTULOS[etapa.no],
        descricao: (repetida && DESCRICOES_DA_SEGUNDA_PASSADA[etapa.no]) || DESCRICOES[etapa.no],
        status: STATUS[etapa.estado],
        duracao: etapa.duracaoMs === null ? null : formatDuration(etapa.duracaoMs),
      };
    });
  });

  protected readonly caiuNoFallback = computed(() =>
    this.graphStore.etapas().some((etapa) => etapa.no === 'webSearch'),
  );
}
