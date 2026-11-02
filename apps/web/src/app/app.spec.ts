import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  async function navegar(url: string): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    // Sem whenStable: a rota /health deixa um HTTP pendente até o teste responder com flush.
    await TestBed.inject(Router).navigateByUrl(url);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('mostra o Chat na rota raiz, sem consultar /api/health', async () => {
    const tela = await navegar('/');

    expect(tela.querySelector('app-chat')).not.toBeNull();
    TestBed.inject(HttpTestingController).expectNone('/api/health');
  });

  it('mostra o Health na rota /health', async () => {
    const tela = await navegar('/health');

    expect(tela.querySelector('app-health')).not.toBeNull();
    expect(tela.querySelector('app-chat')).toBeNull();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/health')
      .flush({ status: 'ok', database: 'ok' });
  });
});
