const TIMEOUT_MS = 10_000;

// Fetch nativo do Node, com timeout: uma página lenta não pode segurar o grafo inteiro.
// Status de erro (404, 500...) também vira exceção — quem chama decide se ignora.
export async function buscarHtml(url: string): Promise<string> {
  const resposta = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!resposta.ok) {
    throw new Error(`Falha ao buscar ${url}: HTTP ${resposta.status}`);
  }
  return resposta.text();
}
