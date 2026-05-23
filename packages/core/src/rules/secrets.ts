import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const secretPatterns = [
  {
    name: 'OpenAI API key',
    pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/
  },
  {
    name: 'AWS access key',
    pattern: /AKIA[0-9A-Z]{16}/
  },
  {
    name: 'GitHub token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/
  },
  {
    name: 'Private key material',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/
  },
  {
    name: 'Hardcoded secret assignment',
    pattern: /\b(?:api[_-]?key|secret|token|password|passwd)\b\s*[:=]\s*['"][^'"]{8,}['"]/i
  }
];

export const secretsRule: AuditRule = {
  id: 'PP001',
  title: 'Hardcoded secret',
  tags: ['security', 'secrets', 'owasp-a02'],
  run(context): Finding[] {
    return context.addedLines.flatMap((line) => {
      const match = secretPatterns.find((entry) => entry.pattern.test(line.content));
      if (!match) {
        return [];
      }

      return createFinding({
        ruleId: secretsRule.id,
        severity: 'critical',
        confidence: 'high',
        title: `${match.name} committed in code`,
        description: 'The diff adds credential-like material. AI agents often inline examples that become real secrets.',
        line,
        recommendation: 'Remove the value, rotate it if it was real, and load it from an environment variable or secret manager.',
        tags: secretsRule.tags
      });
    });
  }
};
