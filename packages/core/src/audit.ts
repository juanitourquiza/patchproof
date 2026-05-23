import { builtInRules } from './rules/index.js';
import { isAtLeastSeverity } from './severity.js';
import type { AuditOptions, AuditResult, AuditSummary, Finding } from './types.js';
import { parseUnifiedDiff } from './parseDiff.js';

export function auditDiff(diffInput: string, options: AuditOptions = {}): AuditResult {
  const diff = parseUnifiedDiff(diffInput);
  const rules = options.rules ?? builtInRules;
  const addedLines = diff.lines.filter((line) => line.kind === 'added');

  const findings = rules
    .flatMap((rule) => rule.run({ diff, addedLines }))
    .filter((finding) => {
      if (!options.minimumSeverity) {
        return true;
      }

      return isAtLeastSeverity(finding.severity, options.minimumSeverity);
    })
    .sort(sortFindings);

  return {
    findings,
    summary: buildSummary(findings, diff.files.length)
  };
}

function sortFindings(left: Finding, right: Finding): number {
  return left.file.localeCompare(right.file) || left.line - right.line || left.ruleId.localeCompare(right.ruleId);
}

function buildSummary(findings: Finding[], filesScanned: number): AuditSummary {
  return {
    total: findings.length,
    critical: findings.filter((finding) => finding.severity === 'critical').length,
    high: findings.filter((finding) => finding.severity === 'high').length,
    medium: findings.filter((finding) => finding.severity === 'medium').length,
    low: findings.filter((finding) => finding.severity === 'low').length,
    filesScanned
  };
}
