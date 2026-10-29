import type { RetrievedDoc } from '../db/retrieve-similar.js';

// Cada documento é rotulado pela origem: o LLM precisa saber o que é indicador da CVM e o que
// é trecho de página da web. O mesmo rótulo é o que o answer usa pra citar a fonte no texto.
export function formatarDocumento(doc: RetrievedDoc): string {
  if (doc.origem === 'cvm') {
    return `- [CVM ${doc.ticker} ${doc.period}] ${doc.paragraph}`;
  }
  return `- [WEB "${doc.title}" ${doc.sourceUrl}] ${doc.content}`;
}

export function formatarContexto(documents: RetrievedDoc[]): string {
  return documents.map(formatarDocumento).join('\n') || '(nenhum documento encontrado)';
}
