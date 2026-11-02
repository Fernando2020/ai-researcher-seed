// Divide o texto em palavras, cada uma com o espaço ou a quebra de linha que vem depois dela:
// juntar os tokens de novo devolve o texto original, com os parágrafos intactos.
export function tokenize(texto: string): string[] {
  return texto.trim().match(/\S+\s*/g) ?? [];
}
