import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { PatchProofApiService } from './patchproof-api.service';

const apiMock = {
  listProjectApiKeysWithAdminKey: vi.fn().mockResolvedValue({
    data: [],
  }),
  getHealth: () =>
    Promise.resolve({
      ok: true,
      service: 'patchproof-back',
      version: '0.2.0',
    }),
  listProjects: () =>
    Promise.resolve({
      data: [
        {
          id: 1,
          name: 'PatchProof CLI',
          slug: 'patchproof-cli',
          description: 'Open source CLI',
          scans_count: 2,
        },
      ],
    }),
  getProjectSummary: () =>
    Promise.resolve({
      project: {
        id: 1,
        name: 'PatchProof CLI',
        slug: 'patchproof-cli',
        description: 'Open source CLI',
      },
      totals: {
        scans: 2,
        statuses: {
          completed: 1,
          failed: 1,
        },
      },
      breakdowns: {
        languages: [{ language: 'en', count: 1 }],
        sources: [{ source: 'cli', count: 1 }],
        severities: [{ severity: 'critical', count: 1 }],
      },
      latest_scan_at: new Date().toISOString(),
      recent_scans: [],
    }),
  listProjectScans: () =>
    Promise.resolve({
      data: [],
      links: {},
      meta: {},
    }),
  revokeProjectApiKey: () => Promise.resolve(),
};

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  } as Storage;
}

describe('App', () => {
  beforeEach(async () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createLocalStorageMock(),
    });
    apiMock.listProjectApiKeysWithAdminKey.mockClear();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: PatchProofApiService,
          useValue: apiMock,
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hosted scan review');
  });

  it('should persist the admin key locally', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;

    app.adminKeyDraft.set('admin-secret');
    await app.saveAdminKey();

    expect(window.localStorage.getItem('patchproof.admin.key')).toBe('admin-secret');
    expect(app.canManageKeys()).toBe(true);
  });
});
