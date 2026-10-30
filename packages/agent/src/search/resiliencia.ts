import { SearchProviderError } from './search-provider.js';
import type { SearchProvider, SearchResult } from './search-provider.js';

// Circuito aberto: a chamada falha na hora, sem tocar no provedor. Herda de SearchProviderError
// pra quem já trata falha de busca tratar esta também, sem conhecer o circuit breaker.
export class CircuitoAbertoError extends SearchProviderError {
  constructor(provider: string, liberaEmMs: number) {
    super(
      provider,
      `circuito aberto após falhas consecutivas — nova tentativa em ${liberaEmMs} ms`,
    );
    this.name = 'CircuitoAbertoError';
  }
}

export interface OpcoesResiliencia {
  // Nome do provedor nas mensagens de erro.
  nome: string;
  // Total de tentativas por chamada, contando a primeira.
  tentativas?: number;
  // Espera antes da 2ª tentativa; dobra a cada nova tentativa (500, 1000, 2000...).
  backoffInicialMs?: number;
  // Quantas chamadas seguidas precisam falhar (já depois dos retries) pra abrir o circuito.
  limiteFalhas?: number;
  // Quanto tempo o circuito fica aberto antes de deixar uma chamada passar de novo.
  resfriamentoMs?: number;
  // Injetáveis pra teste: o padrão espera de verdade e lê o relógio do sistema; o teste troca
  // por versões que não esperam e por um relógio que ele mesmo avança.
  esperar?: (ms: number) => Promise<void>;
  agora?: () => number;
}

const esperarDeVerdade = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Decorador: recebe um SearchProvider e devolve outro, com a mesma interface — o nó webSearch
// não sabe que existe retry nem circuito. Funciona com qualquer provedor (Serper, Google).
export function comResiliencia(
  provider: SearchProvider,
  {
    nome,
    tentativas = 3,
    backoffInicialMs = 500,
    limiteFalhas = 3,
    resfriamentoMs = 30_000,
    esperar = esperarDeVerdade,
    agora = Date.now,
  }: OpcoesResiliencia,
): SearchProvider {
  // Estado do circuito, compartilhado por todas as chamadas deste provedor.
  let falhasConsecutivas = 0;
  let abertoAte: number | null = null;

  async function tentarComRetry(query: string): Promise<SearchResult[]> {
    let ultimoErro: unknown;
    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
      try {
        return await provider.search(query);
      } catch (erro) {
        ultimoErro = erro;
        if (tentativa < tentativas) {
          await esperar(backoffInicialMs * 2 ** (tentativa - 1));
        }
      }
    }
    throw ultimoErro;
  }

  return {
    async search(query: string): Promise<SearchResult[]> {
      if (abertoAte !== null && agora() < abertoAte) {
        throw new CircuitoAbertoError(nome, abertoAte - agora());
      }

      try {
        const resultados = await tentarComRetry(query);
        // Um sucesso fecha o circuito e zera a contagem.
        falhasConsecutivas = 0;
        abertoAte = null;
        return resultados;
      } catch (erro) {
        falhasConsecutivas++;
        // Depois do resfriamento, a contagem continua acima do limite: a primeira chamada que
        // passa é uma sondagem. Se ela falhar, o circuito reabre na hora; se der certo, fecha.
        if (falhasConsecutivas >= limiteFalhas) {
          abertoAte = agora() + resfriamentoMs;
        }
        throw erro;
      }
    },
  };
}
