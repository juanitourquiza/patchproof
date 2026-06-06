#!/usr/bin/env node
import { auditDiff, builtInRules } from '@patchproof/core';
import { writeFileSync } from 'node:fs';
import { parseArgs } from './args.js';
import { loadConfig, resolveAuditRules, resolveFailOn, resolveLanguage } from './config.js';
import { formatResult, formatRules } from './format.js';
import { helpText, initConfigText } from './help.js';
import { readDiffInput } from './input.js';
import { runScanFlow } from './interactive.js';
import { scanWorkspace } from './scan.js';
import { shouldFail } from './threshold.js';

export async function main(argv = process.argv.slice(2), runtimeName = process.argv[1] ?? ''): Promise<number> {
  try {
    const options = parseArgs(argv, runtimeName);
    const { config } = loadConfig();

    if (options.command === 'help') {
      console.log(helpText());
      return 0;
    }

    if (options.command === 'version') {
      console.log('0.3.0');
      return 0;
    }

    if (options.command === 'rules') {
      console.log(formatRules(resolveAuditRules(builtInRules, config)));
      return 0;
    }

    if (options.command === 'init') {
      writeFileSync('patchproof.config.json', `${initConfigText()}\n`, { flag: 'wx' });
      console.log('Created patchproof.config.json');
      return 0;
    }

    if (options.command === 'ppscan') {
      const failOn = resolveFailOn(options.failOn, config);
      const result = await scanWorkspace({
        targetPath: options.targetPath ?? process.cwd(),
        includeIgnored: options.includeIgnored,
        minimumSeverity: failOn,
        rules: resolveAuditRules(builtInRules, config)
      });
      const lang = resolveLanguage(options.lang, config);
      const output = options.outputProvided ? options.output ?? 'text' : 'text';
      const formatted = formatResult(result, output, lang);
      console.log(formatted);

      if (options.reportProvided && options.report) {
        writeFileSync(options.report, `${formatted}\n`);
        console.log(`Wrote report to ${options.report}`);
      }

      return shouldFail(result, failOn) ? 1 : 0;
    }

    if (options.command === 'scan') {
      const failOn = resolveFailOn(options.failOn, config);
      const lang = resolveLanguage(options.lang, config);
      const output = options.outputProvided ? options.output ?? 'text' : 'text';
      const apiBaseUrl = options.apiBaseUrl ?? process.env.PATCHPROOF_API_BASE_URL ?? 'http://127.0.0.1:8000/api';

      return await runScanFlow({
        targetPath: options.targetPath ?? process.cwd(),
        includeIgnored: options.includeIgnored,
        minimumSeverity: failOn,
        language: lang,
        output,
        reportPath: options.report,
        save: options.save,
        saveProvided: options.saveProvided,
        apiBaseUrl,
        projectName: options.projectName,
        projectSlug: options.projectSlug,
        rules: resolveAuditRules(builtInRules, config)
      });
    }

    if (options.command === 'report') {
      const failOn = resolveFailOn(options.failOn, config);
      const result = await scanWorkspace({
        targetPath: options.targetPath ?? process.cwd(),
        includeIgnored: options.includeIgnored,
        minimumSeverity: failOn,
        rules: resolveAuditRules(builtInRules, config)
      });
      const lang = resolveLanguage(options.lang, config);
      const output = options.outputProvided ? options.output ?? 'markdown' : 'markdown';
      const formatted = formatResult(result, output, lang);
      const reportPath = options.report ?? defaultReportPath(output);

      writeFileSync(reportPath, `${formatted}\n`);
      console.log(`Wrote report to ${reportPath}`);
      console.log(formatted);

      return shouldFail(result, failOn) ? 1 : 0;
    }

    const diff = await readDiffInput(options);
    if (!diff.trim()) {
      console.error('No diff input found. Use --diff, --file <path>, or pipe a unified diff to stdin.');
      return 2;
    }

    const rules = resolveAuditRules(builtInRules, config);
    const failOn = resolveFailOn(options.failOn, config);
    const lang = resolveLanguage(options.lang, config);
    const output = options.outputProvided ? options.output ?? 'text' : 'text';
    const result = auditDiff(diff, {
      rules,
      minimumSeverity: failOn
    });

    console.log(formatResult(result, output, lang));

    return shouldFail(result, failOn) ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

function defaultReportPath(format: string): string {
  switch (format) {
    case 'json':
      return 'patchproof-report.json';
    case 'sarif':
      return 'patchproof-report.sarif';
    case 'text':
      return 'patchproof-report.txt';
    default:
      return 'patchproof-report.md';
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exitCode = code;
  });
}
