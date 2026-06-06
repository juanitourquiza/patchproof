import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { AuditRule, Severity } from '@patchproof/core';
import type { Language, OutputFormat } from './args.js';
import { formatResult } from './format.js';
import { buildScanPayload, defaultProjectName, defaultProjectSlug, formatHostedResultCard, submitScan, summarizeScan } from './hosted.js';
import { scanWorkspace } from './scan.js';
import { shouldFail } from './threshold.js';

export interface ScanFlowOptions {
  readonly targetPath: string;
  readonly includeIgnored: boolean;
  readonly minimumSeverity: Severity;
  readonly language: Language;
  readonly output: OutputFormat;
  readonly reportPath?: string;
  readonly save: boolean;
  readonly saveProvided: boolean;
  readonly apiBaseUrl: string;
  readonly projectName?: string;
  readonly projectSlug?: string;
  readonly action?: 'local' | 'save' | 'report';
  readonly rules?: readonly AuditRule[];
}

export async function runScanFlow(options: ScanFlowOptions): Promise<number> {
  const targetPath = resolve(options.targetPath);
  const action =
    options.action ??
    (options.saveProvided ? (options.save ? (options.reportPath ? 'report' : 'save') : 'local') : await chooseAction(targetPath, options));
  const result = await scanWorkspace({
    targetPath,
    includeIgnored: options.includeIgnored,
    minimumSeverity: options.minimumSeverity,
    rules: options.rules
  });

  const hostedResult = summarizeScan(result);
  console.log(formatHostedResultCard(hostedResult, options.language));
  console.log('');
  console.log(formatResult(result, options.output, options.language));

  if (action === 'save' || action === 'report') {
    const resolvedProjectName = options.projectName ?? defaultProjectName(targetPath);
    const resolvedProjectSlug = options.projectSlug ?? defaultProjectSlug(resolvedProjectName, targetPath);
    const reportPath = action === 'report'
      ? options.reportPath ?? resolve(targetPath, 'patchproof-report.md')
      : options.reportPath;
    const payload = buildScanPayload({
      targetPath,
      projectName: resolvedProjectName,
      projectSlug: resolvedProjectSlug,
      language: options.language,
      failOn: options.minimumSeverity,
      includeIgnored: options.includeIgnored,
      format: options.output,
      result,
      action,
      reportUrl: reportPath ? `file://${resolve(reportPath)}` : null
    });

    const saved = await submitScan(options.apiBaseUrl, payload);
    const savedProjectName = saved.data.project?.name ?? payload.project_name;
    const savedProjectSlug = saved.data.project?.slug ?? payload.project_slug;
    console.log('');
    console.log(`Saved scan #${saved.data.id} to ${savedProjectName} (${savedProjectSlug}).`);
    console.log(`Dashboard API: ${options.apiBaseUrl.replace(/\/$/, '')}`);
  }

  if (action === 'report') {
    const reportPath = options.reportPath ?? resolve(targetPath, 'patchproof-report.md');
    const report = `${formatResult(result, 'markdown', options.language)}\n`;
    writeFileSync(reportPath, report);
    console.log(`Wrote report to ${reportPath}`);
  }

  return shouldFail(result, options.minimumSeverity) ? 1 : 0;
}

async function chooseAction(targetPath: string, options: ScanFlowOptions): Promise<'local' | 'save' | 'report'> {
  if (!stdin.isTTY) {
    return options.save ? 'save' : 'local';
  }

  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    console.log(`Scanning: ${targetPath}`);
    console.log('What do you want to do?');
    console.log('  1) Scan and show the result only');
    console.log('  2) Scan, show the result, and save it to the dashboard');
    console.log('  3) Scan, save it, and export a Markdown report');

    while (true) {
      const answer = (await prompt.question('Choose 1, 2, or 3: ')).trim();
      if (answer === '1') {
        return 'local';
      }
      if (answer === '2') {
        return 'save';
      }
      if (answer === '3') {
        return 'report';
      }
      console.log('Please enter 1, 2, or 3.');
    }
  } finally {
    prompt.close();
  }
}
