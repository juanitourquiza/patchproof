#!/usr/bin/env node
import { auditDiff, builtInRules } from '@patchproof/core';
import { writeFileSync } from 'node:fs';
import { parseArgs } from './args.js';
import { loadConfig, resolveAuditRules, resolveFailOn, resolveLanguage } from './config.js';
import { formatResult, formatRules } from './format.js';
import { helpText, initConfigText } from './help.js';
import { readDiffInput } from './input.js';
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
      console.log('0.1.0');
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
        minimumSeverity: failOn
      });
      const lang = resolveLanguage(options.lang, config);
      const output = options.outputProvided ? options.output ?? 'text' : 'text';
      console.log(formatResult(result, output, lang));
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

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exitCode = code;
  });
}
