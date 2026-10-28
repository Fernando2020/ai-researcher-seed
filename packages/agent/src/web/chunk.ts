// Divide o texto em pedaços de tamanho fixo que se sobrepõem. A sobreposição evita que uma
// frase cortada na fronteira fique sem contexto nos dois chunks.
export function dividirEmChunks(texto: string, tamanho = 1000, sobreposicao = 100): string[] {
  if (sobreposicao >= tamanho) {
    throw new Error('A sobreposição precisa ser menor que o tamanho do chunk.');
  }

  const chunks: string[] = [];
  const passo = tamanho - sobreposicao;

  for (let inicio = 0; inicio < texto.length; inicio += passo) {
    chunks.push(texto.slice(inicio, inicio + tamanho));
    // O último chunk já chegou ao fim do texto — avançar de novo só repetiria a sobreposição.
    if (inicio + tamanho >= texto.length) break;
  }

  return chunks;
}
