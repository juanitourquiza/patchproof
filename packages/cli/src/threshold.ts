import type { AuditResult, Severity } from '@patchproof/core';

const severityOrder: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function shouldFail(result: AuditResult, failOn: Severity): boolean {
  return result.findings.some((finding) => severityOrder[finding.severity] >= severityOrder[failOn]);
}
