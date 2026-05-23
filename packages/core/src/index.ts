export { auditDiff } from './audit.js';
export { parseUnifiedDiff } from './parseDiff.js';
export { builtInRules } from './rules/index.js';
export type {
  AuditOptions,
  AuditResult,
  AuditRule,
  AuditSummary,
  Confidence,
  DiffLine,
  Finding,
  ParsedDiff,
  RuleContext,
  Severity
} from './types.js';
