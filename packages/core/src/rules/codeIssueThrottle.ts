import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const routeFilePattern = /(?:^|\/)routes\/.*\.php$/i;
const codeIssuePattern = /\/(?:emails|phones)\/codes(?!\/validations)\b/i;
const throttlePattern = /\b(?:throttle|rate[-_ ]?limit|limit(?:er|ation)?|maxAttempts|tooManyAttempts)\b/i;

export const codeIssueThrottleRule: AuditRule = {
  id: 'PP017',
  title: 'OTP/code issuance endpoint lacks brute-force protection',
  tags: ['security', 'authentication', 'otp', 'owasp-a07'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => isCodeIssueRisk(line.filePath, line.content))
      .map((line) =>
        createFinding({
          ruleId: codeIssueThrottleRule.id,
          severity: 'high',
          confidence: 'medium',
          title: 'OTP/code issuance route appears to lack throttle protection',
          description: 'The diff adds or changes a code issuance endpoint without obvious rate limiting or abuse protection.',
          line,
          recommendation: 'Protect OTP/code issuance endpoints with throttle middleware or equivalent attempt limits to reduce abuse and flooding.',
          tags: codeIssueThrottleRule.tags
        })
      );
  }
};

function isCodeIssueRisk(filePath: string, content: string): boolean {
  if (!routeFilePattern.test(filePath)) {
    return false;
  }

  const trimmed = content.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return false;
  }

  if (!codeIssuePattern.test(content)) {
    return false;
  }

  return !throttlePattern.test(content);
}
