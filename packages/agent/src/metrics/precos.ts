export interface PrecoDoModelo {
  input: number;
  cachedInput: number;
  // Já cobre o raciocínio do modelo: a Vertex AI cobra thinking tokens pelo preço de saída.
  output: number;
}

// USD por milhão de tokens, pay-as-you-go. Tabela oficial da Vertex AI, endpoint global:
// https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing
export const PRECOS_USD_POR_MILHAO: Record<string, PrecoDoModelo | undefined> = {
  'gemini-3.5-flash-lite': { input: 0.3, cachedInput: 0.03, output: 2.5 },
  // Preço promocional até 2026-12-31. A partir de 2027-01-01: 1.5, 0.15 e 7.5.
  'gemini-3.6-flash': { input: 0.75, cachedInput: 0.075, output: 3.75 },
};
