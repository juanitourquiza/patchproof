import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import type { AuditResult, Finding } from '@patchproof/core';
import type { Language, OutputFormat } from './args.js';

export interface HostedScanResult {
  readonly score: number;
  readonly verdict: string;
  readonly label: string;
  readonly summary: string;
  readonly recommendation: string;
  readonly formula: string;
  readonly finding_total: number;
  readonly severity: string;
}

export interface SaveScanPayload {
  readonly project_name: string;
  readonly project_slug: string;
  readonly source: string;
  readonly language: Language;
  readonly fail_on: 'critical' | 'high' | 'medium' | 'low';
  readonly format: OutputFormat;
  readonly status: 'queued' | 'completed' | 'failed';
  readonly summary: Record<string, number>;
  readonly findings: ReadonlyArray<Record<string, unknown>>;
  readonly metadata: Record<string, unknown>;
  readonly report_url?: string | null;
}

export interface SavedScanResponse {
  readonly data: {
    readonly id: number;
    readonly project?: {
      readonly id: number;
      readonly name: string;
      readonly slug: string;
    };
    readonly result?: HostedScanResult;
  };
}

export function defaultProjectName(targetPath: string): string {
  const resolved = resolve(targetPath);
  return basename(resolved) || 'patchproof-project';
}

export function defaultProjectSlug(projectName: string, targetPath?: string): string {
  const slug = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    return 'patchproof-project';
  }

  if (!targetPath) {
    return slug;
  }

  const suffix = createHash('sha1').update(resolve(targetPath)).digest('hex').slice(0, 6);
  return `${slug}-${suffix}`;
}

export function summarizeScan(result: AuditResult): HostedScanResult {
  const counts = countSeverities(result.findings);
  const findingTotal = Math.max(
    counts.critical + counts.high + counts.medium + counts.low,
    Number(result.summary.total ?? 0),
    result.findings.length
  );
  const score = calculateScore(counts, findingTotal);
  const verdict = verdictForScore(score, findingTotal);
  const severity = worstSeverity(counts);

  return {
    score,
    verdict,
    label: labelForVerdict(verdict),
    summary: summaryFor(findingTotal, severity, counts),
    recommendation: recommendationFor(verdict, findingTotal),
    formula: scoreFormula(),
    finding_total: findingTotal,
    severity
  };
}

export function buildScanPayload(options: {
  readonly targetPath: string;
  readonly projectName?: string;
  readonly projectSlug?: string;
  readonly language: Language;
  readonly failOn: 'critical' | 'high' | 'medium' | 'low';
  readonly includeIgnored: boolean;
  readonly format: OutputFormat;
  readonly result: AuditResult;
  readonly source?: string;
  readonly reportUrl?: string | null;
  readonly action?: string;
}): SaveScanPayload {
  const projectName = options.projectName?.trim() || defaultProjectName(options.targetPath);
  const projectSlug = options.projectSlug?.trim() || defaultProjectSlug(projectName, options.targetPath);

  return {
    project_name: projectName,
    project_slug: projectSlug,
    source: options.source ?? 'cli',
    language: options.language,
    fail_on: options.failOn,
    format: options.format,
    status: 'completed',
    summary: normalizeSummary(options.result),
    findings: options.result.findings as unknown as ReadonlyArray<Record<string, unknown>>,
    metadata: {
      target_path: resolve(options.targetPath),
      repo_name: projectName,
      repo_slug: projectSlug,
      include_ignored: options.includeIgnored,
      action: options.action ?? 'interactive-scan'
    },
    report_url: options.reportUrl ?? null
  };
}

export async function submitScan(baseUrl: string, payload: SaveScanPayload): Promise<SavedScanResponse> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/scans`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`Failed to save scan (${response.status} ${response.statusText}): ${body}`);
  }

  return (await response.json()) as SavedScanResponse;
}

export function formatHostedResultCard(result: HostedScanResult, lang: Language): string {
  const text = hostedCopy[lang];
  return [
    `╭─ ${text.heading}`,
    `│ ${text.score}: ${result.score}/100`,
    `│ ${text.verdict}: ${result.verdict}`,
    `│ ${text.label}: ${result.label}`,
    `│ ${text.summary}: ${result.summary}`,
    `│ ${text.recommendation}: ${result.recommendation}`,
    `│ ${text.formula}: ${result.formula}`,
    '╰────────────────────────────────────'
  ].join('\n');
}

function normalizeSummary(result: AuditResult): Record<string, number> {
  return {
    total: Number(result.summary.total ?? result.findings.length),
    critical: countSeverity(result.findings, 'critical'),
    high: countSeverity(result.findings, 'high'),
    medium: countSeverity(result.findings, 'medium'),
    low: countSeverity(result.findings, 'low')
  };
}

function countSeverities(findings: readonly Finding[]): { critical: number; high: number; medium: number; low: number } {
  return {
    critical: countSeverity(findings, 'critical'),
    high: countSeverity(findings, 'high'),
    medium: countSeverity(findings, 'medium'),
    low: countSeverity(findings, 'low')
  };
}

function countSeverity(findings: readonly Finding[], severity: 'critical' | 'high' | 'medium' | 'low'): number {
  return findings.filter((finding) => finding.severity === severity).length;
}

function calculateScore(
  counts: { critical: number; high: number; medium: number; low: number },
  findingTotal: number
): number {
  if (findingTotal <= 0) {
    return 100;
  }

  const score = 100 - counts.critical * 25 - counts.high * 15 - counts.medium * 8 - counts.low * 3;
  return Math.max(10, Math.min(100, score));
}

function verdictForScore(score: number, findingTotal: number): string {
  if (findingTotal === 0) {
    return 'clean';
  }

  if (score >= 90) {
    return 'clean';
  }

  if (score >= 75) {
    return 'low-risk';
  }

  if (score >= 50) {
    return 'moderate';
  }

  return 'high-risk';
}

function labelForVerdict(verdict: string): string {
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

function summaryFor(
  findingTotal: number,
  severity: string,
  counts: { critical: number; high: number; medium: number; low: number }
): string {
  if (findingTotal <= 0) {
    return 'No findings were recorded. Keep the clean baseline for future comparisons.';
  }

  const parts = [`${findingTotal} finding${findingTotal === 1 ? '' : 's'}`];
  for (const bucket of ['critical', 'high', 'medium', 'low'] as const) {
    if (counts[bucket] > 0) {
      parts.push(`${counts[bucket]} ${bucket}`);
    }
  }

  return `Detected ${parts.join(' · ')} with a worst severity of ${severity}.`;
}

function recommendationFor(verdict: string, findingTotal: number): string {
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

function worstSeverity(counts: { critical: number; high: number; medium: number; low: number }): string {
  for (const bucket of ['critical', 'high', 'medium', 'low'] as const) {
    if (counts[bucket] > 0) {
      return bucket;
    }
  }

  return 'none';
}

function scoreFormula(): string {
  return 'Score formula: 100 - (critical × 25) - (high × 15) - (medium × 8) - (low × 3), with a minimum floor of 10.';
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.trim() || response.statusText;
  } catch {
    return response.statusText;
  }
}

const hostedCopy: Record<Language, {
  readonly heading: string;
  readonly score: string;
  readonly verdict: string;
  readonly label: string;
  readonly summary: string;
  readonly recommendation: string;
  readonly formula: string;
}> = {
  en: {
    heading: 'Scan result',
    score: 'Score',
    verdict: 'Verdict',
    label: 'Label',
    summary: 'Summary',
    recommendation: 'Recommendation',
    formula: 'Formula'
  },
  es: {
    heading: 'Resultado del scan',
    score: 'Puntuación',
    verdict: 'Veredicto',
    label: 'Etiqueta',
    summary: 'Resumen',
    recommendation: 'Recomendación',
    formula: 'Fórmula'
  }
};
