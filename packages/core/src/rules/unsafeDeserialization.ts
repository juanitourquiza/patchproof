import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const unsafeDeserializationPattern = /\bunserialize\s*\(/i;

export const unsafeDeserializationRule: AuditRule = {
  id: 'PP021',
  title: 'Unsafe deserialization',
  tags: ['security', 'deserialization', 'owasp-a08'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => line.filePath.endsWith('.php') && unsafeDeserializationPattern.test(line.content))
      .map((line) =>
        createFinding({
          ruleId: unsafeDeserializationRule.id,
          severity: 'high',
          confidence: 'medium',
          title: 'Unsafe PHP deserialization added',
          description: 'The diff adds a call to unserialize(), which can instantiate attacker-controlled objects if untrusted data reaches it.',
          line,
          recommendation: 'Prefer json_decode or other safe data formats. If unserialize is unavoidable, restrict allowed classes and ensure the input is fully trusted.',
          tags: unsafeDeserializationRule.tags
        })
      );
  }
};
