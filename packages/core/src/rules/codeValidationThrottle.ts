import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const routeFilePattern = /(?:^|\/)routes\/.*\.php$/i;
const codeValidationPattern = /\/(?:emails|phones)\/codes\/validations\b/i;
const throttlePattern = /\b(?:throttle|rate[-_ ]?limit|limit(?:er|ation)?|maxAttempts|tooManyAttempts)\b/i;

export const codeValidationThrottleRule: AuditRule = {
  id: 'PP015',
  title: 'OTP or code validation endpoint lacks brute-force protection',
  tags: ['security', 'authentication', 'otp', 'owasp-a07'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => isCodeValidationRisk(line.filePath, line.content))
      .map((line) =>
        createFinding({
          ruleId: codeValidationThrottleRule.id,
          severity: 'high',
          confidence: 'medium',
          title: 'OTP/code validation route appears to lack throttle protection',
          description: 'The diff adds or changes a code/OTP validation endpoint without obvious rate limiting or lockout protection.',
          line,
          recommendation: 'Protect OTP/code validation endpoints with throttle middleware or an equivalent attempt limit.',
          tags: codeValidationThrottleRule.tags
        })
      );
  }
};

function isCodeValidationRisk(filePath: string, content: string): boolean {
  if (!routeFilePattern.test(filePath)) {
    return false;
  }

  const trimmed = content.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return false;
  }

  if (!codeValidationPattern.test(content)) {
    return false;
  }

  return !throttlePattern.test(content);
}
