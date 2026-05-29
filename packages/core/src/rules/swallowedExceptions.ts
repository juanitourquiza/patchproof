import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const swallowedExceptionPattern = /\bcatch\s*\([^)]+\)\s*\{\s*\}/i;

export const swallowedExceptionsRule: AuditRule = {
  id: 'PP023',
  title: 'Swallowed exception without logging',
  tags: ['security', 'logging', 'owasp-a09'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => line.filePath.endsWith('.php') && swallowedExceptionPattern.test(line.content))
      .map((line) =>
        createFinding({
          ruleId: swallowedExceptionsRule.id,
          severity: 'medium',
          confidence: 'medium',
          title: 'Exception is swallowed without logging',
          description: 'The diff adds a catch block that swallows an exception without logging or reporting it.',
          line,
          recommendation: 'Log the exception, report it to your monitoring system, or rethrow it after handling the expected case.',
          tags: swallowedExceptionsRule.tags
        })
      );
  }
};
