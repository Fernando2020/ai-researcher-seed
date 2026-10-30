import { SearchProviderError } from './search-provider.js';

export const TIMEOUT_BUSCA_MS = 10_000;

// fetch com prazo: sem o signal, uma API que aceita a conexão e nunca responde deixa a busca
// — e o grafo, e a requisição do usuário — esperando pra sempre. Timeout e falha de rede viram
// SearchProviderError, o mesmo erro de uma resposta HTTP de erro.
export async function fetchComTimeout(
  provider: string,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (erro) {
    const detalhe =
      erro instanceof Error && erro.name === 'TimeoutError'
        ? `sem resposta em ${timeoutMs} ms`
        : `falha de rede (${erro instanceof Error ? erro.message : String(erro)})`;
    throw new SearchProviderError(provider, detalhe);
  }
}
