import type { RetrievedDoc } from '../db/retrieve-similar.js';

export const AVISO_GUARDRAIL =
  'Não posso fazer recomendações de investimento: este assistente informa, não recomenda. ' +
  'Consultoria de valores mobiliários é atividade regulada pela CVM. As fontes abaixo trazem os ' +
  'dados disponíveis para a sua própria análise — para uma recomendação, procure um profissional ' +
  'certificado.';

// Segunda camada do guardrail: não depende do LLM obedecer ao prompt. Os padrões são
// conservadores de propósito — um falso positivo custa uma resposta genérica, um falso
// negativo é recomendação de investimento sem autorização da CVM.
const PADROES_RECOMENDATORIOS: RegExp[] = [
  // Verbo de recomendação em primeira pessoa.
  /\b(recomendo|sugiro|aconselho|indico)\b/,
  /\bminha (recomendacao|sugestao)\b/,
  // Construções que avaliam a decisão de investir.
  /\bvale a pena (comprar|vender|investir|manter|aplicar)\b/,
  /\b(voce )?(deve|deveria) (comprar|vender|investir|manter|aplicar)\b/,
  /\b(e|seria) (um )?(bom|otimo|mau) (momento|negocio) (para|pra) (comprar|vender|investir)\b/,
];

// Minúsculas e sem acento: "Recomendação" e "recomendacao" caem no mesmo padrão. O NFD separa
// a letra do acento ("ç" vira "c" + cedilha), e \p{M} remove as marcas que sobraram.
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function contemRecomendacao(texto: string): boolean {
  const normalizado = normalizar(texto);
  return PADROES_RECOMENDATORIOS.some((padrao) => padrao.test(normalizado));
}

// '2025-09-30' → '30/09/2025'. Por string, sem Date: evita o deslocamento de fuso horário.
function formatarDataBase(periodEnd: string): string {
  const [ano, mes, dia] = periodEnd.split('-');
  return `${dia}/${mes}/${ano}`;
}

// A chave de deduplicação muda por origem. Na web, vários chunks da mesma página têm a mesma
// sourceUrl — uma fonte só. No corpus, a sourceUrl é o ZIP anual da CVM, compartilhado por
// dezenas de empresas; deduplicar por ela apagaria fontes distintas, então a chave é a
// natural do corpus: ticker + período.
function chaveDaFonte(doc: RetrievedDoc): string {
  return doc.origem === 'cvm' ? `cvm:${doc.ticker}:${doc.period}` : `web:${doc.sourceUrl}`;
}

function formatarFonte(doc: RetrievedDoc): string {
  if (doc.origem === 'cvm') {
    return `- ${doc.ticker} ${doc.period}, data-base ${formatarDataBase(doc.periodEnd)} (CVM Dados Abertos)`;
  }
  return `- ${doc.title} (${doc.sourceUrl})`;
}

export function formatarFontes(documents: RetrievedDoc[]): string {
  const vistas = new Set<string>();
  const itens: string[] = [];

  for (const doc of documents) {
    const chave = chaveDaFonte(doc);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    itens.push(formatarFonte(doc));
  }

  if (itens.length === 0) return 'Fontes: nenhum documento recuperado.';
  return `Fontes:\n${itens.join('\n')}`;
}

// Resposta final: o texto do LLM (ou o aviso fixo, se ele tentou recomendar) mais o bloco de
// fontes — que entra sempre, inclusive quando a resposta foi substituída.
export function formatarResposta(textoDoLlm: string, documents: RetrievedDoc[]): string {
  const corpo = contemRecomendacao(textoDoLlm) ? AVISO_GUARDRAIL : textoDoLlm.trim();
  return `${corpo}\n\n${formatarFontes(documents)}`;
}
