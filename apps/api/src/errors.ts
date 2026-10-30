// Erros de domínio da API. A rota só lança; quem decide o status HTTP é o error handler central.

// O grafo não subiu neste ambiente (falta credencial da Vertex AI ou chave de busca).
export class ChatIndisponivelError extends Error {
  constructor() {
    super('O chat não está configurado neste ambiente.');
    this.name = 'ChatIndisponivelError';
  }
}
