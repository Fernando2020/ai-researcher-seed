const ENTIDADES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

// Extração simples, por expressão regular: tira o que não é conteúdo (script, style, comentários),
// remove as tags e normaliza os espaços. Não tenta achar o "artigo principal" da página —
// menu e rodapé entram junto, e o embedding de cada chunk decide o que é relevante.
export function extrairTexto(html: string): string {
  return (
    html
      // Blocos cujo conteúdo não é texto legível.
      .replace(/<(script|style|noscript|svg|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      // Qualquer outra tag vira espaço, pra não colar palavras de elementos vizinhos.
      .replace(/<[^>]+>/g, ' ')
      .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entidade) => ENTIDADES[entidade] ?? entidade)
      .replace(/&#(\d+);/g, (_, codigo: string) => String.fromCharCode(Number(codigo)))
      .replace(/\s+/g, ' ')
      .trim()
  );
}
