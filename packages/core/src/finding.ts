import { createHash } from 'node:crypto';
import type { Confidence, DiffLine, Finding, Severity } from './types.js';

export interface FindingInput {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly confidence: Confidence;
  readonly title: string;
  readonly description: string;
  readonly line: DiffLine;
  readonly recommendation: string;
  readonly tags: string[];
}

export function createFinding(input: FindingInput): Finding {
  const lineNumber = input.line.newLine ?? input.line.oldLine ?? 0;
  const id = createHash('sha1')
    .update([input.ruleId, input.line.filePath, lineNumber, input.line.content].join(':'))
    .digest('hex')
    .slice(0, 12);

  return {
    id,
    ruleId: input.ruleId,
    severity: input.severity,
    confidence: input.confidence,
    title: input.title,
    description: input.description,
    file: input.line.filePath,
    line: lineNumber,
    evidence: input.line.content.trim(),
    recommendation: input.recommendation,
    tags: input.tags
  };
}
