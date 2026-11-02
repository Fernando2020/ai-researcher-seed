import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarServidorMcp, DESCRICAO_PERGUNTAR } from './server.js';
import type { GrafoPerguntar } from './server.js';
import type { GetGraph } from './server.js';

// Cliente MCP de verdade conversando com o servidor de verdade, pelo transporte em memória do
// próprio SDK. Só o grafo é fake.
async function conectar(getGraph: GetGraph) {
  const [transporteCliente, transporteServidor] = InMemoryTransport.createLinkedPair();
  const server = criarServidorMcp(getGraph);
  const client = new Client({ name: 'teste', version: '0.0.0' });
  await Promise.all([server.connect(transporteServidor), client.connect(transporteCliente)]);
  return client;
}

function textoDe(resultado: Awaited<ReturnType<Client['callTool']>>): string {
  const [primeiro] = resultado.content as { type: string; text: string }[];
  return primeiro.text;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('servidor MCP — listagem', () => {
  it('expõe uma única tool, perguntar, com o parâmetro pergunta obrigatório', async () => {
    const client = await conectar(() => {
      throw new Error('o grafo não deveria ser construído só pra listar');
    });

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(['perguntar']);
    expect(tools[0].inputSchema.required).toEqual(['pergunta']);
  });

  it('a descrição deixa claro o domínio e o guardrail', () => {
    expect(DESCRICAO_PERGUNTAR).toContain('20 empresas listadas na B3');
    expect(DESCRICAO_PERGUNTAR).toContain('CVM');
    expect(DESCRICAO_PERGUNTAR).toContain('nunca recomenda');
  });

  it('a descrição cita todos os tickers do corpus', () => {
    const csv = readFileSync(new URL('../../corpus/data/empresas.csv', import.meta.url), 'utf-8');
    const tickers = csv
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((linha) => linha.split(',')[0]);

    expect(tickers).toHaveLength(20);
    for (const ticker of tickers) {
      expect(DESCRICAO_PERGUNTAR).toContain(`(${ticker})`);
    }
  });
});

describe('servidor MCP — tool perguntar', () => {
  it('roda o grafo com a pergunta e devolve a resposta final', async () => {
    const invoke = vi.fn().mockResolvedValue({
      response:
        'A Vale teve receita líquida de R$ 56,7 bilhões no 3T25 [CVM VALE 3T25].\n\nFontes:\n- VALE · 3T25 (data-base 30/09/2025) (https://dados.cvm.gov.br/itr_cia_aberta_2025.zip)',
    });
    const client = await conectar(() => ({ invoke }));

    const resultado = await client.callTool({
      name: 'perguntar',
      arguments: { pergunta: 'Qual a receita da Vale no 3T25?' },
    });

    expect(invoke).toHaveBeenCalledWith(
      { question: 'Qual a receita da Vale no 3T25?' },
      { callbacks: [expect.anything()] },
    );
    expect(resultado.isError).toBeFalsy();
    expect(textoDe(resultado)).toContain('[CVM VALE 3T25]');
    expect(textoDe(resultado)).toContain('data-base 30/09/2025');
  });

  it('passa um handler novo do Langfuse a cada chamada, quando as chaves existem', async () => {
    vi.stubEnv('LANGFUSE_PUBLIC_KEY', 'pk-teste');
    vi.stubEnv('LANGFUSE_SECRET_KEY', 'sk-teste');
    const invoke = vi.fn<GrafoPerguntar['invoke']>(() => Promise.resolve({ response: 'ok' }));
    const client = await conectar(() => ({ invoke }));

    await client.callTool({ name: 'perguntar', arguments: { pergunta: 'a' } });
    await client.callTool({ name: 'perguntar', arguments: { pergunta: 'b' } });
    vi.unstubAllEnvs();

    const [primeiro] = invoke.mock.calls[0]?.[1].callbacks ?? [];
    const [segundo] = invoke.mock.calls[1]?.[1].callbacks ?? [];
    expect(primeiro).toBeDefined();
    expect(segundo).toBeDefined();
    expect(primeiro).not.toBe(segundo);
  });

  it('pede o grafo só na chamada da tool, e a cada chamada (a memoização é do agent)', async () => {
    const getGraph = vi.fn(() => ({ invoke: () => Promise.resolve({ response: 'ok' }) }));
    const client = await conectar(getGraph);

    expect(getGraph).not.toHaveBeenCalled();
    await client.callTool({ name: 'perguntar', arguments: { pergunta: 'a' } });
    await client.callTool({ name: 'perguntar', arguments: { pergunta: 'b' } });

    expect(getGraph).toHaveBeenCalledTimes(2);
  });

  it('se o grafo falhar, devolve isError com mensagem genérica, sem vazar a exceção', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = await conectar(() => ({
      invoke: () => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.5:5432')),
    }));

    const resultado = await client.callTool({
      name: 'perguntar',
      arguments: { pergunta: 'Qual a receita da Vale?' },
    });

    expect(resultado.isError).toBe(true);
    expect(textoDe(resultado)).toContain('Não foi possível responder agora');
    expect(textoDe(resultado)).not.toContain('ECONNREFUSED');
  });

  it('se nem construir o grafo for possível (falta configuração), também devolve isError', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = await conectar(() => {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID não configurada');
    });

    const resultado = await client.callTool({ name: 'perguntar', arguments: { pergunta: 'x' } });

    expect(resultado.isError).toBe(true);
    expect(textoDe(resultado)).not.toContain('GOOGLE_CLOUD_PROJECT_ID');
  });

  it('pergunta vazia é recusada pela validação, sem chamar o grafo', async () => {
    const invoke = vi.fn();
    const client = await conectar(() => ({ invoke }));

    const resultado = await client.callTool({ name: 'perguntar', arguments: { pergunta: '   ' } });

    expect(resultado.isError).toBe(true);
    expect(invoke).not.toHaveBeenCalled();
  });
});
