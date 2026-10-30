import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mcpHttpPlugin } from './http-plugin.js';
import type { GetGraph } from './server.js';

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

// Servidor Fastify de verdade, numa porta livre escolhida pelo sistema, só com o plugin.
async function subir(getGraph: GetGraph): Promise<URL> {
  app = Fastify({ logger: false });
  app.register(mcpHttpPlugin, { getGraph, path: '/mcp' });
  const endereco = await app.listen({ port: 0, host: '127.0.0.1' });
  return new URL('/mcp', endereco);
}

// Cliente MCP real do SDK, falando Streamable HTTP — o mesmo que um Claude Code ou o Angular usaria.
async function conectar(url: URL) {
  const client = new Client({ name: 'teste-http', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(url));
  return client;
}

const grafoQueResponde = (response: string) => ({
  invoke: vi.fn().mockResolvedValue({ response }),
});

describe('mcpHttpPlugin', () => {
  it('lista a tool perguntar e responde pela mesma tool do stdio', async () => {
    const grafo = grafoQueResponde('Receita de R$ 56,7 bilhões [CVM VALE 3T25].');
    const client = await conectar(await subir(() => grafo));

    const { tools } = await client.listTools();
    const resultado = await client.callTool({
      name: 'perguntar',
      arguments: { pergunta: 'Qual a receita da Vale no 3T25?' },
    });

    expect(tools.map((tool) => tool.name)).toEqual(['perguntar']);
    expect(grafo.invoke).toHaveBeenCalledWith({ question: 'Qual a receita da Vale no 3T25?' });
    expect((resultado.content as { text: string }[])[0].text).toContain('[CVM VALE 3T25]');
    await client.close();
  });

  it('é stateless: nenhuma resposta carrega id de sessão', async () => {
    const url = await subir(() => grafoQueResponde('ok'));

    const resposta = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'teste', version: '0' },
        },
      }),
    });

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('mcp-session-id')).toBeNull();
  });

  it('dois clientes independentes são atendidos sem sessão compartilhada', async () => {
    const url = await subir(() => grafoQueResponde('ok'));
    const [a, b] = await Promise.all([conectar(url), conectar(url)]);

    const [ra, rb] = await Promise.all([
      a.callTool({ name: 'perguntar', arguments: { pergunta: 'a' } }),
      b.callTool({ name: 'perguntar', arguments: { pergunta: 'b' } }),
    ]);

    expect(ra.isError).toBeFalsy();
    expect(rb.isError).toBeFalsy();
    await Promise.all([a.close(), b.close()]);
  });

  it.each(['GET', 'DELETE'])('%s responde 405, com Allow: POST', async (metodo) => {
    const url = await subir(() => grafoQueResponde('ok'));

    const resposta = await fetch(url, { method: metodo });

    expect(resposta.status).toBe(405);
    expect(resposta.headers.get('allow')).toBe('POST');
  });

  it('não constrói o grafo só pra inicializar e listar as tools', async () => {
    const getGraph = vi.fn(() => grafoQueResponde('ok'));
    const client = await conectar(await subir(getGraph));

    await client.listTools();

    expect(getGraph).not.toHaveBeenCalled();
    await client.close();
  });
});
