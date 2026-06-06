import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { PatchProofApiService } from './patchproof-api.service';

const apiMock = {
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  getAiSettings: vi.fn().mockResolvedValue({
    enabled: false,
    provider: 'openai',
    model: 'gpt-4.1-mini',
    base_url: 'https://api.openai.com/v1',
    source: 'env',
    api_key_source: 'none',
    api_key_configured: false,
    configured: false,
    available_providers: [
      {
        value: 'openai',
        label: 'OpenAI',
        description: 'OpenAI chat completions with structured JSON output.',
        needs_base_url: false,
      },
      {
        value: 'anthropic',
        label: 'Anthropic',
        description: 'Claude via the Anthropic Messages API.',
        needs_base_url: false,
      },
      {
        value: 'openai-compatible',
        label: 'OpenAI-compatible / local',
        description: 'Ollama, local gateways, or any OpenAI-compatible endpoint.',
        needs_base_url: true,
      },
    ],
  }),
  generateAiReview: vi.fn().mockResolvedValue({
    data: {
      scan_id: 99,
      source: 'deterministic',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      summary: 'Advisory review complete.',
      confidence_average: '0.78',
      suggestions: [],
    },
  }),
  getHealth: () =>
    Promise.resolve({
      ok: true,
      service: 'patchproof-back',
      version: '0.3.0',
    }),
  listProjects: () =>
    Promise.resolve({
      data: projectsData,
    }),
  saveAiSettings: vi.fn().mockResolvedValue({
    data: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4.1-mini',
      base_url: 'https://api.openai.com/v1',
      source: 'database',
      api_key_source: 'database',
      api_key_configured: true,
      configured: true,
      available_providers: [],
    },
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
};

let projectsData: Array<{
  id: number;
  name: string;
  slug: string;
  description: string | null;
  scans_count: number;
}> = [
  {
    id: 1,
    name: 'PatchProof CLI',
    slug: 'patchproof-cli',
    description: 'Open source CLI',
    scans_count: 2,
  },
];

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
    projectsData = [
      {
        id: 1,
        name: 'PatchProof CLI',
        slug: 'patchproof-cli',
        description: 'Open source CLI',
        scans_count: 2,
      },
    ];
    apiMock.createProject.mockReset();
    apiMock.deleteProject.mockReset();
    apiMock.getAiSettings.mockClear();
    apiMock.saveAiSettings.mockClear();
    apiMock.createProject.mockImplementation(async (params: { name: string; description?: string }) => {
      const created: {
        id: number;
        name: string;
        slug: string;
        description: string | null;
        scans_count: number;
      } = {
        id: 2,
        name: params.name,
        slug: 'patchproof-demo',
        description: params.description ?? null,
        scans_count: 0,
      };

      projectsData = [created, ...projectsData];

      return {
        data: created,
      };
    });
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
    expect(compiled.textContent).toContain('Local scan review');
  });

  it('should create a project and refresh the dashboard', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;

    app.loading.set(false);
    app.loadingProject.set(false);
    app.createProjectNameDraft.set('PatchProof Demo');
    app.createProjectDescriptionDraft.set('Hosted demo project');
    app.createProjectSlugDraft.set('');

    await app.createProject();

    expect(apiMock.createProject).toHaveBeenCalledWith({
      name: 'PatchProof Demo',
      description: 'Hosted demo project',
      slug: undefined,
    });
    expect(app.createProjectNameDraft()).toBe('');
    expect(app.createProjectDescriptionDraft()).toBe('');
    expect(app.selectedProjectId()).toBe(2);
    expect(app.projects().some((project: { id: number }) => project.id === 2)).toBe(true);
    expect(app.actionMessage()).toContain('PatchProof Demo');
  });

  it('should delete a project', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    const originalConfirm = window.confirm;

    app.projects.set([
      {
        id: 1,
        name: 'PatchProof CLI',
        slug: 'patchproof-cli',
        description: 'Open source CLI',
        scans_count: 2,
      },
      {
        id: 2,
        name: 'PatchProof Demo',
        slug: 'patchproof-demo',
        description: null,
        scans_count: 0,
      },
    ]);
    app.selectedProjectId.set(1);
    app.loadDashboard = vi.fn().mockResolvedValue(undefined);
    apiMock.deleteProject.mockResolvedValue({
      data: {
        deleted: true,
        project: {
          id: 1,
          name: 'PatchProof CLI',
          slug: 'patchproof-cli',
        },
      },
    });

    window.confirm = vi.fn().mockReturnValue(true) as unknown as typeof window.confirm;

    try {
      await app.deleteProject({
        id: 1,
        name: 'PatchProof CLI',
        slug: 'patchproof-cli',
        description: 'Open source CLI',
        scans_count: 2,
      });

      expect(apiMock.deleteProject).toHaveBeenCalledWith(1);
      expect(app.loadDashboard).toHaveBeenCalledWith(null);
      expect(app.actionMessage()).toContain('deleted');
    } finally {
      window.confirm = originalConfirm;
    }
  });

  it('should load a mock project with many issues', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;

    app.projects.set([
      {
        id: 1,
        name: 'PatchProof CLI',
        slug: 'patchproof-cli',
        description: 'Open source CLI',
        scans_count: 2,
      },
    ]);
    app.loading.set(false);
    app.loadingProject.set(false);

    await app.loadDemoProject();

    expect(app.selectedProjectId()).toBe(-101);
    expect(app.projects().some((project: { id: number }) => project.id === -101)).toBe(true);
    expect(app.projectScans().length).toBe(2);
    expect(app.projectScans()[0]?.findings.length).toBeGreaterThan(10);
    expect(app.aiReview()?.source).toBe('ai');
    expect(app.actionMessage()).toContain('mock project');
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
      app.aiReviewMode.set('deterministic');

      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Remediation guidance');
      expect(compiled.textContent).toContain('Use bound parameters');
    } finally {
      App.prototype.ngOnInit = originalNgOnInit;
    }
  });

  it('should save ai provider settings locally', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;

    app.aiEnabledDraft.set(true);
    app.aiProviderDraft.set('anthropic');
    app.aiModelDraft.set('claude-sonnet-4-20250514');
    app.aiBaseUrlDraft.set('');
    app.aiApiKeyDraft.set('sk-test');

    await app.saveAiSettings();

    expect(apiMock.saveAiSettings).toHaveBeenCalledWith({
      enabled: true,
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      base_url: '',
      api_key: 'sk-test',
    });
    expect(app.aiSettings()?.provider).toBe('openai');
  });
});
