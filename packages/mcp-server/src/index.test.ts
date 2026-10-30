import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('superfície pública do pacote', () => {
  it('importar o index não conecta o stdio, não abre porta e não escreve no stdout', () => {
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
  });

  it('expõe o plugin HTTP e a fábrica do servidor', async () => {
    const pacote = await import('./index.js');

    expect(Object.keys(pacote).sort()).toEqual([
      'DESCRICAO_PERGUNTAR',
      'criarServidorMcp',
      'mcpHttpPlugin',
    ]);
  });
});
