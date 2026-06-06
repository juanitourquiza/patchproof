import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const relevantBusinessFilesPattern = /^(?:app\/Http\/Controllers\/|routes\/api\.php$|routes\/admin\.php$)/i;

const dangerousBusinessActionPattern =
  /\b(?:refund|publish|approve|cancel|promote|grant|transfer|void|charge|ban|suspend|activate|deactivate|revoke)\b\s*\(/i;

const explicitGuardPattern = /(?:confirm|confirmation|review|dry[-]?run|preview|approve(?:d)?|validated?|verification|withconfirmation|afterreview)/i;

export const insecureBusinessActionRule: AuditRule = {
  id: 'PP022',
  title: 'Insecure business action design',
  tags: ['security', 'design', 'owasp-a04'],
  run(context): Finding[] {
    const guardByFile = new Map<string, number[]>();

    for (const line of context.addedLines) {
      if (explicitGuardPattern.test(line.content)) {
        const lineNumbers = guardByFile.get(line.filePath) ?? [];
        if (line.newLine !== null) {
          lineNumbers.push(line.newLine);
        }
        guardByFile.set(line.filePath, lineNumbers);
      }
    }

    return context.addedLines
      .filter((line) => line.filePath.endsWith('.php') && relevantBusinessFilesPattern.test(line.filePath))
      .filter((line) => dangerousBusinessActionPattern.test(line.content) && !hasNearbyGuard(line, guardByFile))
      .map((line) =>
        createFinding({
          ruleId: insecureBusinessActionRule.id,
          severity: 'high',
          confidence: 'medium',
          title: 'Dangerous business action lacks an explicit safety step',
          description: 'The diff adds a state-changing business action without an obvious confirmation, review, or preview step.',
          line,
          recommendation: 'Add an explicit confirmation flow, approval gate, dry-run, or review step before executing destructive or high-impact business actions.',
          tags: insecureBusinessActionRule.tags
        })
      );
  }
};

function hasNearbyGuard(line: { filePath: string; newLine: number | null }, guardByFile: Map<string, number[]>): boolean {
  if (line.newLine === null) {
    return false;
  }

  const currentLine = line.newLine;
  const guardLines = guardByFile.get(line.filePath) ?? [];
  return guardLines.some((guardLine) => Math.abs(guardLine - currentLine) <= 5);
}
