import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Health } from './health';

describe('Health', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Health],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  it('renderiza o status vindo de /api/health, sem tocar rede de verdade', async () => {
    const fixture = TestBed.createComponent(Health);
    fixture.detectChanges();

    httpMock.expectOne('/api/health').flush({ status: 'ok', database: 'ok' });
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('status: ok');
    expect(compiled.textContent).toContain('database: ok');
  });

  it('avisa quando /api/health falha', async () => {
    const fixture = TestBed.createComponent(Health);
    fixture.detectChanges();

    httpMock.expectOne('/api/health').flush('erro', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Não foi possível consultar /api/health');
  });
});
