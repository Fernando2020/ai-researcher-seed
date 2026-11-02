// Orçamento diário de tokens, em memória: cada instância conta o seu, e reiniciar o processo zera a
// conta. Quem soma aqui é o callback de métricas, com o mesmo usage_metadata dos contadores: não
// existe uma segunda contagem.
const LIMITE_PADRAO = 1_000_000;

let diaAtual = '';
let tokensConsumidos = 0;

// Compara a data UTC a cada leitura: não há timer, então a virada do dia não depende de CPU ativa.
function zerarSeODiaVirou(): void {
  const hoje = new Date().toISOString().slice(0, 10);
  if (hoje !== diaAtual) {
    diaAtual = hoje;
    tokensConsumidos = 0;
  }
}

function lerLimite(): number {
  const limite = Number(process.env.DAILY_TOKEN_BUDGET || LIMITE_PADRAO);
  if (Number.isFinite(limite) && limite >= 0) return limite;

  console.warn(`[orcamento] DAILY_TOKEN_BUDGET inválido, usando ${LIMITE_PADRAO}`);
  return LIMITE_PADRAO;
}

export function consumirOrcamento(tokens: number): void {
  zerarSeODiaVirou();
  tokensConsumidos += tokens;
}

export function orcamentoEsgotado(): boolean {
  zerarSeODiaVirou();
  return tokensConsumidos >= lerLimite();
}
