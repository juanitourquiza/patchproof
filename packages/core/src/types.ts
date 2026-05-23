export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type Confidence = 'high' | 'medium' | 'low';

export interface DiffLine {
  readonly filePath: string;
  readonly oldLine: number | null;
  readonly newLine: number | null;
  readonly content: string;
  readonly kind: 'added' | 'removed' | 'context';
}

export interface ParsedDiff {
  readonly files: string[];
  readonly lines: DiffLine[];
}

export interface Finding {
  readonly id: string;
  readonly ruleId: string;
  readonly severity: Severity;
  readonly confidence: Confidence;
  readonly title: string;
  readonly description: string;
  readonly file: string;
  readonly line: number;
  readonly evidence: string;
  readonly recommendation: string;
  readonly tags: string[];
}

export interface RuleContext {
  readonly diff: ParsedDiff;
  readonly addedLines: DiffLine[];
}

export interface AuditRule {
  readonly id: string;
  readonly title: string;
  readonly tags: string[];
  run(context: RuleContext): Finding[];
}

export interface AuditOptions {
  readonly minimumSeverity?: Severity;
  readonly rules?: AuditRule[];
}

export interface AuditResult {
  readonly findings: Finding[];
  readonly summary: AuditSummary;
}

export interface AuditSummary {
  readonly total: number;
  readonly critical: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
  readonly filesScanned: number;
}
