#!/usr/bin/env node
import { auditDiff, builtInRules } from '@patchproof/core';
import { writeFileSync } from 'node:fs';
import { parseArgs } from './args.js';
import { formatResult, formatRules } from './format.js';
import { helpText, initConfigText } from './help.js';
import { readDiffInput } from './input.js';
import { shouldFail } from './threshold.js';

export async function main(argv = process.argv.slice(2)): Promise<number> {
  try {
    const options = parseArgs(argv);

    if (options.command === 'help') {
      console.log(helpText());
      return 0;
    }

    if (options.command === 'version') {
      console.log('0.1.0');
      return 0;
    }

    if (options.command === 'rules') {
      console.log(formatRules(builtInRules));
      return 0;
    }

    if (options.command === 'init') {
      writeFileSync('patchproof.config.json', `${initConfigText()}\n`, { flag: 'wx' });
      console.log('Created patchproof.config.json');
      return 0;
    }

    const diff = await readDiffInput(options);
    if (!diff.trim()) {
      console.error('No diff input found. Use --diff, --file <path>, or pipe a unified diff to stdin.');
      return 2;
    }

    const result = auditDiff(diff);
    console.log(formatResult(result, options.output));

    return shouldFail(result, options.failOn) ? 1 : 0;
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
