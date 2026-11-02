// Abaixo de um segundo, em milissegundos: "850 ms". Acima, em segundos com uma casa: "1,2 s".
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}
