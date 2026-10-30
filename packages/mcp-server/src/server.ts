import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { chatRequestSchema } from '@hero/contracts';

// Só o que a tool usa do grafo. O grafo compilado do LangGraph satisfaz esta interface sem
// adaptador; nos testes, um objeto com um `invoke` fake basta — sem Postgres, sem Vertex AI.
export interface GrafoPerguntar {
  invoke(input: { question: string }): Promise<{ response: string }>;
}

// Função, não o grafo pronto: o servidor só pede o grafo quando a tool é chamada. Assim o
// processo sobe e lista as tools sem credencial nenhuma, e o grafo real nasce na primeira
// pergunta (ver `obterGrafoReal` em @hero/agent).
export type GetGraph = () => GrafoPerguntar;

const MENSAGEM_ERRO =
  'Não foi possível responder agora: a consulta à base de indicadores falhou. Tente novamente em instantes.';

// A descrição é lida pelo LLM do cliente MCP pra decidir quando chamar a tool — é prompt, não
// documentação. Por isso diz o domínio exato, o que fica de fora e repete o guardrail. A lista de
// empresas é a de packages/corpus/data/empresas.csv (um teste garante que as duas não divergem).
export const DESCRICAO_PERGUNTAR = `Responde perguntas sobre indicadores financeiros trimestrais de 20 empresas listadas na B3, com base nos formulários ITR e DFP da CVM (Dados Abertos), últimos 4 trimestres.

Empresas cobertas: Itaú Unibanco (ITUB), Bradesco (BBDC), Banco do Brasil (BBAS), Axia Energia (ELET), Engie Brasil (EGIE), Cemig (CMIG), Petrobras (PETR), Prio (PRIO), Vale (VALE), Gerdau (GGBR), CSN (CSNA), Magazine Luiza (MGLU), Lojas Renner (LREN), Assaí/Sendas (ASAI), Ambev (ABEV), JBS (JBSS), BRF (BRFS), Suzano (SUZB), Klabin (KLBN) e Totvs (TOTS).

Indicadores na base: receita líquida, lucro bruto, lucro líquido, ativo total, patrimônio líquido e caixa operacional. Para perguntas qualitativas (motivo de uma variação, notícia, fato relevante, guidance), a tool complementa automaticamente com busca na web.

A resposta já vem pronta para o usuário: cita a fonte de cada dado e a data-base do período, e avisa quando o contexto encontrado é incompleto.

Esta tool informa, nunca recomenda: não diz se vale comprar, vender ou manter uma ação. Pedidos de recomendação recebem um aviso de que consultoria de valores mobiliários é atividade regulada pela CVM — não repasse a resposta como conselho de investimento.

Não use para: cotação ou preço de ação, empresas fora da lista acima, ou períodos fora dos últimos 4 trimestres.`;

export function criarServidorMcp(getGraph: GetGraph): McpServer {
  const server = new McpServer({ name: 'ai-researcher', version: '0.0.0' });

  server.registerTool(
    'perguntar',
    {
      title: 'Perguntar ao AI Researcher',
      description: DESCRICAO_PERGUNTAR,
      inputSchema: {
        // Mesma validação do POST /api/chat: texto não vazio, até 1000 caracteres.
        pergunta: chatRequestSchema.shape.question.describe(
          'A pergunta do usuário em linguagem natural, em português. Ex.: "Qual foi o lucro líquido da Vale no 3T25?"',
        ),
      },
    },
    async ({ pergunta }): Promise<CallToolResult> => {
      try {
        const { response } = await getGraph().invoke({ question: pergunta });
        return { content: [{ type: 'text', text: response }] };
      } catch (erro) {
        // A exceção crua nunca volta pro cliente: o detalhe vai pro stderr (no transporte stdio,
        // o stdout é o canal do protocolo), e a resposta é uma mensagem genérica com isError.
        console.error('[mcp-server] falha na tool perguntar:', erro);
        return { isError: true, content: [{ type: 'text', text: MENSAGEM_ERRO }] };
      }
    },
  );

  return server;
}
