---
name: frontend-design
description: Use ao criar ou estilizar qualquer tela ou componente visual em apps/web. Traduz o design do chat consultor de investimentos em regras para o Angular — tokens de cor, tipografia e forma, e os padrões de bolha de mensagem, citação, painel do pipeline, banner de fallback, disclaimer e botão de envio.
---

# Design do AI Researcher no Angular

Esta skill diz **como a interface se parece**. Estrutura de componentes, stores e SSE estão na skill `angular-component`; idioma do framework, na skill oficial `angular-developer`, que vence em caso de conflito sobre o framework.

## Tokens

Declarados uma única vez, como custom properties em `apps/web/src/styles.scss`. Componente usa `var(--...)`. **Hex, família de fonte ou raio escritos em SCSS de componente são erro.**

### Cor

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#080808` | Fundo da página |
| `--color-surface-sunken` | `#101010` | Painel do pipeline, faixa do disclaimer |
| `--color-surface` | `#151515` | Bolha do assistente, composer, painel de citação |
| `--color-line` | `#2a2a2a` | Bordas neutras |
| `--color-text` | `#ffffff` | Texto principal |
| `--color-text-muted` | `#acacac` | Texto secundário |
| `--color-pending` | `#6f6f6f` | Só o ícone de etapa pendente; nunca texto |
| `--color-accent` | `#00f5ff` | **A cor de estado**: etapa ativa, citação, banner, foco, links |
| `--color-accent-tint` | `#0a2f31` | Fundo da bolha do usuário e do banner de fallback |
| `--color-on-accent` | `#080808` | Texto e ícone sobre ciano |
| `--color-send` | `#98e700` | **Só** o botão de envio |
| `--color-on-send` | `#000000` | Texto do botão de envio |

### Tipografia

| Token | Valor | Uso |
|---|---|---|
| `--font-display` | `Anton, 'Space Grotesk', sans-serif` | **Só** o wordmark |
| `--font-body` | `'Space Grotesk', system-ui, sans-serif` | Todo o resto |

Corpo em 16px com altura de linha 1.55; secundário em 14px; mínimo de 13px.

### Forma

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | `8px` | Botões, pílulas, banner |
| `--radius-md` | `12px` | Composer |
| `--radius-lg` | `16px` | Bolhas |
| `--radius-tail` | `4px` | O canto da bolha que aponta para quem fala |

## Regras de cor

1. **Ciano é a única cor de estado.** Nunca use verde ou vermelho em dado financeiro nem em estado do pipeline. Lucro e prejuízo, alta e queda aparecem como texto branco: cor sugeriria uma avaliação, e o sistema informa, não recomenda.
2. **Nem amarelo nem vermelho de alerta.** Fallback para a web é um caminho normal do sistema, não um erro. Até uma falha se comunica por ícone e texto, sem cor nova.
3. **Verde-limão só no botão de envio**, e só um por tela. Nenhum outro elemento usa `--color-send`.
4. **Estado nunca depende só da cor.** Toda diferença também aparece no ícone ou no texto.
5. Sem gradiente e sem card com borda só à esquerda.

## Componentes

### Bolha de mensagem

- **Usuário:** à direita, largura máxima de 75%, fundo `--color-accent-tint`, borda `--color-accent`, canto `--radius-tail` embaixo à direita.
- **Assistente:** à esquerda, com avatar circular de 40px em ciano; fundo `--color-surface`, borda `--color-line`, canto `--radius-tail` em cima à esquerda.
- **Digitando:** cursor retangular em ciano piscando no fim do texto; some quando o texto termina. Sem animação com `prefers-reduced-motion`.

### Citação

Fica abaixo da bolha, como `<button>` real, com pelo menos 44px de altura.

- **Fechada:** fundo transparente, borda e texto em `--color-accent`, sem animação.
- **Aberta:** fundo `--color-accent`, texto `--color-on-accent`, `aria-pressed="true"`.

Abre um painel com data-base, origem e link para o documento original. O painel fecha com botão e com Esc. Sem período, o número perde sentido: a data-base nunca fica de fora.

### Painel do pipeline

Etapas em ordem: Retrieve, Grade, Search, Answer. Fundo `--color-surface-sunken`.

| Estado | Ícone | Texto |
|---|---|---|
| Pendente | Círculo tracejado em `--color-pending` | `Pendente`, em `--color-text-muted` |
| Em execução | Arco girando em `--color-accent` | `Em execução`, em `--color-accent` |
| Concluído | Círculo cheio em `--color-accent`, com check em `--color-on-accent` | `Concluído`, em `--color-text` |

Timeline vertical: cada etapa mostra rótulo, descrição, status e, ao terminar, a duração. Quando o grafo volta ao Retrieve, entra uma etapa nova na lista, e a descrição diz que é a segunda passada. O loop não se esconde.

Etapa interrompida por falha: círculo vazado com X em `--color-accent` e o texto `Interrompido`, sem cor nova.

### Banner de fallback

Aparece no painel do pipeline, acima da timeline, quando o grafo entra em Search. Fundo `--color-accent-tint`, borda `--color-accent`, raio `--radius-sm`, ícone de busca em ciano, `role="status"`. O texto explica que o contexto local foi insuficiente e que o sistema complementa com a web.

### Disclaimer

Faixa fixa no layout, abaixo do header, fundo `--color-surface-sunken`, texto `--color-text-muted`. Não é modal, não tem botão de fechar e não some durante o streaming.

### Botão de envio

`<button>` real, altura mínima de 44px, fundo `--color-send`, texto `--color-on-send` em peso 700, raio `--radius-sm`, com rótulo escrito "Enviar". Durante o processamento, fica desabilitado e com opacidade 0.5.

## Acessibilidade

- Área de toque de pelo menos 44px; contraste de texto de pelo menos 4.5:1.
- Foco visível com `outline: 2px solid var(--color-accent)`, já global em `styles.scss`.
- Input com `<label>`, mesmo que visualmente oculto; botão só de ícone com `aria-label`.
- A tela funciona em largura de celular, sem rolagem horizontal.
