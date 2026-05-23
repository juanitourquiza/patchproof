import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { stdin } from 'node:process';
import type { CliOptions } from './args.js';

export async function readDiffInput(options: CliOptions): Promise<string> {
  if (options.file) {
    return readFileSync(options.file, 'utf8');
  }

  if (options.useGitDiff) {
    return execFileSync('git', ['diff', '--unified=3'], { encoding: 'utf8' });
  }

  return readStdin();
}

async function readStdin(): Promise<string> {
  if (stdin.isTTY) {
    return '';
  }

  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}
