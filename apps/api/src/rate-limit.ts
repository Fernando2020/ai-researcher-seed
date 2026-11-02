import type { RateLimitPluginOptions } from '@fastify/rate-limit';

const MAX_PADRAO = 30;
const JANELA_PADRAO_MS = 60_000;

// O plugin aceita valor inválido sem reclamar e só falha na requisição. Aqui a API nem sobe: no
// Cloud Run, a revisão nova não recebe tráfego, e a anterior continua no ar.
function lerInteiro(nome: string, padrao: number, minimo: number): number {
  const valor = Number(process.env[nome] || padrao);
  if (!Number.isInteger(valor) || valor < minimo) {
    throw new Error(`${nome} precisa ser um inteiro maior ou igual a ${minimo}.`);
  }
  return valor;
}

// Calculadas dentro de build(), não no import: o teste que ajusta a variável em runtime vê o valor novo.
export function criarOpcoesRateLimit(): RateLimitPluginOptions {
  return {
    global: true,
    max: lerInteiro('RATE_LIMIT_MAX', MAX_PADRAO, 1),
    timeWindow: lerInteiro('RATE_LIMIT_WINDOW', JANELA_PADRAO_MS, 1),
  };
}

// O limite é por IP, e atrás de proxy o IP da conexão é o do proxy. Este número diz quantos saltos do
// X-Forwarded-For são confiáveis, contando da direita. `true` confiaria na lista toda, e o cliente
// burlaria o limite forjando o header. Fora de produção não há proxy, e o padrão é zero.
export function lerSaltosDeProxy(): number {
  return lerInteiro('TRUST_PROXY_HOPS', 0, 0);
}
