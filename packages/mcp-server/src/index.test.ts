import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

// Os dois testes carregam o index, e com ele @hero/agent. No runner do GitHub Actions isso levou
// 7,4 s e 4,3 s, contra os 5 s padrão do Vitest. Fica acima dos 20 s do spawnSync.
const TEMPO_DE_CARREGAMENTO = 30_000;

describe('superfície pública do pacote', () => {
  it(
    'importar o index não conecta o stdio, não abre porta e não escreve no stdout',
    () => {
      // Processo separado. Se o import chamasse listen, o processo ficaria vivo e o timeout o
      // mataria (status null). Se conectasse o stdio, haveria alguém escutando o stdin — o
      // próprio script confere e sai com status 2.
      // No Windows, tanto o --import quanto o import() exigem URL file://, não caminho de disco.
      const indice = new URL('./index.ts', import.meta.url).href;
      const tsx = pathToFileURL(require.resolve('tsx')).href;
      const script = `await import(${JSON.stringify(indice)});
if (process.stdin.listenerCount('data') > 0) process.exitCode = 2;`;
      const resultado = spawnSync(
        process.execPath,
        ['--import', tsx, '--input-type=module', '-e', script],
        { input: '', timeout: 20_000, encoding: 'utf-8' },
      );

      expect(resultado.stderr).toBe('');
      expect(resultado.error).toBeUndefined();
      expect(resultado.status).toBe(0);
      expect(resultado.stdout).toBe('');
    },
    TEMPO_DE_CARREGAMENTO,
  );

  it(
    'expõe o plugin HTTP e a fábrica do servidor',
    async () => {
      const pacote = await import('./index.js');

      expect(Object.keys(pacote).sort()).toEqual([
        'DESCRICAO_PERGUNTAR',
        'criarServidorMcp',
        'mcpHttpPlugin',
      ]);
    },
    TEMPO_DE_CARREGAMENTO,
  );
});
