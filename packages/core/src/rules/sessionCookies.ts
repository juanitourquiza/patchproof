import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const sessionFilePattern = /(?:^|\/)(?:\.env(?:\.[^/]+)?|config\/session\.php|config\/sanctum\.php|config\/sessions?\.php)$/i;
const insecureSessionPatterns = [
  /\bSESSION_SECURE_COOKIE\s*=\s*false\b/i,
  /\bSESSION_HTTP_ONLY\s*=\s*false\b/i,
  /\bSESSION_SAME_SITE\s*=\s*none\b/i,
  /\b'http_only'\s*=>\s*false\b/i,
  /\b"http_only"\s*:\s*false\b/i,
  /\b'secure'\s*=>\s*false\b/i,
  /\b"secure"\s*:\s*false\b/i,
  /\b'same_site'\s*=>\s*'none'\b/i,
  /\b"same_site"\s*:\s*"none"\b/i
];

export const sessionCookiesRule: AuditRule = {
  id: 'PP010',
  title: 'Insecure session cookie settings',
  tags: ['security', 'cookies', 'owasp-a05'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => isInsecureSessionCookie(line.filePath, line.content))
      .map((line) =>
        createFinding({
          ruleId: sessionCookiesRule.id,
          severity: 'medium',
          confidence: 'high',
          title: 'Session cookie settings appear insecure',
          description: 'The diff disables secure or httpOnly protections, or forces SameSite=none, which weakens session cookie protection.',
          line,
          recommendation: 'Keep secure and httpOnly enabled, and avoid SameSite=None unless the cookie is also secure and strictly required.',
          tags: sessionCookiesRule.tags
        })
      );
  }
};

function isInsecureSessionCookie(filePath: string, content: string): boolean {
  if (!sessionFilePattern.test(filePath)) {
    return false;
  }

  const trimmed = content.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return false;
  }

  return insecureSessionPatterns.some((pattern) => pattern.test(content));
}
