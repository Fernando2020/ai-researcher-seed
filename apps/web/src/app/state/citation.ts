export const ORIGEM_BASE_LOCAL = 'Base local (CVM)';

export interface Citation {
  label: string;
  url: string;
  origin: string;
  // Só nas citações da CVM: "1T26" e "31/03/2026". Página da web não tem período contábil.
  period: string | null;
  baseDate: string | null;
}

export interface ParsedAnswer {
  body: string;
  citations: Citation[];
}

// O agent sempre anexa o bloco de fontes no fim da resposta (formatarFontes em packages/agent).
const MARCADOR_DE_FONTES = '\n\nFontes:';

// "- rótulo (https://url)": a URL é o último parêntese da linha, pois o rótulo pode ter outros.
const LINHA_DE_FONTE = /^- (.+) \((https?:\/\/\S+)\)$/;

// "KLBN · 1T26 (data-base 31/03/2026)"
const ROTULO_DA_CVM = /^\S+ · (\S+) \(data-base ([^)]+)\)$/;

export function parseAnswer(answerText: string): ParsedAnswer {
  const inicioDasFontes = answerText.lastIndexOf(MARCADOR_DE_FONTES);
  if (inicioDasFontes === -1) return { body: answerText.trim(), citations: [] };

  const fontes = answerText.slice(inicioDasFontes + MARCADOR_DE_FONTES.length);
  return {
    body: answerText.slice(0, inicioDasFontes).trim(),
    citations: fontes.split('\n').flatMap(paraCitation),
  };
}

// flatMap: uma linha que não é fonte (ou "Fontes: nenhum documento recuperado.") vira lista vazia.
function paraCitation(linha: string): Citation[] {
  const fonte = LINHA_DE_FONTE.exec(linha.trim());
  if (!fonte) return [];

  const [, label, url] = fonte;
  const cvm = ROTULO_DA_CVM.exec(label);
  if (cvm) {
    return [{ label, url, origin: ORIGEM_BASE_LOCAL, period: cvm[1], baseDate: cvm[2] }];
  }

  const hostname = lerHostname(url);
  return hostname ? [{ label, url, origin: hostname, period: null, baseDate: null }] : [];
}

function lerHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
