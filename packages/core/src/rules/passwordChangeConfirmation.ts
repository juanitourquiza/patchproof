import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const routeFilePattern = /(?:^|\/)routes\/.*\.php$/i;
const passwordRoutePattern = /\/(?:users\/me\/password(?:-only)?|password(?:-only)?|reset(?:-password)?|forgot(?:-password)?|change-password|update-password)\b/i;
const authPattern = /\b(?:auth|sanctum|jwt|passport)\b/i;
const confirmationPattern = /\bpassword\.confirm\b|\bcurrent_password\b/i;

export const passwordChangeConfirmationRule: AuditRule = {
  id: 'PP016',
  title: 'Password change route lacks confirmation protection',
  tags: ['security', 'authentication', 'password', 'owasp-a07'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => isPasswordChangeRisk(line.filePath, line.content))
      .map((line) =>
        createFinding({
          ruleId: passwordChangeConfirmationRule.id,
          severity: 'high',
          confidence: 'medium',
          title: 'Password route has auth but lacks confirmation protection',
          description: 'The diff adds or changes a password-related route with authentication, but without password confirmation or current-password verification.',
          line,
          recommendation: 'Require password confirmation or current-password verification on password change routes.',
          tags: passwordChangeConfirmationRule.tags
        })
      );
  }
};

function isPasswordChangeRisk(filePath: string, content: string): boolean {
  if (!routeFilePattern.test(filePath)) {
    return false;
  }

  const trimmed = content.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return false;
  }

  if (!passwordRoutePattern.test(content) || !authPattern.test(content)) {
    return false;
  }

  return !confirmationPattern.test(content);
}
