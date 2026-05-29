import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const routeFilePattern = /(?:^|\/)routes\/.*\.php$/i;
const authRoutePattern = /\/(?:oauth\/token|oauth\/social|login|forgot(?:-password)?|reset(?:-password)?|verify(?:-email)?|two-factor|2fa|otp)\b/i;
const throttlePattern = /\b(?:throttle|rate[-_ ]?limit|limit(?:er|ation)?|maxAttempts|tooManyAttempts)\b/i;

export const authThrottleRule: AuditRule = {
  id: 'PP013',
  title: 'Authentication endpoint lacks brute-force protection',
  tags: ['security', 'authentication', 'rate-limit', 'owasp-a07'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => isAuthThrottleRisk(line.filePath, line.content))
      .map((line) =>
        createFinding({
          ruleId: authThrottleRule.id,
          severity: 'high',
          confidence: 'medium',
          title: 'Authentication route appears to lack throttle protection',
          description: 'The diff adds or changes a login / token / recovery endpoint without obvious rate limiting or brute-force protection.',
          line,
          recommendation: 'Add throttle middleware or an equivalent rate-limit / lockout mechanism to authentication endpoints.',
          tags: authThrottleRule.tags
        })
      );
  }
};

function isAuthThrottleRisk(filePath: string, content: string): boolean {
  if (!routeFilePattern.test(filePath)) {
    return false;
  }

  const trimmed = content.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return false;
  }

  if (!authRoutePattern.test(content)) {
    return false;
  }

  return !throttlePattern.test(content);
}
