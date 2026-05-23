import type { Severity } from './types.js';

const severityOrder: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function compareSeverity(left: Severity, right: Severity): number {
  return severityOrder[left] - severityOrder[right];
}

export function isAtLeastSeverity(value: Severity, minimum: Severity): boolean {
  return compareSeverity(value, minimum) >= 0;
}
