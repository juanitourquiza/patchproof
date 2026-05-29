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
    return context.addedLines
      .filter((line) => line.filePath.endsWith('.php') && relevantBusinessFilesPattern.test(line.filePath))
      .filter((line) => dangerousBusinessActionPattern.test(line.content) && !explicitGuardPattern.test(line.content))
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
