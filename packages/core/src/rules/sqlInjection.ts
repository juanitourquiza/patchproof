import { createFinding } from '../finding.js';
import { hasSqlInjectionPattern } from '../ast.js';
import type { AuditRule, Finding } from '../types.js';

const sqlCallPattern = /\b(?:query|raw|execute|exec|statement|select)\s*\(/i;
const interpolationPattern = /(`[^`]*(?:\$\{[^}]+}|SELECT|INSERT|UPDATE|DELETE)[^`]*`|['"][^'"]*(?:SELECT|INSERT|UPDATE|DELETE)[^'"]*['"]\s*\+)/i;

export const sqlInjectionRule: AuditRule = {
  id: 'PP002',
  title: 'Potential SQL injection',
  tags: ['security', 'sql-injection', 'owasp-a03'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => hasSqlInjectionPattern(line) || (sqlCallPattern.test(line.content) && interpolationPattern.test(line.content)))
      .map((line) =>
        createFinding({
          ruleId: sqlInjectionRule.id,
          severity: 'high',
          confidence: 'medium',
          title: 'SQL query appears to include interpolated input',
          description: 'The added line builds a SQL statement with string concatenation or template interpolation.',
          line,
          recommendation: 'Use parameterized queries, prepared statements, or the framework query builder with bound values.',
          tags: sqlInjectionRule.tags
        })
      );
  }
};
