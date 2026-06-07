import { jsPDF } from 'jspdf';

export type ReportFormat = 'markdown' | 'json' | 'sarif' | 'text';
export type ReportDownloadFormat = ReportFormat | 'pdf';

export interface ReportProject {
  id?: number;
  name: string;
  slug: string;
  description?: string | null;
}

export interface ReportScan {
  id: number;
  project?: ReportProject;
  source: string;
  language: string;
  fail_on: string;
  format: string;
  status: string;
  summary: Record<string, number>;
  findings: Array<Record<string, unknown>>;
  result?: ReportScanResult;
  metadata: Record<string, unknown>;
  report_url: string | null;
  created_at: string | null;
  updated_at?: string | null;
}

interface ReportScanResult {
  score: number;
  verdict: string;
  label: string;
  summary: string;
  recommendation: string;
  finding_total: number;
  severity: string;
}

interface ReportFinding {
  severity: string;
  ruleId: string;
  file: string;
  line: string | number | null;
  title: string;
  description: string;
  recommendation: string;
}

interface ReportSummary {
  total: number;
  files: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ReportAiSuggestion {
  title: string;
  severity: string;
  confidence: string;
  rationale: string;
  recommendation: string;
  category: string;
  needs_human_review: boolean;
}

export interface ReportAiReview {
  scan_id: number;
  source: string;
  provider: string;
  model: string;
  summary: string;
  confidence_average: string;
  suggestions: ReportAiSuggestion[];
  note?: string;
}

interface NormalizedAiReview {
  scan_id: number;
  source: string;
  provider: string;
  model: string;
  summary: string;
  confidence_average: string;
  suggestions: ReportAiSuggestion[];
  note?: string;
}

export function formatScanReport(
  scan: ReportScan,
  format: ReportFormat,
  language: 'en' | 'es' = 'en',
  aiReview?: ReportAiReview | null
): string {
  const findings = normalizeFindings(scan.findings);
  const summary = summarizeScan(scan, findings.length);
  const normalizedAiReview = normalizeAiReview(aiReview);
  const normalizedResult = normalizeScanResult(scan, findings, summary);
  const overview = buildReportOverview(scan, summary, normalizedAiReview, findings);

  if (format === 'json') {
    return JSON.stringify(
      {
        summary,
        scan: {
          id: scan.id,
          project: scan.project ?? null,
          source: scan.source,
          language: scan.language,
          fail_on: scan.fail_on,
          format: scan.format,
          status: scan.status,
          report_url: scan.report_url,
          created_at: scan.created_at,
          updated_at: scan.updated_at ?? null,
          metadata: scan.metadata,
        },
        result: normalizedResult,
        findings,
        ai_review: normalizedAiReview,
      },
      null,
      2
    );
  }

  if (format === 'sarif') {
    return JSON.stringify(formatSarif(findings), null, 2);
  }

  if (format === 'text') {
    return formatText(summary, findings, language, normalizedAiReview, overview);
  }

  return formatMarkdown(summary, findings, scan, language, normalizedAiReview, overview);
}

export function defaultReportFileName(scan: Pick<ReportScan, 'id' | 'project'>, format: ReportDownloadFormat): string {
  const extension = format === 'markdown' ? 'md' : format === 'text' ? 'txt' : format;
  const projectName = sanitizeFilePart(scan.project?.slug ?? `scan-${scan.id}`);

  return `patchproof-${projectName}-report.${extension}`;
}

export function saveScanReportPdf(
  scan: ReportScan,
  fileName: string,
  language: 'en' | 'es' = 'en',
  aiReview?: ReportAiReview | null
): void {
  const findings = normalizeFindings(scan.findings);
  const summary = summarizeScan(scan, findings.length);
  const normalizedAiReview = normalizeAiReview(aiReview);
  const overview = buildReportOverview(scan, summary, normalizedAiReview, findings);
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const addWrappedLines = (text: string, fontSize = 11, bold = false, lineGap = 6): void => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, maxWidth) as string[];

    for (const line of lines) {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }

      pdf.text(line, margin, y);
      y += fontSize + lineGap;
    }
  };

  const addSectionTitle = (title: string): void => {
    y += 8;
    addWrappedLines(title, 14, true, 4);
    y += 2;
  };

  addWrappedLines('PatchProof Report', 20, true, 8);
  addWrappedLines('Local scan review report', 13, false, 8);
  addWrappedLines(`Project: ${overview.projectLine}`, 12, false, 4);
  addWrappedLines(`Generated: ${overview.generatedAt}`, 12, false, 4);
  addWrappedLines(`Report scope: ${overview.scopeLine}`, 12, false, 4);

  addSectionTitle('Executive summary');
  addWrappedLines(`Scan ID: #${scan.id}`, 12, false, 4);
  addWrappedLines(`Source: ${scan.source} · Language: ${scan.language} · Format: ${scan.format}`, 12, false, 4);
  addWrappedLines(`Status: ${scan.status} · Report URL: ${scan.report_url || 'n/a'}`, 12, false, 4);
  addWrappedLines(`Files reviewed: ${summary.files}`, 12, false, 4);
  addWrappedLines(`Deterministic findings: ${summary.total}`, 12, false, 4);
  addWrappedLines(`Security score: ${overview.resultScore}/100`, 12, false, 4);
  addWrappedLines(`Result: ${overview.resultLabel}`, 12, false, 4);
  addWrappedLines(`Result summary: ${overview.resultSummary}`, 12, false, 4);
  addWrappedLines(`AI suggestions: ${overview.aiSuggestionCount}`, 12, false, 4);
  addWrappedLines(`Risk posture: ${overview.riskPosture}`, 12, false, 4);
  addWrappedLines(`Recommendation: ${overview.recommendation}`, 12, false, 4);

  addSectionTitle('Index');
  for (const entry of overview.indexEntries) {
    addWrappedLines(`${entry.number}. ${entry.title}`, 12, false, 4);
  }

  addSectionTitle('Deterministic scan');
  if (findings.length === 0) {
    addWrappedLines(copyText[language].noFindings, 12, true, 4);
  } else {
    addWrappedLines(`Findings: ${findings.length}`, 12, true, 4);
    for (const finding of findings) {
      addWrappedLines(`[${finding.severity.toUpperCase()}] ${finding.ruleId} ${finding.title}`, 12, true, 4);
      addWrappedLines(`${finding.file}${finding.line ? `:${finding.line}` : ''}`, 11, false, 4);
      addWrappedLines(finding.description, 11, false, 4);
      addWrappedLines(`Fix: ${finding.recommendation}`, 11, false, 4);
      y += 8;
    }
  }

  addSectionTitle('AI review');
  if (!normalizedAiReview) {
    addWrappedLines('No AI review has been generated yet.', 12, false, 4);
    pdf.save(fileName);
    return;
  }

  addWrappedLines(`Source: ${normalizedAiReview.source} · Provider: ${normalizedAiReview.provider} · Model: ${normalizedAiReview.model}`, 12, false, 4);
  addWrappedLines(`Summary: ${normalizedAiReview.summary}`, 12, false, 4);
  addWrappedLines(`Confidence average: ${normalizedAiReview.confidence_average}`, 12, false, 4);
  if (normalizedAiReview.note) {
    addWrappedLines(`Note: ${normalizedAiReview.note}`, 12, false, 4);
  }

  if (normalizedAiReview.suggestions.length === 0) {
    addWrappedLines('No AI suggestions returned.', 12, true, 4);
    pdf.save(fileName);
    return;
  }

  addWrappedLines(`Suggestions: ${normalizedAiReview.suggestions.length}`, 12, true, 4);
  for (const suggestion of normalizedAiReview.suggestions) {
    addWrappedLines(`[${suggestion.severity}] ${suggestion.title}`, 12, true, 4);
    addWrappedLines(`Category: ${suggestion.category} · Confidence: ${suggestion.confidence}`, 11, false, 4);
    addWrappedLines(`Rationale: ${suggestion.rationale}`, 11, false, 4);
    addWrappedLines(`Recommendation: ${suggestion.recommendation}`, 11, false, 4);
    addWrappedLines(`Needs human review: ${suggestion.needs_human_review ? 'yes' : 'no'}`, 11, false, 4);
    y += 8;
  }

  pdf.save(fileName);
}

function formatText(
  summary: ReportSummary,
  findings: ReportFinding[],
  language: 'en' | 'es',
  aiReview: NormalizedAiReview | null,
  overview: {
    resultScore: number;
    resultLabel: string;
    resultSummary: string;
    aiSuggestionCount: number;
    riskPosture: string;
    recommendation: string;
  }
): string {
  const copy = copyText[language];
  const lines = [
    copy.heading,
    copy.summary(summary.total, summary.files),
    copy.severity(summary.critical, summary.high, summary.medium, summary.low),
    `Security score: ${overview.resultScore}/100`,
    `Result: ${overview.resultLabel}`,
    `Result summary: ${overview.resultSummary}`,
    `AI suggestions: ${overview.aiSuggestionCount}`,
    `Risk posture: ${overview.riskPosture}`,
    `Recommendation: ${overview.recommendation}`,
  ];

  if (findings.length === 0) {
    lines.push('');
    lines.push(copy.noFindings);
    return lines.join('\n');
  }

  for (const finding of findings) {
    lines.push('');
    lines.push(`[${finding.severity.toUpperCase()}] ${finding.ruleId} ${finding.title}`);
    lines.push(`  ${finding.file}${finding.line ? `:${finding.line}` : ''}`);
    lines.push(`  ${finding.description}`);
    lines.push(`  ${copy.fix}: ${finding.recommendation}`);
  }

  lines.push('');
  lines.push('AI review');
  if (!aiReview) {
    lines.push('  No AI review has been generated yet.');
    return lines.join('\n');
  }

  lines.push(`  Source: ${aiReview.source}`);
  lines.push(`  Provider: ${aiReview.provider}`);
  lines.push(`  Model: ${aiReview.model}`);
  lines.push(`  Summary: ${aiReview.summary}`);
  lines.push(`  Confidence average: ${aiReview.confidence_average}`);

  if (aiReview.note) {
    lines.push(`  Note: ${aiReview.note}`);
  }

  if (aiReview.suggestions.length === 0) {
    lines.push('  No AI suggestions returned.');
    return lines.join('\n');
  }

  lines.push(`  Suggestions: ${aiReview.suggestions.length}`);
  for (const suggestion of aiReview.suggestions) {
    lines.push('');
    lines.push(`  [${suggestion.severity}] ${suggestion.title}`);
    lines.push(`    Category: ${suggestion.category}`);
    lines.push(`    Confidence: ${suggestion.confidence}`);
    lines.push(`    Rationale: ${suggestion.rationale}`);
    lines.push(`    Recommendation: ${suggestion.recommendation}`);
  }

  return lines.join('\n');
}

function formatMarkdown(
  summary: ReportSummary,
  findings: ReportFinding[],
  scan: ReportScan,
  language: 'en' | 'es',
  aiReview: NormalizedAiReview | null,
  overview: {
    projectLine: string;
    generatedAt: string;
    scopeLine: string;
    aiSuggestionCount: number;
    riskPosture: string;
    recommendation: string;
    resultScore: number;
    resultLabel: string;
    resultSummary: string;
    coverLine: string;
    indexEntries: Array<{ number: number; title: string; anchor: string }>;
  }
): string {
  const copy = copyText[language];
  const lines = [copy.heading, '', '## Executive summary', ''];

  lines.push(`- Project: ${overview.projectLine}`);
  lines.push(`- Generated: ${overview.generatedAt}`);
  lines.push(`- Report scope: ${overview.scopeLine}`);
  lines.push(`- Scan ID: #${scan.id}`);
  lines.push(`- Source: ${scan.source}`);
  lines.push(`- Language: ${scan.language}`);
  lines.push(`- Format: ${scan.format}`);
  lines.push(`- Status: ${scan.status}`);
  lines.push(`- Files reviewed: ${summary.files}`);
  lines.push(`- Deterministic findings: ${summary.total}`);
  lines.push(`- Security score: ${overview.resultScore}/100`);
  lines.push(`- Result: ${overview.resultLabel}`);
  lines.push(`- Result summary: ${overview.resultSummary}`);
  lines.push(`- AI suggestions: ${overview.aiSuggestionCount}`);
  lines.push(`- Risk posture: ${overview.riskPosture}`);
  lines.push(`- Recommendation: ${overview.recommendation}`);

  lines.push('');
  lines.push('## Index');
  lines.push('');
  for (const entry of overview.indexEntries) {
    lines.push(`${entry.number}. [${entry.title}](#${entry.anchor})`);
  }

  lines.push('');
  lines.push('## Cover');
  lines.push(`> ${overview.coverLine}`);
  lines.push('');
  lines.push(copy.summaryMarkdown(summary.total, summary.files));
  lines.push('');
  lines.push(copy.severity(summary.critical, summary.high, summary.medium, summary.low));

  lines.push('');
  lines.push('## Deterministic scan');
  lines.push(`- Project: ${scan.project?.name ?? 'Unknown project'} (${scan.project?.slug ?? 'unknown'})`);
  lines.push(`- Scan ID: #${scan.id}`);
  lines.push(`- Source: ${scan.source}`);
  lines.push(`- Language: ${scan.language}`);
  lines.push(`- Format: ${scan.format}`);
  lines.push(`- Status: ${scan.status}`);
  lines.push(`- Report URL: ${scan.report_url || 'n/a'}`);

  if (findings.length === 0) {
    lines.push('');
    lines.push(`> ${copy.noFindings}`);
  } else {
    lines.push('');
    lines.push(copy.tableHeader);
    lines.push('|---|---|---|---|---|');

    for (const finding of findings) {
      lines.push(
        `| ${finding.severity} | ${finding.ruleId} | ${escapePipe(`${finding.file}${finding.line ? `:${finding.line}` : ''}`)} | ${escapePipe(
          finding.title
        )} | ${escapePipe(finding.recommendation)} |`
      );
    }
  }

  lines.push('');
  lines.push('## AI review');

  if (!aiReview) {
    lines.push('> No AI review has been generated yet.');
    return lines.join('\n');
  }

  lines.push(`- Source: ${aiReview.source}`);
  lines.push(`- Provider: ${aiReview.provider}`);
  lines.push(`- Model: ${aiReview.model}`);
  lines.push(`- Summary: ${aiReview.summary}`);
  lines.push(`- Confidence average: ${aiReview.confidence_average}`);

  if (aiReview.note) {
    lines.push(`- Note: ${aiReview.note}`);
  }

  if (aiReview.suggestions.length === 0) {
    lines.push('');
    lines.push('> No AI suggestions returned.');
    return lines.join('\n');
  }

  lines.push('');
  lines.push('| Severity | Title | Category | Confidence | Recommendation |');
  lines.push('|---|---|---|---|---|');

  for (const suggestion of aiReview.suggestions) {
    lines.push(
      `| ${suggestion.severity} | ${escapePipe(suggestion.title)} | ${escapePipe(suggestion.category)} | ${escapePipe(
        suggestion.confidence
      )} | ${escapePipe(suggestion.recommendation)} |`
    );
  }

  return lines.join('\n');
}

function buildReportOverview(
  scan: ReportScan,
  summary: ReportSummary,
  aiReview: NormalizedAiReview | null,
  findings: ReportFinding[]
): {
  projectLine: string;
  generatedAt: string;
  scopeLine: string;
  aiSuggestionCount: number;
  riskPosture: string;
  recommendation: string;
  resultScore: number;
  resultLabel: string;
  resultSummary: string;
  coverLine: string;
  indexEntries: Array<{ number: number; title: string; anchor: string }>;
} {
  const projectName = scan.project?.name ?? 'Unknown project';
  const projectSlug = scan.project?.slug ?? 'unknown';
  const generatedAt = formatDateTime(scan.updated_at ?? scan.created_at ?? null);
  const aiSuggestionCount = aiReview?.suggestions?.length ?? 0;
  const scanResult = normalizeScanResult(scan, findings, summary);
  const riskPosture = determineRiskPosture(summary.total, aiSuggestionCount);
  const recommendation = determineRecommendation(summary.total, aiSuggestionCount, aiReview);

  return {
    projectLine: `${projectName} (${projectSlug})`,
    generatedAt,
    scopeLine: `${summary.files} file(s) reviewed · ${summary.total} deterministic finding(s) · ${aiSuggestionCount} AI suggestion(s)`,
    aiSuggestionCount,
    riskPosture,
    recommendation,
    resultScore: scanResult.score,
    resultLabel: scanResult.label,
    resultSummary: scanResult.summary,
    coverLine: `${projectName} · ${projectSlug} · scan #${scan.id} · generated ${generatedAt}`,
    indexEntries: [
      { number: 1, title: 'Executive summary', anchor: 'executive-summary' },
      { number: 2, title: 'Cover', anchor: 'cover' },
      { number: 3, title: 'Deterministic scan', anchor: 'deterministic-scan' },
      { number: 4, title: 'AI review', anchor: 'ai-review' },
    ],
  };
}

function normalizeScanResult(
  scan: ReportScan,
  findings: ReportFinding[],
  summary: ReportSummary
): ReportScanResult {
  if (scan.result) {
    return scan.result;
  }

  const counts = collectSeverityCounts(scan, findings, summary);
  const findingTotal = Math.max(
    findings.length,
    summary.total,
    Number(scan.summary?.['total'] ?? scan.summary?.['findings'] ?? scan.summary?.['findings_total'] ?? 0),
    counts.critical + counts.high + counts.medium + counts.low
  );

  const score = calculateScanScore(counts, findingTotal);
  const verdict = verdictForScore(score, findingTotal);

  return {
    score,
    verdict,
    label: labelForVerdict(verdict),
    summary: summaryForResult(findingTotal, counts, verdict),
    recommendation: recommendationForResult(verdict, findingTotal),
    finding_total: findingTotal,
    severity: worstSeverity(counts),
  };
}

function collectSeverityCounts(
  scan: ReportScan,
  findings: ReportFinding[],
  summary: ReportSummary
): { critical: number; high: number; medium: number; low: number } {
  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  if (findings.length > 0) {
    for (const finding of findings) {
      const severity = String(finding.severity ?? '').toLowerCase();

      if (severity in counts) {
        counts[severity as keyof typeof counts] += 1;
      }
    }
  } else {
    counts.critical = Number(scan.summary?.['critical'] ?? summary.critical ?? 0);
    counts.high = Number(scan.summary?.['high'] ?? summary.high ?? 0);
    counts.medium = Number(scan.summary?.['medium'] ?? summary.medium ?? 0);
    counts.low = Number(scan.summary?.['low'] ?? summary.low ?? 0);
  }

  return counts;
}

function calculateScanScore(
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
  if (findingTotal <= 0 || score >= 90) {
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

function summaryForResult(
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

function recommendationForResult(verdict: string, findingTotal: number): string {
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
  for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
    if (counts[severity] > 0) {
      return severity;
    }
  }

  return 'none';
}

function determineRiskPosture(deterministicFindings: number, aiSuggestionCount: number): string {
  if (deterministicFindings > 0) {
    if (deterministicFindings >= 10) {
      return 'High';
    }

    return 'Elevated';
  }

  if (aiSuggestionCount > 0) {
    return 'Review advised';
  }

  return 'Low';
}

function determineRecommendation(
  deterministicFindings: number,
  aiSuggestionCount: number,
  aiReview: NormalizedAiReview | null
): string {
  if (deterministicFindings > 0) {
    return 'Review deterministic findings first and export the report for tracking.';
  }

  if (aiSuggestionCount > 0) {
    return 'Review AI suggestions and validate the highlighted code paths manually.';
  }

  if (aiReview) {
    return 'No immediate issues were found. Keep the scan history for future comparison.';
  }

  return 'Generate an AI review if you want advisory guidance alongside the deterministic scan.';
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'n/a';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function formatSarif(findings: ReportFinding[]): unknown {
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'PatchProof',
            rules: uniqueRules(findings),
          },
        },
        results: findings.map((finding) => ({
          ruleId: finding.ruleId,
          level: sarifLevel(finding.severity),
          message: {
            text: `${finding.title}: ${finding.recommendation}`,
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: finding.file,
                },
                region: finding.line ? { startLine: Number(finding.line) } : undefined,
              },
            },
          ],
        })),
      },
    ],
  };
}

function uniqueRules(findings: ReportFinding[]): unknown[] {
  const rules = new Map<string, ReportFinding>();
  for (const finding of findings) {
    rules.set(finding.ruleId, finding);
  }

  return [...rules.values()].map((finding) => ({
    id: finding.ruleId,
    name: finding.title,
    shortDescription: {
      text: finding.title,
    },
    fullDescription: {
      text: finding.description,
    },
    help: {
      text: finding.recommendation,
    },
  }));
}

function sarifLevel(severity: string): 'error' | 'warning' | 'note' {
  if (severity === 'critical' || severity === 'high') {
    return 'error';
  }

  if (severity === 'medium') {
    return 'warning';
  }

  return 'note';
}

function normalizeFindings(findings: Array<Record<string, unknown>>): ReportFinding[] {
  return findings.map((finding, index) => ({
    severity: textValue(finding, ['severity', 'level']) || 'low',
    ruleId: textValue(finding, ['ruleId', 'rule_id']) || `F${index + 1}`,
    file: textValue(finding, ['file', 'path', 'location']) || 'unknown',
    line: numberOrTextValue(finding, ['line', 'line_number']),
    title: textValue(finding, ['title', 'message', 'name', 'description']) || 'Finding',
    description: textValue(finding, ['description', 'details', 'message']) || 'No description provided.',
    recommendation: textValue(finding, ['recommendation', 'fix', 'suggestion']) || 'Review manually.',
  }));
}

function normalizeAiReview(aiReview?: ReportAiReview | null): NormalizedAiReview | null {
  if (!aiReview) {
    return null;
  }

  return {
    scan_id: aiReview.scan_id,
    source: aiReview.source,
    provider: aiReview.provider,
    model: aiReview.model,
    summary: aiReview.summary,
    confidence_average: aiReview.confidence_average,
    suggestions: Array.isArray(aiReview.suggestions) ? aiReview.suggestions : [],
    note: aiReview.note,
  };
}

function summarizeScan(scan: ReportScan, findingCount: number): ReportSummary {
  const summary = scan.summary ?? {};
  const total = Number(
    summary['total'] ?? summary['findings'] ?? summary['findings_total'] ?? findingCount ?? 0
  );
  const files = Number(
    summary['filesScanned'] ?? summary['files_scanned'] ?? scan.metadata['filesScanned'] ?? 0
  );

  return {
    total,
    files: files > 0 ? files : findingCount > 0 ? 1 : 0,
    critical: Number(summary['critical'] ?? 0),
    high: Number(summary['high'] ?? 0),
    medium: Number(summary['medium'] ?? 0),
    low: Number(summary['low'] ?? 0),
  };
}

function textValue(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return '';
}

function numberOrTextValue(record: Record<string, unknown>, keys: string[]): string | number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function escapePipe(value: string): string {
  return value.replaceAll('|', '\\|');
}

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'report';
}

const copyText: Record<'en' | 'es', {
  heading: string;
  summary(total: number, files: number): string;
  summaryMarkdown(total: number, files: number): string;
  severity(critical: number, high: number, medium: number, low: number): string;
  noFindings: string;
  fix: string;
  tableHeader: string;
}> = {
  en: {
    heading: '# PatchProof Report',
    summary: (total, files) => `PatchProof found ${total} finding(s) across ${files} file(s).`,
    summaryMarkdown: (total, files) => `Found **${total}** finding(s) across **${files}** file(s).`,
    severity: (critical, high, medium, low) =>
      `Severity: ${critical} critical, ${high} high, ${medium} medium, ${low} low`,
    noFindings: 'No findings found.',
    fix: 'Fix',
    tableHeader: '| Severity | Rule | Location | Finding | Recommendation |',
  },
  es: {
    heading: '# Informe PatchProof',
    summary: (total, files) => `PatchProof encontró ${total} hallazgo(s) en ${files} archivo(s).`,
    summaryMarkdown: (total, files) => `Se encontraron **${total}** hallazgo(s) en **${files}** archivo(s).`,
    severity: (critical, high, medium, low) =>
      `Severidad: ${critical} crítico(s), ${high} alto(s), ${medium} medio(s), ${low} bajo(s)`,
    noFindings: 'No se encontraron hallazgos.',
    fix: 'Corrección',
    tableHeader: '| Severidad | Regla | Ubicación | Hallazgo | Recomendación |',
  },
};
