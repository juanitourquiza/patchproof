import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const appFilePattern = /(?:^|\/)app\/.*\.php$/i;
const weakPasswordPattern = /\b(?:Hash::make|bcrypt)\s*\(\s*(?:''|""|['"]password['"]|['"]123456['"]|['"]123Qwerty['"])\s*\)/i;
const passwordAssignmentPattern = /\bpassword\b\s*=>\s*(?:''|""|['"]password['"]|['"]123456['"]|['"]123Qwerty['"])\b/i;

export const passwordProtectionRule: AuditRule = {
  id: 'PP014',
  title: 'Weak or empty password value',
  tags: ['security', 'authentication', 'password', 'owasp-a07'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => isWeakPasswordRisk(line.filePath, line.content))
      .map((line) =>
        createFinding({
          ruleId: passwordProtectionRule.id,
          severity: 'high',
          confidence: 'high',
          title: 'Weak or empty password value added',
          description: 'The diff adds a hardcoded, empty, or obvious default password value in app code.',
          line,
          recommendation: 'Require user-provided strong passwords or one-time verification flows; avoid empty or obvious default passwords.',
          tags: passwordProtectionRule.tags
        })
      );
  }
};

function isWeakPasswordRisk(filePath: string, content: string): boolean {
  if (!appFilePattern.test(filePath)) {
    return false;
  }

  const trimmed = content.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return false;
  }

  return weakPasswordPattern.test(content) || passwordAssignmentPattern.test(content);
}
