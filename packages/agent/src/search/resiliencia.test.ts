import { describe, expect, it, vi } from 'vitest';

import { CircuitoAbertoError, comResiliencia } from './resiliencia.js';
import { SearchProviderError } from './search-provider.js';
import type { SearchResult } from './search-provider.js';

const RESULTADOS: SearchResult[] = [{ title: 't', snippet: 's', url: 'https://exemplo.com' }];
const FALHA = new SearchProviderError('Fake', 'HTTP 503');

// Provedor fake que segue um roteiro: 'ok' devolve resultados, 'falha' lança erro. Depois do
// fim do roteiro, repete o último passo.
function provedorRoteirizado(roteiro: ('ok' | 'falha')[]) {
  let chamada = 0;
  const search = vi.fn(() => {
    const passo = roteiro[Math.min(chamada++, roteiro.length - 1)];
    return passo === 'ok' ? Promise.resolve(RESULTADOS) : Promise.reject(FALHA);
  });
  return { search };
}

// Espera e relógio fakes: nenhum teste espera de verdade. `esperas` registra cada backoff
// pedido, e `relogio.ms` só anda quando o teste manda.
function montar(roteiro: ('ok' | 'falha')[]) {
  const provedor = provedorRoteirizado(roteiro);
  const esperas: number[] = [];
  const relogio = { ms: 0 };
  const resiliente = comResiliencia(provedor, {
    nome: 'Fake',
    tentativas: 3,
    backoffInicialMs: 500,
    limiteFalhas: 2,
    resfriamentoMs: 30_000,
    esperar: (ms) => {
      esperas.push(ms);
      return Promise.resolve();
    },
    agora: () => relogio.ms,
  });
  return { provedor, resiliente, esperas, relogio };
}

describe('comResiliencia — retry com backoff', () => {
  it('devolve na primeira tentativa, sem esperar', async () => {
    const { provedor, resiliente, esperas } = montar(['ok']);

    await expect(resiliente.search('q')).resolves.toEqual(RESULTADOS);
    expect(provedor.search).toHaveBeenCalledTimes(1);
    expect(esperas).toEqual([]);
  });

  it('tenta de novo com espera dobrando a cada tentativa', async () => {
    const { provedor, resiliente, esperas } = montar(['falha', 'falha', 'ok']);

    await expect(resiliente.search('q')).resolves.toEqual(RESULTADOS);
    expect(provedor.search).toHaveBeenCalledTimes(3);
    expect(esperas).toEqual([500, 1000]);
  });

  it('esgotadas as tentativas, lança o último erro do provedor', async () => {
    const { provedor, resiliente, esperas } = montar(['falha']);

    await expect(resiliente.search('q')).rejects.toBe(FALHA);
    expect(provedor.search).toHaveBeenCalledTimes(3);
    // Não espera depois da última tentativa: não haveria outra.
    expect(esperas).toEqual([500, 1000]);
  });
});

describe('comResiliencia — circuit breaker', () => {
  it('abre depois de limiteFalhas chamadas seguidas falharem, e falha na hora sem chamar o provedor', async () => {
    const { provedor, resiliente } = montar(['falha']);

    await expect(resiliente.search('q')).rejects.toBe(FALHA);
    await expect(resiliente.search('q')).rejects.toBe(FALHA);
    expect(provedor.search).toHaveBeenCalledTimes(6);

    await expect(resiliente.search('q')).rejects.toBeInstanceOf(CircuitoAbertoError);
    // Circuito aberto: nenhuma chamada nova ao provedor.
    expect(provedor.search).toHaveBeenCalledTimes(6);
  });

  it('o erro de circuito aberto também é um SearchProviderError', async () => {
    const { resiliente } = montar(['falha']);
    await resiliente.search('q').catch(() => undefined);
    await resiliente.search('q').catch(() => undefined);

    await expect(resiliente.search('q')).rejects.toBeInstanceOf(SearchProviderError);
  });

  it('continua aberto até o resfriamento terminar', async () => {
    const { provedor, resiliente, relogio } = montar(['falha']);
    await resiliente.search('q').catch(() => undefined);
    await resiliente.search('q').catch(() => undefined);

    relogio.ms = 29_999;
    await expect(resiliente.search('q')).rejects.toBeInstanceOf(CircuitoAbertoError);
    expect(provedor.search).toHaveBeenCalledTimes(6);
  });

  it('depois do resfriamento, deixa uma sondagem passar e fecha se ela der certo', async () => {
    const { provedor, resiliente, relogio } = montar([
      'falha',
      'falha',
      'falha',
      'falha',
      'falha',
      'falha',
      'ok',
    ]);
    await resiliente.search('q').catch(() => undefined);
    await resiliente.search('q').catch(() => undefined);

    relogio.ms = 30_000;
    await expect(resiliente.search('q')).resolves.toEqual(RESULTADOS);
    // Fechado de novo: a próxima chamada vai direto ao provedor.
    await expect(resiliente.search('q')).resolves.toEqual(RESULTADOS);
    expect(provedor.search).toHaveBeenCalledTimes(8);
  });

  it('se a sondagem falhar, reabre na hora por mais um resfriamento inteiro', async () => {
    const { provedor, resiliente, relogio } = montar(['falha']);
    await resiliente.search('q').catch(() => undefined);
    await resiliente.search('q').catch(() => undefined);

    relogio.ms = 30_000;
    await expect(resiliente.search('q')).rejects.toBe(FALHA);
    expect(provedor.search).toHaveBeenCalledTimes(9);

    relogio.ms = 59_999;
    await expect(resiliente.search('q')).rejects.toBeInstanceOf(CircuitoAbertoError);
    expect(provedor.search).toHaveBeenCalledTimes(9);
  });

  it('um sucesso no meio zera a contagem de falhas consecutivas', async () => {
    // Chamada 1 falha (3 tentativas), chamada 2 dá certo, chamada 3 falha (3 tentativas).
    const { resiliente } = montar(['falha', 'falha', 'falha', 'ok', 'falha']);
    await resiliente.search('q').catch(() => undefined);
    await resiliente.search('q');
    await resiliente.search('q').catch(() => undefined);

    // Só uma falha seguida desde o sucesso: abaixo do limite de 2, o circuito segue fechado.
    await expect(resiliente.search('q')).rejects.toBe(FALHA);
  });
});
