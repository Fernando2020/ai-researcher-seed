import { buscarPaginaDemo } from '../demo/search-demo.js';
import type { BuscarPagina } from '../nodes/web-search.js';
import { buscarHtml } from './fetch-html.js';

// Único ponto que lê DEMO pro download de páginas: com DEMO=true, o HTML vem das fixtures em
// vez da rede. O buscarHtml real não sabe que o modo demo existe.
export function criarBuscarPagina(): BuscarPagina {
  return process.env.DEMO === 'true' ? buscarPaginaDemo : buscarHtml;
}
