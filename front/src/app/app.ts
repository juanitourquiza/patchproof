import { DatePipe, JsonPipe, NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { PatchProofApiService } from './patchproof-api.service';
import {
  defaultReportFileName,
  formatScanReport,
  saveScanReportPdf,
  type ReportDownloadFormat,
  type ReportFormat,
  type ReportScan,
} from './report-export';
import {
  AiRemediationResponse,
  AiReviewResponse,
  AiProviderOption,
  AiSettingsResponse,
  HealthResponse,
  ProjectRecord,
  ProjectSummaryResponse,
  RemediationRecord,
  ScanRecord,
  ScanResultRecord,
  UsageEventRecord,
} from './patchproof.types';

type StatusTone = 'ok' | 'warn' | 'danger' | 'neutral';
type AiCallState = 'success' | 'fallback' | 'error';
type DemoProjectState = {
  project: ProjectRecord;
  summary: ProjectSummaryResponse;
  scans: ScanRecord[];
  usages: UsageEventRecord[];
  aiReview: AiReviewResponse;
};

interface AiCallRecord {
  state: AiCallState;
  at: string;
  detail: string;
  provider: string;
  model: string;
  scanId: number;
}

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

  protected readonly loading = signal(true);
  protected readonly loadingProject = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly health = signal<HealthResponse | null>(null);
  protected readonly projects = signal<ProjectRecord[]>([]);
  protected readonly selectedProjectId = signal<number | null>(null);
  protected readonly projectSummary = signal<ProjectSummaryResponse | null>(null);
  protected readonly projectScans = signal<ScanRecord[]>([]);
  protected readonly projectUsageEvents = signal<UsageEventRecord[]>([]);
  protected readonly aiRemediations = signal<AiRemediationResponse | null>(null);
  protected readonly aiRemediationsLoading = signal(false);
  protected readonly aiRemediationsError = signal<string | null>(null);
  protected readonly aiReviewMode = signal<'deterministic' | 'ai'>('ai');
  protected readonly aiReview = signal<AiReviewResponse | null>(null);
  protected readonly aiReviewLoading = signal(false);
  protected readonly aiReviewError = signal<string | null>(null);
  protected readonly aiReviewCallStatus = signal<AiCallRecord | null>(null);
  protected readonly reportFormatDraft = signal<ReportDownloadFormat>('markdown');
  protected readonly exportingReport = signal(false);
  protected readonly exportReportError = signal<string | null>(null);
  protected readonly createProjectNameDraft = signal('');
  protected readonly createProjectDescriptionDraft = signal('');
  protected readonly createProjectSlugDraft = signal('');
  protected readonly creatingProject = signal(false);
  protected readonly createProjectError = signal<string | null>(null);
  protected readonly createProjectDialogOpen = signal(false);
  protected readonly sidebarToolsOpen = signal(false);
  protected readonly sidebarCollapsed = signal(false);
  protected readonly sidebarSection = signal<'projects' | 'scans' | 'policies' | 'settings'>('projects');
  protected readonly deletingProjectId = signal<number | null>(null);
  protected readonly scanUploadPayloadDraft = signal('');
  protected readonly submittingScan = signal(false);
  protected readonly submitScanError = signal<string | null>(null);
  protected readonly selectedScanId = signal<number | null>(null);
  protected readonly actionMessage = signal<string | null>(null);
  protected readonly refreshedAt = signal<Date | null>(null);
  protected readonly aiSettings = signal<AiSettingsResponse | null>(null);
  protected readonly aiSettingsLoading = signal(false);
  protected readonly aiSettingsSaving = signal(false);
  protected readonly aiSettingsError = signal<string | null>(null);
  protected readonly aiEnabledDraft = signal(true);
  protected readonly aiProviderDraft = signal<AiProviderOption['value']>('openai');
  protected readonly aiModelDraft = signal('gpt-4.1-mini');
  protected readonly aiBaseUrlDraft = signal('https://api.openai.com/v1');
  protected readonly aiApiKeyDraft = signal('');
  protected readonly aiApiKeyHint = signal<string>('Leave blank to keep the current saved key.');
  protected readonly reportMenuOpen = signal(false);
  protected readonly actionsMenuOpen = signal(false);
  protected readonly demoProjectEnabled = signal(false);

  protected readonly selectedProject = computed(() =>
    this.projects().find((project) => project.id === this.selectedProjectId()) ?? null
  );

  protected readonly isDemoProjectActive = computed(() => this.selectedProjectId() === this.demoProjectId);

  protected readonly selectedAiProvider = computed(() =>
    this.aiSettings()?.available_providers.find((item) => item.value === this.aiProviderDraft()) ?? null
  );

  protected readonly aiReviewStatus = computed(() => {
    if (this.aiReviewError()) {
      return {
        label: 'AI error',
        tone: 'danger' as StatusTone,
        detail: this.aiReviewError() ?? 'AI request failed.',
      };
    }

    if (this.aiReviewLoading()) {
      return {
        label: 'Checking…',
        tone: 'neutral' as StatusTone,
        detail: 'AI review request is in progress.',
      };
    }

    const review = this.aiReview();

    if (review?.source === 'ai') {
      return {
        label: 'AI connected',
        tone: 'ok' as StatusTone,
        detail: `${review.provider} · ${review.model}`,
      };
    }

    if (review?.source === 'deterministic') {
      return {
        label: 'AI fallback',
        tone: 'warn' as StatusTone,
        detail: review.note || 'Using deterministic fallback output.',
      };
    }

    if (this.aiSettings()?.configured) {
      return {
        label: 'AI ready',
        tone: 'neutral' as StatusTone,
        detail: `${this.aiSettings()?.provider || 'openai'} · ${this.aiSettings()?.model || 'gpt-4.1-mini'}`,
      };
    }

    return {
      label: 'AI not configured',
      tone: 'warn' as StatusTone,
      detail: 'Configure a provider in Settings to enable AI review.',
    };
  });

  protected readonly aiReviewCallLabel = computed(() => {
    const call = this.aiReviewCallStatus();

    if (!call) {
      return null;
    }

    const label = call.state === 'success' ? 'success' : call.state === 'fallback' ? 'fallback' : 'error';

    return {
      label,
      tone: call.state === 'success' ? ('ok' as StatusTone) : call.state === 'fallback' ? ('warn' as StatusTone) : ('danger' as StatusTone),
      detail: call.detail,
      at: call.at,
      provider: call.provider,
      model: call.model,
    };
  });

  protected readonly selectedScan = computed(() =>
    this.projectScans().find((scan) => scan.id === this.selectedScanId()) ?? null
  );

  private readonly demoProjectId = -101;

  async ngOnInit(): Promise<void> {
    this.restoreScanPayloadDraft();
    this.restoreAiReviewCallStatus();

    const useMockMode = new URLSearchParams(window.location.search).get('mock') === '1';
    if (useMockMode) {
      this.demoProjectEnabled.set(true);
      await this.loadDemoProject();
      return;
    }

    await this.loadDashboard();
  }

  protected async refresh(): Promise<void> {
    await this.loadDashboard(this.selectedProjectId());
  }

  protected async createProject(): Promise<void> {
    const name = this.createProjectNameDraft().trim();
    const description = this.createProjectDescriptionDraft().trim();
    const slug = this.createProjectSlugDraft().trim();

    if (!name || this.creatingProject()) {
      return;
    }

    this.creatingProject.set(true);
    this.createProjectError.set(null);

    try {
      const response = await this.api.createProject({
        name,
        description: description || undefined,
        slug: slug || undefined,
      });

      this.createProjectNameDraft.set('');
      this.createProjectDescriptionDraft.set('');
      this.createProjectSlugDraft.set('');
      this.createProjectDialogOpen.set(false);
      await this.loadDashboard(response.data.id);
      this.actionMessage.set(`Project "${response.data.name}" created.`);
    } catch (error) {
      this.createProjectError.set(this.toErrorMessage(error));
    } finally {
      this.creatingProject.set(false);
    }
  }

  protected canCreateProject(): boolean {
    return this.createProjectNameDraft().trim().length > 0;
  }

  protected toggleSidebarTools(): void {
    this.sidebarToolsOpen.set(!this.sidebarToolsOpen());
  }

  protected toggleActionsMenu(): void {
    this.actionsMenuOpen.set(!this.actionsMenuOpen());
    if (this.actionsMenuOpen()) {
      this.reportMenuOpen.set(false);
    }
  }

  protected toggleSidebarCollapsed(): void {
    this.sidebarCollapsed.set(!this.sidebarCollapsed());
    if (this.sidebarCollapsed()) {
      this.sidebarToolsOpen.set(false);
    }
  }

  protected openNewProjectForm(): void {
    this.createProjectError.set(null);
    this.createProjectDialogOpen.set(true);
  }

  protected closeCreateProjectDialog(): void {
    if (this.creatingProject()) {
      return;
    }

    this.createProjectDialogOpen.set(false);
  }

  protected activateSidebarSection(section: 'projects' | 'scans' | 'policies' | 'settings'): void {
    this.sidebarSection.set(section);
    this.sidebarToolsOpen.set(section === 'settings');

    switch (section) {
      case 'projects':
        this.scrollToElement('project-list-anchor');
        break;
      case 'scans':
        this.scrollToElement('scan-detail');
        break;
      case 'policies':
        this.scrollToElement('more-project-data-anchor');
        break;
      case 'settings':
        this.sidebarToolsOpen.set(true);
        this.scrollToElement('ai-settings-anchor');
        break;
    }
  }

  protected async deleteProject(project: ProjectRecord): Promise<void> {
    if (project.id === this.demoProjectId) {
      this.actionMessage.set('The demo project is mock data and cannot be deleted.');
      return;
    }

    if (this.deletingProjectId() === project.id) {
      return;
    }

    const confirmed = window.confirm(
      `Delete project "${project.name}"? This will also remove its scans and usage events.`
    );

    if (!confirmed) {
      return;
    }

    this.deletingProjectId.set(project.id);

    try {
      await this.api.deleteProject(project.id);

      const nextSelectedProjectId = this.selectedProjectId() === project.id ? null : this.selectedProjectId();
      await this.loadDashboard(nextSelectedProjectId);
      this.actionMessage.set(`Project "${project.name}" deleted.`);
    } catch (error) {
      this.error.set(this.toErrorMessage(error));
    } finally {
      this.deletingProjectId.set(null);
    }
  }

  protected isDemoProject(project: ProjectRecord): boolean {
    return project.id === this.demoProjectId;
  }

  protected async submitScan(): Promise<void> {
    const project = this.selectedProject();

    if (!project || this.submittingScan()) {
      return;
    }

    const parsed = this.parseScanPayload();
    if (!parsed) {
      this.submitScanError.set('The scan payload must be valid JSON.');
      return;
    }

    this.submittingScan.set(true);
    this.submitScanError.set(null);

    try {
      const response = await this.api.submitScan({
        project_id: project.id,
        source: parsed.source ?? 'cli',
        language: parsed.language ?? 'en',
        fail_on: parsed.fail_on ?? 'high',
        format: parsed.format ?? 'json',
        status: parsed.status ?? 'completed',
        summary: parsed.summary ?? {},
        findings: parsed.findings ?? [],
        metadata: parsed.metadata ?? {},
        report_url: parsed.report_url ?? null,
      });

      this.actionMessage.set(`Scan #${response.data.id} uploaded for ${project.name}.`);
      await this.loadProject(project.id);
      this.selectScan(response.data.id);
    } catch (error) {
      this.submitScanError.set(this.toErrorMessage(error));
    } finally {
      this.submittingScan.set(false);
    }
  }

  protected canSubmitScan(): boolean {
    return this.selectedProjectId() !== null;
  }

  protected loadExampleScanPayload(): void {
    this.scanUploadPayloadDraft.set(
      JSON.stringify(
        {
          source: 'cli',
          language: 'en',
          fail_on: 'high',
          format: 'json',
          status: 'completed',
          summary: {
            total: 1,
            high: 1,
          },
          findings: [
            {
              ruleId: 'PP002',
              severity: 'high',
              title: 'Potential SQL injection',
              description: 'A raw SQL fragment was built with string concatenation.',
              recommendation: 'Use bound parameters or the query builder.',
            },
          ],
          metadata: {
            tool: 'patchproof',
            origin: 'example',
          },
          report_url: null,
        },
        null,
        2
      )
    );
  }

  protected async loadDemoProject(): Promise<void> {
    this.demoProjectEnabled.set(true);
    this.actionsMenuOpen.set(false);
    this.reportMenuOpen.set(false);
    this.error.set(null);
    const demo = this.createDemoProjectState();
    this.projects.set(this.injectDemoProject(this.projects()));
    this.health.update((current) => current ?? { ok: true, service: 'patchproof-back', version: '0.3.0' });
    this.selectedProjectId.set(demo.project.id);
    this.applyDemoProjectState(demo);
    this.loading.set(false);
    this.loadingProject.set(false);
    this.actionMessage.set('Loaded a local mock project with a dense issue set for previewing reports.');
  }

  protected async selectProject(projectId: number): Promise<void> {
    if (projectId === this.demoProjectId && this.demoProjectEnabled()) {
      this.demoProjectEnabled.set(true);
      this.selectedProjectId.set(projectId);
      this.applyDemoProjectState(this.createDemoProjectState());
      this.actionsMenuOpen.set(false);
      this.reportMenuOpen.set(false);
      this.actionMessage.set('Loaded the mock project with sample issues.');
      return;
    }

    this.selectedProjectId.set(projectId);
    await this.loadProject(projectId);
  }

  protected selectScan(scanId: number): void {
    this.selectedScanId.set(scanId);
    this.aiRemediations.set(null);
    this.aiRemediationsError.set(null);
    this.aiReview.set(null);
    this.aiReviewError.set(null);
    this.restoreAiReviewCallStatus();
    window.requestAnimationFrame(() => {
      document.getElementById('scan-detail')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  protected async generateAiRemediations(): Promise<void> {
    const scan = this.selectedScan();

    if (!scan || this.aiRemediationsLoading()) {
      return;
    }

    this.aiRemediationsLoading.set(true);
    this.aiRemediationsError.set(null);

    try {
      const response = await this.api.generateAiRemediations(scan.id);

      this.aiRemediations.set(response.data);
    } catch (error) {
      this.aiRemediationsError.set(this.toErrorMessage(error));
    } finally {
      this.aiRemediationsLoading.set(false);
    }
  }

  protected async generateAiReview(): Promise<void> {
    const scan = this.selectedScan();

    if (!scan || this.aiReviewLoading()) {
      return;
    }

    this.aiReviewLoading.set(true);
    this.aiReviewError.set(null);

    try {
      const response = await this.api.generateAiReview(scan.id);

      this.aiReview.set(response.data);
      this.aiReviewMode.set('ai');
      this.recordAiReviewCall(
        response.data.source === 'ai' ? 'success' : 'fallback',
        response.data.source === 'ai'
          ? `Connected to ${response.data.provider} · ${response.data.model}`
          : response.data.note || 'Using deterministic fallback output.',
        response.data.provider,
        response.data.model,
        scan.id
      );
    } catch (error) {
      this.aiReviewError.set(this.toErrorMessage(error));
      this.recordAiReviewCall(
        'error',
        this.toErrorMessage(error),
        this.aiSettings()?.provider || this.aiProviderDraft(),
        this.aiSettings()?.model || this.aiModelDraft(),
        scan.id
      );
    } finally {
      this.aiReviewLoading.set(false);
    }
  }

  protected async exportSelectedReport(formatOverride?: ReportDownloadFormat): Promise<void> {
    const scan = this.selectedScan();

    if (!scan || this.exportingReport()) {
      return;
    }

    this.exportingReport.set(true);
    this.exportReportError.set(null);

    try {
      const exportScan = this.reportScanFromCurrentSelection(scan);
      const format = formatOverride ?? this.reportFormatDraft();
      const aiReview = this.aiReview();
      this.reportFormatDraft.set(format);
      const fileName = defaultReportFileName(exportScan, format);

      if (format === 'pdf') {
        saveScanReportPdf(exportScan, fileName, 'en', aiReview);
      } else {
        const content = formatScanReport(exportScan, format, 'en', aiReview);
        this.downloadReport(fileName, content, format);
      }

      this.actionMessage.set(`Report exported as ${fileName}.`);
      this.reportMenuOpen.set(false);
    } catch (error) {
      this.exportReportError.set(this.toErrorMessage(error));
    } finally {
      this.exportingReport.set(false);
    }
  }

  protected toggleReportMenu(): void {
    this.reportMenuOpen.set(!this.reportMenuOpen());
    if (this.reportMenuOpen()) {
      this.actionsMenuOpen.set(false);
    }
  }

  protected async saveAiSettings(): Promise<void> {
    if (this.aiSettingsSaving()) {
      return;
    }

    this.aiSettingsSaving.set(true);
    this.aiSettingsError.set(null);

    try {
      const response = await this.api.saveAiSettings({
        enabled: this.aiEnabledDraft(),
        provider: this.aiProviderDraft(),
        model: this.aiModelDraft(),
        base_url: this.aiBaseUrlDraft(),
        api_key: this.aiApiKeyDraft().trim() ? this.aiApiKeyDraft().trim() : undefined,
      });

      this.applyAiSettings(response.data);
      this.aiApiKeyDraft.set('');
      this.actionMessage.set(`AI provider saved: ${response.data.provider}.`);
    } catch (error) {
      this.aiSettingsError.set(this.toErrorMessage(error));
    } finally {
      this.aiSettingsSaving.set(false);
    }
  }

  protected async clearSavedAiKey(): Promise<void> {
    if (this.aiSettingsSaving()) {
      return;
    }

    this.aiSettingsSaving.set(true);
    this.aiSettingsError.set(null);

    try {
      const response = await this.api.saveAiSettings({
        enabled: this.aiEnabledDraft(),
        provider: this.aiProviderDraft(),
        model: this.aiModelDraft(),
        base_url: this.aiBaseUrlDraft(),
        clear_api_key: true,
      });

      this.applyAiSettings(response.data);
      this.aiApiKeyDraft.set('');
      this.actionMessage.set('Saved AI key cleared. Using .env or no-provider fallback now.');
    } catch (error) {
      this.aiSettingsError.set(this.toErrorMessage(error));
    } finally {
      this.aiSettingsSaving.set(false);
    }
  }

  protected switchReviewMode(mode: 'deterministic' | 'ai'): void {
    this.aiReviewMode.set(mode);
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
    if (Array.isArray(scan.findings) && scan.findings.length > 0) {
      return scan.findings.length;
    }

    const summary = scan.summary ?? {};
    const explicitTotal = Number(summary['total'] ?? summary['findings'] ?? summary['findings_total'] ?? 0);
    if (explicitTotal > 0) {
      return explicitTotal;
    }

    return ['critical', 'high', 'medium', 'low'].reduce(
      (total, severity) => total + Number(summary[severity] ?? 0),
      0
    );
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

  protected scanResult(scan: ScanRecord): ScanResultRecord {
    const result = scan.result;

    if (result) {
      return result;
    }

    const counts = this.scanSeverityCounts(scan);
    const findingTotal = Math.max(
      this.scanFindingTotal(scan),
      counts.critical + counts.high + counts.medium + counts.low
    );
    const score = this.calculateScanScore(counts, findingTotal);
    const verdict = this.verdictForScore(score, findingTotal);

    return {
      score,
      verdict,
      label: this.labelForVerdict(verdict),
      summary: this.resultSummaryFor(findingTotal, counts, verdict),
      recommendation: this.resultRecommendationFor(verdict, findingTotal),
      finding_total: findingTotal,
      severity: this.worstResultSeverity(counts),
    };
  }

  protected scanResultTone(scan: ScanRecord): StatusTone {
    const verdict = this.scanResult(scan).verdict;

    switch (verdict) {
      case 'clean':
      case 'low-risk':
        return 'ok';
      case 'moderate':
        return 'warn';
      case 'high-risk':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  protected scanResultLabel(scan: ScanRecord): string {
    const result = this.scanResult(scan);

    return `${result.label} · ${result.score}/100`;
  }

  protected scanResultSummary(scan: ScanRecord): string {
    return this.scanResult(scan).summary;
  }

  protected scanResultRecommendation(scan: ScanRecord): string {
    return this.scanResult(scan).recommendation;
  }

  protected scanSeverityCount(scan: ScanRecord, severity: string): number {
    return Number(scan.summary?.[severity] ?? 0);
  }

  protected scanSeverityCounts(scan: ScanRecord): { critical: number; high: number; medium: number; low: number } {
    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    if ((scan.findings ?? []).length > 0) {
      for (const finding of scan.findings ?? []) {
        const severity = String(finding['severity'] ?? finding['level'] ?? '').toLowerCase();

        if (severity in counts) {
          counts[severity as keyof typeof counts] += 1;
        }
      }
    } else {
      counts.critical = Number(scan.summary?.['critical'] ?? 0);
      counts.high = Number(scan.summary?.['high'] ?? 0);
      counts.medium = Number(scan.summary?.['medium'] ?? 0);
      counts.low = Number(scan.summary?.['low'] ?? 0);
    }

    return counts;
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

  protected copyText(value: string): void {
    if (!value) {
      return;
    }

    void navigator.clipboard?.writeText(value);
  }

  protected scanFindingSummary(scan: ScanRecord): string {
    const total = this.scanFindingTotal(scan);
    const counts = this.scanSeverityCounts(scan);

    return [
      `${total} finding${total === 1 ? '' : 's'}`,
      counts.critical > 0 ? `${counts.critical} critical` : null,
      counts.high > 0 ? `${counts.high} high` : null,
      counts.medium > 0 ? `${counts.medium} medium` : null,
    ]
      .filter((item): item is string => Boolean(item))
      .join(' · ');
  }

  private calculateScanScore(
    counts: { critical: number; high: number; medium: number; low: number },
    findingTotal: number
  ): number {
    if (findingTotal <= 0) {
      return 100;
    }

    const score = 100 - counts.critical * 35 - counts.high * 20 - counts.medium * 10 - counts.low * 5;

    return Math.max(0, Math.min(100, score));
  }

  private verdictForScore(score: number, findingTotal: number): string {
    if (findingTotal <= 0 || score >= 90) {
      return 'clean';
    }

    if (score >= 70) {
      return 'low-risk';
    }

    if (score >= 40) {
      return 'moderate';
    }

    return 'high-risk';
  }

  private labelForVerdict(verdict: string): string {
    switch (verdict) {
      case 'clean':
        return 'Clean result';
      case 'low-risk':
        return 'Low-risk result';
      case 'moderate':
        return 'Needs review';
      case 'high-risk':
        return 'High-risk result';
      default:
        return 'Security result';
    }
  }

  private resultSummaryFor(
    findingTotal: number,
    counts: { critical: number; high: number; medium: number; low: number },
    verdict: string
  ): string {
    if (findingTotal <= 0) {
      return 'No findings were recorded. Keep the clean baseline for future comparisons.';
    }

    const parts = [`${findingTotal} finding${findingTotal === 1 ? '' : 's'}`];

    for (const [severity, count] of Object.entries(counts)) {
      if (count > 0) {
        parts.push(`${count} ${severity}`);
      }
    }

    return `Detected ${parts.join(' · ')} with a ${verdict} result.`;
  }

  private resultRecommendationFor(verdict: string, findingTotal: number): string {
    if (findingTotal <= 0) {
      return 'No immediate issues were found. Keep the clean result as a baseline and scan again after the next change.';
    }

    switch (verdict) {
      case 'clean':
        return 'Treat this as a clean-ish result and review the report history after the next change.';
      case 'low-risk':
        return 'Review the highlighted items and rerun the scan after the fixes land.';
      case 'moderate':
        return 'Prioritize the findings and verify the risky code paths before shipping.';
      case 'high-risk':
        return 'Address the findings before release and rerun the scan until the score improves.';
      default:
        return 'Review the scan and compare it against the previous baseline.';
    }
  }

  private worstResultSeverity(counts: { critical: number; high: number; medium: number; low: number }): string {
    for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
      if (counts[severity] > 0) {
        return severity;
      }
    }

    return 'none';
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

  protected remediationPrimaryFix(remediation: RemediationRecord): string {
    return remediation.primary_fix.description;
  }

  protected remediationAlternatives(remediation: RemediationRecord): string {
    return remediation.alternatives
      .map((item) => `${item.title}: ${item.description}`)
      .join(' · ');
  }

  protected remediationPrompt(remediation: RemediationRecord): string {
    return remediation.ai_prompt;
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

  protected scanFileCount(scan: ScanRecord): number {
    const summaryCount = Number(scan.summary?.['filesScanned'] ?? 0);
    if (summaryCount > 0) {
      return summaryCount;
    }

    const metadata = scan.metadata as Record<string, unknown>;
    const candidates = ['filesScanned', 'files_scanned', 'changed_files_count', 'filesChanged', 'changedFiles'];

    for (const key of candidates) {
      const value = metadata?.[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
    }

    return 0;
  }

  protected reviewContextSnippet(scan: ScanRecord): string {
    const projectSlug = scan.project?.slug ?? this.selectedProject()?.slug ?? 'unknown-project';
    const repo = (scan.metadata as Record<string, unknown>)?.['repo'];
    const targetPath = (scan.metadata as Record<string, unknown>)?.['target_path'];
    const lines = [
      '@@ review context @@',
      `+ repo: ${typeof repo === 'string' && repo.trim() ? repo : projectSlug}`,
      `+ scan id: #${scan.id}`,
      `+ files reviewed: ${this.scanFileCount(scan)}`,
      `+ deterministic findings: ${this.scanFindingTotal(scan)}`,
      `+ latest scan: ${scan.created_at ? new Date(scan.created_at).toLocaleString() : 'n/a'}`,
    ];

    if (typeof targetPath === 'string' && targetPath.trim()) {
      lines.splice(2, 0, `+ target: ${targetPath}`);
    }

    return lines.join('\n');
  }

  protected aiConfidenceWidth(confidence: string): number {
    const value = confidence.trim().toLowerCase();

    if (value.includes('high')) {
      return 86;
    }

    if (value.includes('medium')) {
      return 72;
    }

    if (value.includes('low')) {
      return 56;
    }

    const numeric = Number.parseFloat(value);
    if (Number.isFinite(numeric)) {
      return Math.max(0, Math.min(100, numeric * 100));
    }

    return 65;
  }

  private async loadDashboard(selectedProjectId: number | null = null): Promise<void> {
    this.loading.set(true);
    this.loadingProject.set(true);
    this.aiSettingsLoading.set(true);
    this.error.set(null);
    this.actionMessage.set(null);

    try {
      const [health, projects, aiSettings] = await Promise.all([
        this.api.getHealth(),
        this.api.listProjects(),
        this.api.getAiSettings(),
      ]);

      this.health.set(health);
      const nextProjects = this.demoProjectEnabled() ? this.injectDemoProject(projects.data) : projects.data;
      this.projects.set(nextProjects);
      this.applyAiSettings(aiSettings);

      const initialProjectId =
        selectedProjectId ?? (this.demoProjectEnabled() ? this.demoProjectId : projects.data[0]?.id ?? null);
      this.selectedProjectId.set(initialProjectId);

      if (initialProjectId === this.demoProjectId && this.demoProjectEnabled()) {
        this.applyDemoProjectState(this.createDemoProjectState());
      } else if (initialProjectId !== null) {
        await this.loadProject(initialProjectId);
      } else {
        this.projectSummary.set(null);
        this.projectScans.set([]);
        this.projectUsageEvents.set([]);
      }

      this.refreshedAt.set(new Date());
    } catch (error) {
      this.error.set(this.toErrorMessage(error));
    } finally {
      this.loading.set(false);
      this.loadingProject.set(false);
      this.aiSettingsLoading.set(false);
    }
  }

  private injectDemoProject(projects: ProjectRecord[]): ProjectRecord[] {
    const demoProject = this.createDemoProjectState().project;
    const merged = projects.filter((project) => project.id !== demoProject.id);

    return [demoProject, ...merged];
  }

  private applyDemoProjectState(state: DemoProjectState): void {
    this.projectSummary.set(state.summary);
    this.projectScans.set(state.scans);
    this.projectUsageEvents.set(state.usages);
    this.aiRemediations.set(null);
    this.aiRemediationsError.set(null);
    this.aiReview.set(state.aiReview);
    this.aiReviewError.set(null);
    this.aiReviewLoading.set(false);
    this.selectedScanId.set(state.scans[0]?.id ?? null);
    this.aiReviewMode.set('ai');
    this.recordAiReviewCall(
      'success',
      `Demo data loaded locally with ${state.aiReview.suggestions.length} suggestions.`,
      state.aiReview.provider,
      state.aiReview.model,
      state.aiReview.scan_id
    );
    this.restoreAiReviewCallStatus();
    this.sidebarSection.set('projects');
  }

  private createDemoProjectState(): DemoProjectState {
    const now = new Date();
    const scanNewestId = 902;
    const scanOlderId = 901;

    const project: ProjectRecord = {
      id: this.demoProjectId,
      name: 'legacy-auth-service',
      slug: 'legacy-auth-service',
      description: 'Local mock project with many findings for report previews.',
      scans_count: 2,
      latest_scan_at: now.toISOString(),
    };

    const newestScan: ScanRecord = {
      id: scanNewestId,
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
      },
      source: 'ppscan',
      language: 'ts',
      fail_on: 'high',
      format: 'json',
      status: 'completed',
      summary: {
        total: 12,
        critical: 2,
        high: 5,
        medium: 3,
        low: 2,
        filesScanned: 24,
      },
      findings: [
        {
          ruleId: 'PP001',
          severity: 'critical',
          file: 'src/config/secrets.ts',
          line: 12,
          title: 'Hardcoded secret',
          description: 'A production token is embedded directly in the source file.',
          recommendation: 'Move the token to a secret manager and rotate the exposed value.',
        },
        {
          ruleId: 'PP002',
          severity: 'high',
          file: 'src/controllers/auth.controller.ts',
          line: 49,
          title: 'Potential SQL injection',
          description: 'User input is concatenated into a SQL fragment.',
          recommendation: 'Use bound parameters or a query builder.',
        },
        {
          ruleId: 'PP003',
          severity: 'medium',
          file: 'src/views/profile.ejs',
          line: 21,
          title: 'Unsafe HTML rendering',
          description: 'Unescaped profile data is rendered into the page.',
          recommendation: 'Escape output or sanitize the content before rendering.',
        },
        {
          ruleId: 'PP004',
          severity: 'high',
          file: 'src/jobs/report-generator.ts',
          line: 77,
          title: 'Dangerous dynamic execution',
          description: 'A command string is evaluated from runtime input.',
          recommendation: 'Replace eval-style execution with a fixed dispatch table.',
        },
        {
          ruleId: 'PP005',
          severity: 'medium',
          file: 'src/middleware/cors.ts',
          line: 18,
          title: 'Permissive CORS configuration',
          description: 'All origins are allowed on the public API route.',
          recommendation: 'Limit origins to the known client apps.',
        },
        {
          ruleId: 'PP002',
          severity: 'high',
          file: 'src/repos/user.repository.ts',
          line: 103,
          title: 'Potential SQL injection',
          description: 'The repository builds a query using direct interpolation.',
          recommendation: 'Pass the values as query parameters.',
        },
        {
          ruleId: 'PP001',
          severity: 'critical',
          file: 'src/config/payment.ts',
          line: 6,
          title: 'Hardcoded secret',
          description: 'A private payment key is checked into source control.',
          recommendation: 'Rotate the key and store it in environment secrets.',
        },
        {
          ruleId: 'PP003',
          severity: 'medium',
          file: 'src/components/admin-panel.ts',
          line: 34,
          title: 'Unsafe HTML rendering',
          description: 'Admin notes are rendered with raw HTML binding.',
          recommendation: 'Sanitize or escape the binding before display.',
        },
        {
          ruleId: 'PP004',
          severity: 'high',
          file: 'src/scripts/migrate.ts',
          line: 14,
          title: 'Dangerous dynamic execution',
          description: 'Migration parameters are passed through exec.',
          recommendation: 'Use explicit functions or structured commands.',
        },
        {
          ruleId: 'PP005',
          severity: 'low',
          file: 'src/server.ts',
          line: 40,
          title: 'Permissive CORS configuration',
          description: 'Development fallback keeps a wildcard origin.',
          recommendation: 'Disable the fallback outside local development.',
        },
        {
          ruleId: 'PP002',
          severity: 'high',
          file: 'src/services/audit.service.ts',
          line: 88,
          title: 'Potential SQL injection',
          description: 'Audit filters are concatenated directly into the WHERE clause.',
          recommendation: 'Use placeholders and a structured filter builder.',
        },
        {
          ruleId: 'PP003',
          severity: 'low',
          file: 'src/templates/email.hbs',
          line: 10,
          title: 'Unsafe HTML rendering',
          description: 'Template content is injected without escaping.',
          recommendation: 'Escape template variables before rendering.',
        },
      ],
      metadata: {
        repo: 'legacy-auth-service',
        target_path: '/Users/juanurquiza/Documents/dev/totsDev/Herald/legacy-auth-service',
      },
      remediations: [],
      report_url: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const olderScan: ScanRecord = {
      id: scanOlderId,
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
      },
      source: 'ppscan',
      language: 'ts',
      fail_on: 'high',
      format: 'json',
      status: 'completed',
      summary: {
        total: 7,
        critical: 1,
        high: 2,
        medium: 3,
        low: 1,
        filesScanned: 18,
      },
      findings: [
        {
          ruleId: 'PP001',
          severity: 'critical',
          file: 'src/auth/session.ts',
          line: 10,
          title: 'Hardcoded secret',
          description: 'Session signing key appears inline in code.',
          recommendation: 'Use environment secrets and rotate the exposed key.',
        },
        {
          ruleId: 'PP002',
          severity: 'high',
          file: 'src/auth/login.ts',
          line: 54,
          title: 'Potential SQL injection',
          description: 'Login lookups interpolate the email filter.',
          recommendation: 'Bind parameters in the query builder.',
        },
        {
          ruleId: 'PP003',
          severity: 'medium',
          file: 'src/pages/account.html',
          line: 19,
          title: 'Unsafe HTML rendering',
          description: 'The account page renders raw status content.',
          recommendation: 'Escape the status text before rendering.',
        },
        {
          ruleId: 'PP004',
          severity: 'high',
          file: 'src/cli/rebuild.ts',
          line: 33,
          title: 'Dangerous dynamic execution',
          description: 'Shell command is built from user input.',
          recommendation: 'Use a safe command runner and argument array.',
        },
        {
          ruleId: 'PP005',
          severity: 'medium',
          file: 'src/app/cors.ts',
          line: 8,
          title: 'Permissive CORS configuration',
          description: 'CORS fallback allows all origins for multiple paths.',
          recommendation: 'Restrict origins to expected clients.',
        },
        {
          ruleId: 'PP003',
          severity: 'medium',
          file: 'src/pages/settings.ts',
          line: 73,
          title: 'Unsafe HTML rendering',
          description: 'Settings markdown is rendered without sanitization.',
          recommendation: 'Sanitize markdown or escape HTML output.',
        },
        {
          ruleId: 'PP005',
          severity: 'low',
          file: 'src/server/config.ts',
          line: 17,
          title: 'Permissive CORS configuration',
          description: 'Development config leaves wildcard access enabled.',
          recommendation: 'Disable the wildcard outside local testing.',
        },
      ],
      metadata: {
        repo: 'legacy-auth-service',
        target_path: '/Users/juanurquiza/Documents/dev/totsDev/Herald/legacy-auth-service',
      },
      remediations: [],
      report_url: null,
      created_at: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
      updated_at: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
    };

    const aiReview: AiReviewResponse = {
      scan_id: newestScan.id,
      source: 'ai',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      summary:
        'This mock review highlights several high-risk auth, injection, and output-escaping paths so the report layout can be previewed with realistic content.',
      confidence_average: '0.82',
      suggestions: [
        {
          title: 'Possible auth bypass',
          severity: 'high',
          confidence: '0.91',
          rationale: 'Authentication responses should be consistent and avoid revealing whether a user exists.',
          recommendation: 'Keep the generic login response and verify timing remains flat.',
          category: 'authentication',
          needs_human_review: true,
        },
        {
          title: 'Input-to-query risk',
          severity: 'high',
          confidence: '0.86',
          rationale: 'Multiple query paths appear to mix filters with string concatenation.',
          recommendation: 'Move every user-controlled value into prepared statements.',
          category: 'data-access',
          needs_human_review: true,
        },
        {
          title: 'Unsafe rendering paths',
          severity: 'medium',
          confidence: '0.79',
          rationale: 'Templated HTML output should be sanitized consistently across pages.',
          recommendation: 'Use an escaping helper or a templating escape pipeline.',
          category: 'output-encoding',
          needs_human_review: true,
        },
      ],
      note: 'Demo data only. Generated locally for report previewing.',
    };

    const usages: UsageEventRecord[] = [
      {
        id: 301,
        project: {
          id: project.id,
          name: project.name,
          slug: project.slug,
        },
        scan_id: newestScan.id,
        kind: 'scan',
        source: 'ppscan',
        language: 'ts',
        fail_on: 'high',
        format: 'json',
        status: 'completed',
        findings_total: 12,
        metadata: {
          target: '/Users/juanurquiza/Documents/dev/totsDev/Herald/legacy-auth-service',
        },
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: 302,
        project: {
          id: project.id,
          name: project.name,
          slug: project.slug,
        },
        scan_id: newestScan.id,
        kind: 'ai',
        source: 'openai',
        language: 'ts',
        fail_on: 'high',
        format: 'json',
        status: 'completed',
        findings_total: 3,
        metadata: {
          provider: aiReview.provider,
          model: aiReview.model,
        },
        created_at: new Date(now.getTime() + 1000 * 18).toISOString(),
        updated_at: new Date(now.getTime() + 1000 * 18).toISOString(),
      },
    ];

    const summary: ProjectSummaryResponse = {
      project,
      totals: {
        scans: 2,
        statuses: {
          completed: 2,
          failed: 0,
          queued: 0,
        },
      },
      breakdowns: {
        languages: [{ language: 'ts', count: 2 }],
        sources: [{ source: 'ppscan', count: 2 }],
        severities: [
          { severity: 'critical', count: 2 },
          { severity: 'high', count: 5 },
          { severity: 'medium', count: 3 },
          { severity: 'low', count: 2 },
        ],
      },
      latest_scan_at: now.toISOString(),
      recent_scans: [newestScan, olderScan],
      recent_usages: usages,
    };

    return {
      project,
      summary,
      scans: [newestScan, olderScan],
      usages,
      aiReview,
    };
  }

  private async loadProject(projectId: number): Promise<void> {
    this.loadingProject.set(true);
    this.error.set(null);

    try {
      const summary = await this.api.getProjectSummary(projectId);

      this.projectSummary.set(summary);
      this.projectScans.set(summary.recent_scans);
      this.projectUsageEvents.set(summary.recent_usages ?? []);
      this.aiRemediations.set(null);
      this.aiRemediationsError.set(null);
      this.aiReview.set(null);
      this.aiReviewError.set(null);
      const preservedScanId = this.selectedScanId();
      const nextSelectedScanId =
        summary.recent_scans.find((scan) => scan.id === preservedScanId)?.id ??
        summary.recent_scans[0]?.id ??
        null;
      this.selectedScanId.set(nextSelectedScanId);
      this.restoreAiReviewCallStatus();

      if (nextSelectedScanId !== null && this.aiReviewMode() === 'ai') {
        await this.generateAiReview();
      }
    } catch (error) {
      this.error.set(this.toErrorMessage(error));
    } finally {
      this.loadingProject.set(false);
    }
  }

  private restoreScanPayloadDraft(): void {
    if (this.scanUploadPayloadDraft().trim().length > 0) {
      return;
    }

    this.loadExampleScanPayload();
  }

  private restoreAiReviewCallStatus(): void {
    const scanId = this.selectedScanId();

    if (scanId === null) {
      this.aiReviewCallStatus.set(null);
      return;
    }

    const stored = window.localStorage.getItem(`patchproof.ai.review.call-status.${scanId}`);

    if (!stored) {
      this.aiReviewCallStatus.set(null);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as AiCallRecord;

      if (
        parsed &&
        typeof parsed.state === 'string' &&
        typeof parsed.at === 'string' &&
        typeof parsed.detail === 'string'
      ) {
        this.aiReviewCallStatus.set(parsed);
        return;
      }
    } catch {
      // ignore malformed cache
    }

    this.aiReviewCallStatus.set(null);
  }

  private recordAiReviewCall(
    state: AiCallState,
    detail: string,
    provider: string,
    model: string,
    scanId: number
  ): void {
    const record: AiCallRecord = {
      state,
      at: new Date().toISOString(),
      detail,
      provider,
      model,
      scanId,
    };

    this.aiReviewCallStatus.set(record);
    window.localStorage.setItem(`patchproof.ai.review.call-status.${scanId}`, JSON.stringify(record));
  }

  private parseScanPayload():
    | {
        source?: string;
        language?: string;
        fail_on?: string;
        format?: string;
        status?: string;
        summary?: Record<string, number>;
        findings?: Record<string, unknown>[];
        metadata?: Record<string, unknown>;
        report_url?: string | null;
      }
    | null {
    try {
      const parsed = JSON.parse(this.scanUploadPayloadDraft());

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }

      return parsed as {
        source?: string;
        language?: string;
        fail_on?: string;
        format?: string;
        status?: string;
        summary?: Record<string, number>;
        findings?: Record<string, unknown>[];
        metadata?: Record<string, unknown>;
        report_url?: string | null;
      };
    } catch {
      return null;
    }
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

  private scrollToElement(id: string): void {
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  private applyAiSettings(settings: AiSettingsResponse): void {
    this.aiSettings.set(settings);
    this.aiEnabledDraft.set(settings.enabled);
    this.aiProviderDraft.set(settings.provider);
    this.aiModelDraft.set(settings.model);
    this.aiBaseUrlDraft.set(settings.base_url || '');
    this.aiApiKeyHint.set(
      settings.api_key_configured
        ? `Stored locally in ${settings.api_key_source === 'database' ? 'PatchProof settings' : '.env'}`
        : 'Leave blank to keep the current saved key.'
    );
  }

  private reportScanFromCurrentSelection(scan: ScanRecord): ReportScan {
    const project = scan.project ?? this.selectedProject();

    return {
      ...scan,
      project: project
        ? {
            id: project.id,
            name: project.name,
            slug: project.slug,
            description:
              'description' in project && typeof project.description === 'string'
                ? project.description
                : null,
          }
        : undefined,
    };
  }

  private downloadReport(fileName: string, content: string, format: ReportFormat): void {
    const mimeType =
      format === 'json'
        ? 'application/json;charset=utf-8'
        : format === 'sarif'
          ? 'application/sarif+json;charset=utf-8'
          : 'text/plain;charset=utf-8';

    const blob = new Blob([content], { type: mimeType });
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
  }
}
