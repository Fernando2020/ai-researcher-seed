import { afterNextRender, Component, ElementRef, input, output, viewChild } from '@angular/core';
import type { Citation } from '../../state/citation';

@Component({
  selector: 'app-citation-panel',
  templateUrl: './citation-panel.html',
  styleUrl: './citation-panel.scss',
  host: {
    role: 'complementary',
    'aria-label': 'Detalhes da citação',
    '(keydown.escape)': 'fechar.emit()',
  },
})
export class CitationPanelComponent {
  readonly citacao = input.required<Citation>();
  readonly fechar = output<void>();

  private readonly botaoFechar = viewChild.required<ElementRef<HTMLButtonElement>>('botaoFechar');

  constructor() {
    // O foco entra no painel ao abrir: é o que faz o Esc funcionar logo depois do clique.
    afterNextRender(() => this.botaoFechar().nativeElement.focus());
  }
}
