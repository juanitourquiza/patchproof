import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { builtInRules } from '@patchproof/core';
import type { AuditResult, DiffLine, Finding, Severity } from '@patchproof/core';

const allowedExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.php',
  '.phtml',
  '.blade.php',
  '.env',
  '.yml',
  '.yaml',
  '.md',
  '.sh',
  '.bash',
  '.zsh',
  '.py',
  '.rb',
  '.go',
  '.java',
  '.kt',
  '.scala',
  '.vue',
  '.svelte'
]);

const alwaysIgnoredDirs = new Set(['.git', 'node_modules', 'vendor', '.claude', '.cursor', '.windsurf', '.copilot']);
const ignoredWhenNotIncludedDirs = new Set(['dist', 'build', 'coverage', '.angular', '.cache', '.next', '.turbo', '.nx']);

export interface WorkspaceScanOptions {
  readonly targetPath: string;
  readonly includeIgnored: boolean;
  readonly minimumSeverity?: Severity;
}

export async function scanWorkspace(options: WorkspaceScanOptions): Promise<AuditResult> {
  const root = resolve(options.targetPath);
  const files = await collectFiles(root, options.includeIgnored);
  const addedLines: DiffLine[] = [];

  for (const filePath of files) {
    const relativePath = filePath.startsWith(root) ? filePath.slice(root.length + 1) : basename(filePath);
    const content = await readTextFile(filePath);
    if (content === null) {
      continue;
    }

    const lines = content.replace(/\r\n/g, '\n').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      addedLines.push({
        filePath: relativePath,
        oldLine: null,
        newLine: index + 1,
        content: lines[index],
        kind: 'added'
      });
    }
  }

  const diff = {
    files: files.map((filePath) => (filePath.startsWith(root) ? filePath.slice(root.length + 1) : basename(filePath))),
    lines: addedLines
  };

  const findings = builtInRules
    .flatMap((rule) => rule.run({ diff, addedLines }))
    .filter((finding) => (options.minimumSeverity ? severityAtLeast(finding.severity, options.minimumSeverity) : true))
    .sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.ruleId.localeCompare(right.ruleId));

  return {
    findings,
    summary: {
      total: findings.length,
      critical: findings.filter((finding) => finding.severity === 'critical').length,
      high: findings.filter((finding) => finding.severity === 'high').length,
      medium: findings.filter((finding) => finding.severity === 'medium').length,
      low: findings.filter((finding) => finding.severity === 'low').length,
      filesScanned: files.length
    }
  };
}

async function collectFiles(root: string, includeIgnored: boolean): Promise<string[]> {
  try {
    const args = includeIgnored
      ? ['-C', root, 'ls-files', '--cached', '--others', '--ignored', '--exclude-standard']
      : ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard'];
    const output = execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const files = output
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .filter((entry) => shouldScanPath(entry, includeIgnored))
      .map((entry) => resolve(root, entry));

    if (files.length > 0) {
      return files;
    }
  } catch {
    // Fall back to a recursive walk below.
  }

  return walkFiles(root, includeIgnored);
}

async function walkFiles(root: string, includeIgnored: boolean): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (alwaysIgnoredDirs.has(entry.name)) {
        continue;
      }

      if (!includeIgnored && ignoredWhenNotIncludedDirs.has(entry.name)) {
        continue;
      }

      files.push(...(await walkFiles(resolve(root, entry.name), includeIgnored)));
      continue;
    }

    if (entry.isFile() && shouldScanPath(entry.name, includeIgnored)) {
      files.push(resolve(root, entry.name));
    }
  }

  return files;
}

function shouldScanPath(entry: string, includeIgnored: boolean): boolean {
  if (entry.includes('/node_modules/') || entry.includes('/vendor/') || entry.startsWith('.git/')) {
    return false;
  }

  const segments = entry.split(/[\\/]/);

  if (segments.some((segment) => alwaysIgnoredDirs.has(segment))) {
    return false;
  }

  if (entry.includes('/.claude/') || entry.includes('/.cursor/') || entry.includes('/.windsurf/') || entry.includes('/.copilot/')) {
    return false;
  }

  if (!includeIgnored) {
    if (segments.some((segment) => ignoredWhenNotIncludedDirs.has(segment))) {
      return false;
    }
  }

  const extension = extensionFor(entry);
  return allowedExtensions.has(extension) || entry.endsWith('.blade.php') || entry.endsWith('.env');
}

async function readTextFile(filePath: string): Promise<string | null> {
  try {
    const content = await readFile(filePath, 'utf8');
    return content.includes('\u0000') ? null : content;
  } catch {
    return null;
  }
}

function extensionFor(filePath: string): string {
  if (filePath.endsWith('.blade.php')) {
    return '.blade.php';
  }

  if (filePath.endsWith('.env')) {
    return '.env';
  }

  const ext = filePath.slice(filePath.lastIndexOf('.'));
  return ext === filePath ? '' : ext;
}

function severityAtLeast(value: Severity, minimum: Severity): boolean {
  const order: Record<Severity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
  };

  return order[value] >= order[minimum];
}
