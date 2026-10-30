import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { build } from '../app.js';
import type { GrafoDaApi } from '../app.js';

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

// A API inteira de verdade, numa porta livre: o transporte HTTP do MCP é testado pela rede,
// como um cliente o usaria.
async function subir(getGraph: () => GrafoDaApi): Promise<string> {
  app = build({ checkDatabase: async () => true, getGraph });
  return app.listen({ port: 0, host: '127.0.0.1' });
}

// Uma chamada JSON-RPC à tool perguntar, no formato do Streamable HTTP.
function chamarPerguntar(base: string, pergunta: string) {
  return fetch(`${base}/api/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'perguntar', arguments: { pergunta } },
    }),
  });
}

function grafoFake(): GrafoDaApi {
  return {
    invoke: vi.fn().mockResolvedValue({ response: 'Resposta via MCP [CVM VALE 3T25].' }),
    stream: vi.fn().mockResolvedValue(
      (async function* () {
        yield { answer: { response: 'Resposta via chat.' } };
      })(),
    ),
  };
}

describe('gateway MCP em /api/mcp', () => {
  it('responde a tool perguntar pela mesma porta e prefixo do /chat', async () => {
    const grafo = grafoFake();
    const base = await subir(() => grafo);

    const resposta = await chamarPerguntar(base, 'Qual a receita da Vale no 3T25?');
    const corpo = (await resposta.json()) as { result: { content: { text: string }[] } };

    expect(resposta.status).toBe(200);
    expect(corpo.result.content[0].text).toContain('[CVM VALE 3T25]');
  });

  it('/chat e /mcp usam a mesma instância do grafo, vinda da mesma função', async () => {
    const grafo = grafoFake();
    const getGraph = vi.fn(() => grafo);
    const base = await subir(getGraph);

    await chamarPerguntar(base, 'pergunta pelo MCP');
    await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'pergunta pelo chat' }),
    }).then((r) => r.text());

    // Uma fonte só: as duas rotas pediram o grafo à mesma função, e o mesmo objeto atendeu
    // as duas — o MCP pelo invoke, o chat pelo stream.
    expect(getGraph).toHaveBeenCalledTimes(2);
    expect(grafo.invoke).toHaveBeenCalledWith({ question: 'pergunta pelo MCP' });
    expect(grafo.stream).toHaveBeenCalledWith(
      { question: 'pergunta pelo chat' },
      expect.objectContaining({ streamMode: 'updates' }),
    );
  });

  it('sem grafo configurado, a tool devolve isError — o MCP não usa problem+json', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const base = await subir(() => {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID não configurada');
    });

    const resposta = await chamarPerguntar(base, 'x');
    const corpo = (await resposta.json()) as { result: { isError: boolean } };

    expect(resposta.status).toBe(200);
    expect(corpo.result.isError).toBe(true);
  });

  it('GET /api/mcp responde 405', async () => {
    const base = await subir(grafoFake);

    const resposta = await fetch(`${base}/api/mcp`);

    expect(resposta.status).toBe(405);
  });
});
