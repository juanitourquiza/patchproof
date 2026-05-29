import { DatePipe, JsonPipe, NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { PatchProofApiService } from './patchproof-api.service';
import {
  ApiKeyRecord,
  HealthResponse,
  ProjectRecord,
  ProjectSummaryResponse,
  ScanRecord,
  UsageEventRecord,
} from './patchproof.types';

type StatusTone = 'ok' | 'warn' | 'danger' | 'neutral';

const FINDING_LABELS: Record<string, string> = {
  PP001: 'Hardcoded secret',
  PP002: 'Potential SQL injection',
  PP003: 'Unsafe HTML rendering',
  PP004: 'Dangerous dynamic execution',
  PP005: 'Permissive CORS configuration',
};

@Component({
  selector: 'app-root',
  imports: [DatePipe, JsonPipe, NgClass],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly api = inject(PatchProofApiService);
  private readonly adminKeyStorageKey = 'patchproof.admin.key';

  protected readonly loading = signal(true);
  protected readonly loadingProject = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly adminKeyDraft = signal('');
  protected readonly health = signal<HealthResponse | null>(null);
  protected readonly projects = signal<ProjectRecord[]>([]);
  protected readonly selectedProjectId = signal<number | null>(null);
  protected readonly projectSummary = signal<ProjectSummaryResponse | null>(null);
  protected readonly projectScans = signal<ScanRecord[]>([]);
  protected readonly projectUsageEvents = signal<UsageEventRecord[]>([]);
  protected readonly selectedScanId = signal<number | null>(null);
  protected readonly projectApiKeys = signal<ApiKeyRecord[]>([]);
  protected readonly projectApiKeysError = signal<string | null>(null);
  protected readonly storedAdminKey = signal<string>('');
  protected readonly canManageKeys = computed(() => this.storedAdminKey().trim().length > 0);
  protected readonly actionMessage = signal<string | null>(null);
  protected readonly refreshedAt = signal<Date | null>(null);

  protected readonly selectedProject = computed(() =>
    this.projects().find((project) => project.id === this.selectedProjectId()) ?? null
  );

  protected readonly selectedScan = computed(() =>
    this.projectScans().find((scan) => scan.id === this.selectedScanId()) ?? null
  );

  async ngOnInit(): Promise<void> {
    this.restoreAdminKey();
    await this.loadDashboard();
  }

  protected async refresh(): Promise<void> {
    await this.loadDashboard(this.selectedProjectId());
  }

  protected async selectProject(projectId: number): Promise<void> {
    this.selectedProjectId.set(projectId);
    await this.loadProject(projectId);
  }

  protected selectScan(scanId: number): void {
    this.selectedScanId.set(scanId);
    window.requestAnimationFrame(() => {
      document.getElementById('scan-detail')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  protected async revokeKey(apiKey: ApiKeyRecord): Promise<void> {
    const project = this.selectedProject();

    if (!project || apiKey.revoked_at || !this.canManageKeys()) {
      return;
    }

    const confirmed = window.confirm(`Revoke ${apiKey.name ?? apiKey.key_prefix}?`);

    if (!confirmed) {
      return;
    }

    await this.api.revokeProjectApiKey(project.id, apiKey.id, this.storedAdminKey());
    this.actionMessage.set(`Revoked ${apiKey.name ?? apiKey.key_prefix}.`);
    await this.loadProject(project.id);
  }

  protected async saveAdminKey(): Promise<void> {
    const adminKey = this.adminKeyDraft().trim();

    if (!adminKey) {
      this.clearAdminKey();
      return;
    }

    window.localStorage.setItem(this.adminKeyStorageKey, adminKey);
    this.storedAdminKey.set(adminKey);
    this.actionMessage.set('Admin key saved locally in this browser.');
    this.adminKeyDraft.set('');

    const projectId = this.selectedProjectId();

    if (projectId !== null) {
      await this.loadProject(projectId);
    }
  }

  protected clearAdminKey(): void {
    window.localStorage.removeItem(this.adminKeyStorageKey);
    this.storedAdminKey.set('');
    this.adminKeyDraft.set('');
    this.projectApiKeys.set([]);
    this.projectApiKeysError.set(null);
    this.actionMessage.set('Admin key removed from this browser.');
  }

  protected statusTone(status: string): StatusTone {
    switch (status) {
      case 'completed':
        return 'ok';
      case 'failed':
        return 'danger';
      case 'queued':
        return 'warn';
      default:
        return 'neutral';
    }
  }

  protected severityTone(severity: string): StatusTone {
    switch (severity) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'warn';
      case 'medium':
        return 'neutral';
      default:
        return 'ok';
    }
  }

  protected scanFindingTotal(scan: ScanRecord): number {
    return Object.values(scan.summary ?? {}).reduce((total, value) => total + Number(value ?? 0), 0);
  }

  protected statusCount(summary: ProjectSummaryResponse, status: string): number {
    return summary.totals.statuses[status] ?? 0;
  }

  protected scanWorstSeverity(scan: ScanRecord): string {
    const severityOrder = ['critical', 'high', 'medium', 'low'] as const;

    for (const severity of severityOrder) {
      if (Number(scan.summary?.[severity] ?? 0) > 0) {
        return severity;
      }
    }

    return 'info';
  }

  protected scanSeverityCount(scan: ScanRecord, severity: string): number {
    return Number(scan.summary?.[severity] ?? 0);
  }

  protected scanRepositoryLabel(scan: ScanRecord): string {
    return scan.project ? `${scan.project.name} · ${scan.project.slug}` : 'Unknown repository';
  }

  protected usageLabel(event: UsageEventRecord): string {
    return `${event.kind}${event.source ? ` · ${event.source}` : ''}`;
  }

  protected usageSummary(event: UsageEventRecord): string {
    const findings = Number(event.findings_total ?? 0);
    const scanRef = event.scan_id ? `#${event.scan_id}` : 'scan';
    const language = event.language ? ` · ${event.language}` : '';
    const severity = event.fail_on ? ` · fail on ${event.fail_on}` : '';

    return `${scanRef}${language}${severity} · ${findings} finding${findings === 1 ? '' : 's'}`;
  }

  protected usageTone(event: UsageEventRecord): StatusTone {
    switch (event.status) {
      case 'completed':
        return 'ok';
      case 'failed':
        return 'danger';
      case 'queued':
        return 'warn';
      default:
        return 'neutral';
    }
  }

  protected scanFindingSummary(scan: ScanRecord): string {
    const total = this.scanFindingTotal(scan);
    const critical = this.scanSeverityCount(scan, 'critical');
    const high = this.scanSeverityCount(scan, 'high');
    const medium = this.scanSeverityCount(scan, 'medium');

    return [
      `${total} finding${total === 1 ? '' : 's'}`,
      critical > 0 ? `${critical} critical` : null,
      high > 0 ? `${high} high` : null,
      medium > 0 ? `${medium} medium` : null,
    ]
      .filter((item): item is string => Boolean(item))
      .join(' · ');
  }

  protected findingTitle(finding: Record<string, unknown>): string {
    const explicit = this.findingText(finding, ['title', 'message', 'description', 'name']);
    if (explicit) {
      return explicit;
    }

    const ruleId = this.findingText(finding, ['rule_id', 'ruleId']);

    if (ruleId && FINDING_LABELS[ruleId]) {
      return FINDING_LABELS[ruleId];
    }

    return ruleId || 'Finding';
  }

  protected findingSeverity(finding: Record<string, unknown>): StatusTone {
    const severity = this.findingText(finding, ['severity', 'level']).toLowerCase();

    switch (severity) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'warn';
      case 'medium':
        return 'neutral';
      case 'low':
        return 'ok';
      default:
        return 'neutral';
    }
  }

  protected findingSeverityLabel(finding: Record<string, unknown>): string {
    return this.findingText(finding, ['severity', 'level']) || 'finding';
  }

  protected findingLocation(finding: Record<string, unknown>): string {
    const file = this.findingText(finding, ['file', 'path', 'location']);
    const line = this.findingText(finding, ['line', 'line_number']);

    if (!file && !line) {
      return 'No file location';
    }

    return `${file}${line ? `:${line}` : ''}`;
  }

  protected findingEvidence(finding: Record<string, unknown>): string {
    return this.findingText(finding, ['evidence', 'snippet', 'code']);
  }

  protected findingRecommendation(finding: Record<string, unknown>): string {
    return this.findingText(finding, ['recommendation', 'fix', 'suggestion']);
  }

  protected findingRuleBadge(finding: Record<string, unknown>): string {
    const ruleId = this.findingText(finding, ['rule_id', 'ruleId']);

    if (!ruleId) {
      return 'Finding';
    }

    return FINDING_LABELS[ruleId] ? `${ruleId} · ${FINDING_LABELS[ruleId]}` : ruleId;
  }

  protected selectedScanLabel(): string {
    return this.selectedScan() ? `#${this.selectedScan()!.id}` : 'No scan selected';
  }

  protected selectedProjectLabel(): string {
    const project = this.selectedProject();

    if (!project) {
      return 'No project selected';
    }

    return `${project.name} · ${project.slug}`;
  }

  private async loadDashboard(selectedProjectId: number | null = null): Promise<void> {
    this.loading.set(true);
    this.loadingProject.set(true);
    this.error.set(null);
    this.actionMessage.set(null);

    try {
      const [health, projects] = await Promise.all([
        this.api.getHealth(),
        this.api.listProjects(),
      ]);

      this.health.set(health);
      this.projects.set(projects.data);

      const initialProjectId = selectedProjectId ?? projects.data[0]?.id ?? null;
      this.selectedProjectId.set(initialProjectId);

      if (initialProjectId !== null) {
        await this.loadProject(initialProjectId);
      } else {
        this.projectSummary.set(null);
        this.projectScans.set([]);
        this.projectUsageEvents.set([]);
        this.projectApiKeys.set([]);
        this.projectApiKeysError.set(null);
      }

      this.refreshedAt.set(new Date());
    } catch (error) {
      this.error.set(this.toErrorMessage(error));
    } finally {
      this.loading.set(false);
      this.loadingProject.set(false);
    }
  }

  private async loadProject(projectId: number): Promise<void> {
    this.loadingProject.set(true);
    this.error.set(null);
    this.projectApiKeysError.set(null);

    try {
      const summary = await this.api.getProjectSummary(projectId);

      this.projectSummary.set(summary);
      this.projectScans.set(summary.recent_scans);
      this.projectUsageEvents.set(summary.recent_usages ?? []);
      const preservedScanId = this.selectedScanId();
      const nextSelectedScanId =
        summary.recent_scans.find((scan) => scan.id === preservedScanId)?.id ??
        summary.recent_scans[0]?.id ??
        null;
      this.selectedScanId.set(nextSelectedScanId);
      this.projectApiKeys.set([]);

      if (this.canManageKeys()) {
        try {
          const apiKeys = await this.api.listProjectApiKeysWithAdminKey(projectId, this.storedAdminKey());
          this.projectApiKeys.set(apiKeys.data);
        } catch (error) {
          this.projectApiKeys.set([]);
          this.projectApiKeysError.set(this.toErrorMessage(error));
        }
      }
    } catch (error) {
      this.error.set(this.toErrorMessage(error));
    } finally {
      this.loadingProject.set(false);
    }
  }

  private restoreAdminKey(): void {
    const stored = window.localStorage.getItem(this.adminKeyStorageKey) ?? '';
    this.storedAdminKey.set(stored);
  }

  private findingText(finding: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = finding[key];

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
    }

    return '';
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unable to load PatchProof dashboard data.';
  }
}
