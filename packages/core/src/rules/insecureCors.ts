import { createFinding } from '../finding.js';
import { hasWildcardCorsPattern } from '../ast.js';
import type { AuditRule, Finding } from '../types.js';

const corsWildcardPattern = /\b(?:origin|allowed_origins|Access-Control-Allow-Origin)\b\s*[:=]\s*['"]\*['"]/i;

export const insecureCorsRule: AuditRule = {
  id: 'PP005',
  title: 'Permissive CORS configuration',
  tags: ['security', 'cors', 'owasp-a05'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => hasWildcardCorsPattern(line) || corsWildcardPattern.test(line.content))
      .map((line) =>
        createFinding({
          ruleId: insecureCorsRule.id,
          severity: 'medium',
          confidence: 'medium',
          title: 'Wildcard CORS origin added',
          description: 'The diff permits requests from any origin, which is often copied from AI examples into production code.',
          line,
          recommendation: 'Restrict CORS origins per environment and avoid wildcard origins for authenticated APIs.',
          tags: insecureCorsRule.tags
        })
      );
  }
};
