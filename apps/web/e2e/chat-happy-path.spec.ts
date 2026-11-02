import { expect, test } from '@playwright/test';

const PERGUNTA = 'Qual foi a receita líquida da Vale no 3T25?';
const DISCLAIMER =
  'Este assistente apresenta informações públicas, não recomendação de investimento.';
const ZIP_DA_CVM =
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip';

test.beforeEach(async ({ page }) => {
  // O teste não depende de rede externa: as fontes do Google ficam de fora.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (rota) => rota.abort());
});

test('pergunta, resposta em streaming, citação e pipeline completos', async ({ page }) => {
  await page.goto('/');

  const disclaimer = page.getByText(DISCLAIMER);
  const resposta = page.locator('.bubble--assistant');
  const cursor = resposta.locator('.cursor');
  const etapas = page.locator('app-graph-panel .step');

  await test.step('o disclaimer está visível antes de perguntar', async () => {
    await expect(disclaimer).toBeVisible();
  });

  await test.step('envia a pergunta', async () => {
    await page.getByLabel('Sua pergunta').fill(PERGUNTA);
    await page.getByRole('button', { name: 'Enviar' }).click();

    await expect(page.locator('.bubble--user')).toHaveText(PERGUNTA);
    await expect(page.getByLabel('Sua pergunta')).toHaveValue('');
  });

  await test.step('o texto chega aos poucos, com o cursor, e o disclaimer continua', async () => {
    await expect(cursor).toBeVisible();
    await expect(disclaimer).toBeVisible();
  });

  await test.step('a resposta termina com o valor, sem o bloco de fontes no corpo', async () => {
    await expect(resposta).toContainText('R$ 56,7 bilhões');
    await expect(cursor).toHaveCount(0);
    await expect(resposta).not.toContainText('Fontes:');
    await expect(disclaimer).toBeVisible();
  });

  await test.step('a citação abre o painel com data-base, origem e link', async () => {
    const citacao = page.getByRole('button', { name: /VALE · 3T25/ });
    await expect(citacao).toHaveAttribute('aria-pressed', 'false');

    await citacao.click();

    await expect(citacao).toHaveAttribute('aria-pressed', 'true');
    const painel = page.getByRole('complementary', { name: 'Detalhes da citação' });
    await expect(painel.getByRole('definition').first()).toHaveText('30/09/2025');
    await expect(painel.getByText('Base local (CVM)')).toBeVisible();
    await expect(painel.getByRole('link', { name: 'Abrir o documento original' })).toHaveAttribute(
      'href',
      ZIP_DA_CVM,
    );
  });

  await test.step('o pipeline terminou em 3 etapas, sem passar por Search', async () => {
    await expect(etapas).toHaveCount(3);
    await expect(etapas.locator('.label')).toHaveText(['Retrieve', 'Grade', 'Answer']);
    await expect(etapas.locator('.status')).toHaveText(['Concluído', 'Concluído', 'Concluído']);
    await expect(page.locator('app-graph-panel').getByRole('status')).toHaveCount(0);
  });
});
