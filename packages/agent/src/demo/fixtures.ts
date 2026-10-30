import type { SearchResult } from '../search/search-provider.js';

// Fixtures do modo DEMO: resultados de busca e o HTML de cada página, pra gravar a demonstração
// do fallback web sem depender do Serper nem de site nenhum estar no ar.
//
// O conteúdo é deliberadamente genérico e marcado como demonstração — título com [DEMO], URL no
// domínio reservado `.invalid` (RFC 2606, nunca resolve) e nenhum número ou fato inventado. Estes
// trechos são gravados em documentos_web e citados nas respostas: não podem passar por notícia real.

export interface ResultadoDemo extends SearchResult {
  html: string;
}

export interface FixtureDemo {
  // Comparadas por substring com a query, em minúsculas e sem acento.
  chaves: string[];
  resultados: ResultadoDemo[];
}

const AVISO = 'Conteúdo de demonstração do AI Researcher — não é notícia real nem fonte de dados.';

function pagina(titulo: string, paragrafos: string[]): string {
  return `<!doctype html>
<html lang="pt-BR">
<head><title>${titulo}</title><style>body { font-family: sans-serif; }</style></head>
<body>
<nav>Início | Mercados | Empresas</nav>
<article>
<h1>${titulo}</h1>
<p><em>${AVISO}</em></p>
${paragrafos.map((p) => `<p>${p}</p>`).join('\n')}
</article>
<footer>demo.invalid — página fictícia usada nas aulas</footer>
<script>console.log('ignorado pela extração');</script>
</body>
</html>`;
}

// A ordem importa: a primeira fixture que casar vence. A Vale fica por último porque "vale"
// também aparece em frases como "vale a pena", e uma pergunta que cite outra empresa deve
// casar com ela primeiro.
export const FIXTURES_DEMO: FixtureDemo[] = [
  {
    chaves: ['petrobras', 'petr'],
    resultados: [
      {
        title: '[DEMO] Petrobras: como acompanhar fatos relevantes',
        url: 'https://demo.invalid/petrobras/fatos-relevantes',
        snippet: 'Fato relevante é o comunicado obrigatório de companhias abertas à CVM.',
        html: pagina('[DEMO] Petrobras: como acompanhar fatos relevantes', [
          'Fato relevante é o comunicado que uma companhia aberta precisa divulgar sempre que um ato ou fato puder influenciar a cotação dos seus valores mobiliários ou a decisão dos investidores. A regra está na Resolução CVM 44.',
          'A Petrobras publica seus fatos relevantes no sistema Empresas.NET da CVM e na sua página de relações com investidores, ao mesmo tempo. Temas comuns nesse tipo de comunicado, em empresas do setor de petróleo, são mudanças na política de preços de combustíveis, aprovação de dividendos, venda de ativos e alterações na diretoria.',
          'Para saber se houve um fato relevante recente, a fonte primária é a lista de comunicados da companhia no site da CVM, ordenada por data de entrega.',
        ]),
      },
    ],
  },
  {
    chaves: ['klabin', 'klbn'],
    resultados: [
      {
        title: '[DEMO] Klabin: o que costuma explicar oscilações no resultado',
        url: 'https://demo.invalid/klabin/resultado-trimestral',
        snippet: 'Câmbio, preço da celulose e dívida em moeda estrangeira pesam no lucro do setor.',
        html: pagina('[DEMO] Klabin: o que costuma explicar oscilações no resultado', [
          'A Klabin produz papéis, embalagens e celulose, parte relevante dela vendida no mercado externo. Por isso o resultado é sensível ao preço internacional da celulose e à taxa de câmbio.',
          'Empresas do setor costumam carregar dívida em dólar. Quando o real se desvaloriza, a variação cambial sobre essa dívida entra no resultado financeiro como despesa, mesmo sem saída de caixa — é um motivo frequente para um trimestre fechar em prejuízo contábil enquanto a operação segue gerando caixa.',
          'Para saber o motivo de um prejuízo específico, a fonte primária é o release de resultados do trimestre, publicado pela companhia junto com o ITR.',
        ]),
      },
    ],
  },
  {
    chaves: ['vale3', 'vale'],
    resultados: [
      {
        title: '[DEMO] Vale: o que move a receita trimestral',
        url: 'https://demo.invalid/vale/receita-trimestral',
        snippet: 'Minério de ferro, demanda chinesa, câmbio e sazonalidade de chuvas.',
        html: pagina('[DEMO] Vale: o que move a receita trimestral', [
          'A maior parte da receita da Vale vem do minério de ferro, vendido principalmente para siderúrgicas da China. A receita trimestral acompanha o preço internacional do minério, o volume embarcado e a taxa de câmbio, já que as vendas são em dólar.',
          'O primeiro trimestre do ano costuma ter volume menor que o quarto: é o período de chuvas no Norte do país, onde ficam operações importantes de mina e de logística, o que reduz produção e embarques. Por isso a comparação entre o 4º trimestre e o 1º trimestre seguinte tende a mostrar queda sazonal.',
        ]),
      },
      {
        title: '[DEMO] Vale: onde encontrar o guidance de produção',
        url: 'https://demo.invalid/vale/guidance-producao',
        snippet: 'O guidance é divulgado pela própria companhia, em geral no fim do ano.',
        html: pagina('[DEMO] Vale: onde encontrar o guidance de produção', [
          'Guidance é a projeção que a própria empresa divulga para indicadores como produção, vendas e investimentos. Mineradoras costumam publicar o guidance de produção de minério de ferro do ano seguinte num evento com investidores no fim do ano.',
          'O guidance não aparece nos formulários ITR e DFP da CVM, que só trazem resultados já realizados. A fonte primária é o material de relações com investidores da companhia.',
        ]),
      },
    ],
  },
];

// Pergunta sem fixture cadastrada cai aqui: a demonstração nunca quebra por falta de cenário.
export const FIXTURE_GENERICA: FixtureDemo = {
  chaves: [],
  resultados: [
    {
      title: '[DEMO] Resultado genérico de busca',
      url: 'https://demo.invalid/generico',
      snippet: 'Nenhuma fixture específica cadastrada para esta pergunta.',
      html: pagina('[DEMO] Resultado genérico de busca', [
        'O modo de demonstração não tem uma fixture específica para esta pergunta. Em modo normal, aqui estaria o conteúdo de uma página encontrada pela busca web.',
        'Informações qualitativas sobre empresas listadas — fatos relevantes, guidance, motivos de variação de resultado — costumam estar nos comunicados publicados na CVM e nas páginas de relações com investidores.',
      ]),
    },
  ],
};
