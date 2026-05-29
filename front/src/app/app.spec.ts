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
      version: '0.3.0',
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
      recent_scans: [
        {
          id: 99,
          project: {
            id: 1,
            name: 'PatchProof CLI',
            slug: 'patchproof-cli',
          },
          source: 'cli',
          language: 'en',
          fail_on: 'high',
          format: 'markdown',
          status: 'completed',
          summary: {
            total: 1,
            high: 1,
          },
          findings: [
            {
              ruleId: 'PP002',
              title: 'Potential SQL injection',
              description: 'The added line builds a SQL statement with string concatenation.',
              recommendation: 'Use bound parameters.',
            },
          ],
          remediations: [
            {
              rule_id: 'PP002',
              rule_title: 'Potential SQL injection',
              finding_title: 'Potential SQL injection',
              summary: 'SQL is being built with concatenation or interpolation instead of safer bindings.',
              source: 'deterministic',
              primary_fix: {
                title: 'Use bound parameters',
                description: 'Move raw values into placeholders and bindings, or use the query builder / prepared statements.',
              },
              alternatives: [
                {
                  title: 'Use the framework query builder',
                  description: 'Compose the query with builder methods instead of raw SQL fragments.',
                },
              ],
              ai_prompt: 'Rule: PP002 Finding: Potential SQL injection Goal: suggest one primary fix and two alternatives for Laravel/PHP. Focus on parameterized queries.',
            },
          ],
          metadata: {},
          report_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
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

  it('should render remediation guidance for the selected scan', async () => {
    const originalNgOnInit = App.prototype.ngOnInit;
    App.prototype.ngOnInit = async function (): Promise<void> {};

    try {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance as any;

      app.loading.set(false);
      app.loadingProject.set(false);
      app.projects.set([
        {
          id: 1,
          name: 'PatchProof CLI',
          slug: 'patchproof-cli',
          description: 'Open source CLI',
          scans_count: 1,
        },
      ]);
      app.selectedProjectId.set(1);
      app.projectSummary.set({
        project: {
          id: 1,
          name: 'PatchProof CLI',
          slug: 'patchproof-cli',
          description: 'Open source CLI',
        },
        totals: {
          scans: 1,
          statuses: { completed: 1 },
        },
        breakdowns: {
          languages: [{ language: 'en', count: 1 }],
          sources: [{ source: 'cli', count: 1 }],
          severities: [{ severity: 'high', count: 1 }],
        },
        latest_scan_at: new Date().toISOString(),
        recent_scans: [],
        recent_usages: [],
      });
      app.projectScans.set([
        {
          id: 99,
          project: {
            id: 1,
            name: 'PatchProof CLI',
            slug: 'patchproof-cli',
          },
          source: 'cli',
          language: 'en',
          fail_on: 'high',
          format: 'markdown',
          status: 'completed',
          summary: {
            total: 1,
            high: 1,
          },
          findings: [
            {
              ruleId: 'PP002',
              title: 'Potential SQL injection',
              description: 'The added line builds a SQL statement with string concatenation.',
              recommendation: 'Use bound parameters.',
            },
          ],
          remediations: [
            {
              rule_id: 'PP002',
              rule_title: 'Potential SQL injection',
              finding_title: 'Potential SQL injection',
              summary: 'SQL is being built with concatenation or interpolation instead of safer bindings.',
              source: 'deterministic',
              primary_fix: {
                title: 'Use bound parameters',
                description: 'Move raw values into placeholders and bindings, or use the query builder / prepared statements.',
              },
              alternatives: [
                {
                  title: 'Use the framework query builder',
                  description: 'Compose the query with builder methods instead of raw SQL fragments.',
                },
              ],
              ai_prompt: 'Rule: PP002 Finding: Potential SQL injection Goal: suggest one primary fix and two alternatives for Laravel/PHP. Focus on parameterized queries.',
            },
          ],
          metadata: {},
          report_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      app.selectedScanId.set(99);

      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Remediation guidance');
      expect(compiled.textContent).toContain('Use bound parameters');
    } finally {
      App.prototype.ngOnInit = originalNgOnInit;
    }
  });

  it('should persist the admin key locally', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;

    app.adminKeyDraft.set('admin-secret');
    await app.saveAdminKey();

    expect(window.localStorage.getItem('patchproof.admin.key')).toBe('admin-secret');
    expect(app.canManageKeys()).toBe(true);
  });

  it('should persist the ai key locally', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;

    app.aiKeyDraft.set('sk-test');
    await app.saveAiKey();

    expect(window.localStorage.getItem('patchproof.remediation.ai.key')).toBe('sk-test');
    expect(app.canUseAi()).toBe(true);
  });
});
