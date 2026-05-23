import type { DiffLine, ParsedDiff } from './types.js';

const fileHeaderPrefix = '+++ b/';
const hunkHeaderPattern = /^@@ -(?<oldStart>\d+)(?:,\d+)? \+(?<newStart>\d+)(?:,\d+)? @@/;

export function parseUnifiedDiff(input: string): ParsedDiff {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const diffLines: DiffLine[] = [];
  const files = new Set<string>();

  let currentFile = '';
  let oldLine: number | null = null;
  let newLine: number | null = null;

  for (const rawLine of lines) {
    if (rawLine.startsWith(fileHeaderPrefix)) {
      currentFile = rawLine.slice(fileHeaderPrefix.length);
      files.add(currentFile);
      continue;
    }

    const hunkMatch = rawLine.match(hunkHeaderPattern);
    if (hunkMatch?.groups) {
      oldLine = Number(hunkMatch.groups.oldStart);
      newLine = Number(hunkMatch.groups.newStart);
      continue;
    }

    if (!currentFile || oldLine === null || newLine === null) {
      continue;
    }

    if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      diffLines.push(makeLine(currentFile, null, newLine, rawLine.slice(1), 'added'));
      newLine += 1;
      continue;
    }

    if (rawLine.startsWith('-') && !rawLine.startsWith('---')) {
      diffLines.push(makeLine(currentFile, oldLine, null, rawLine.slice(1), 'removed'));
      oldLine += 1;
      continue;
    }

    if (rawLine.startsWith(' ')) {
      diffLines.push(makeLine(currentFile, oldLine, newLine, rawLine.slice(1), 'context'));
      oldLine += 1;
      newLine += 1;
    }
  }

  return {
    files: [...files],
    lines: diffLines
  };
}

function makeLine(
  filePath: string,
  oldLine: number | null,
  newLine: number | null,
  content: string,
  kind: DiffLine['kind']
): DiffLine {
  return { filePath, oldLine, newLine, content, kind };
}
