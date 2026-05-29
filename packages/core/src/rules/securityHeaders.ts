import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const headerFilePattern = /(?:^|\/)(?:config\/.*|app\/Http\/Middleware\/.*|middleware\/.*|\.github\/.*|server\.(?:js|ts)|.*\.json|.*\.ya?ml|.*\.php)$/i;
const xFrameOptionsWeakPattern = /\b(?:X-Frame-Options|xFrameOptions|frameguard|x_frame_options)\b.*\b(?:ALLOWALL|false|off|0)\b/i;
const xContentTypeWeakPattern = /\b(?:X-Content-Type-Options|xContentTypeOptions|x_content_type_options|nosniff)\b.*\b(?:false|off|0|''|""|none)\b/i;
const referrerPolicyWeakPattern = /\b(?:Referrer-Policy|referrer_policy)\b.*\b(?:unsafe-url|no-referrer-when-downgrade|origin-when-cross-origin)\b/i;
const hstsWeakPattern = /\b(?:Strict-Transport-Security|strict_transport_security)\b.*\bmax-age\s*=\s*0\b/i;
const cspWeakPattern = /\b(?:Content-Security-Policy|contentSecurityPolicy|content_security_policy|csp)\b.*(?:\b\*\b|'unsafe-inline'|'unsafe-eval'|data:)/i;

export const securityHeadersRule: AuditRule = {
  id: 'PP009',
  title: 'Permissive security headers configuration',
  tags: ['security', 'headers', 'owasp-a05'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => isSecurityHeadersRisk(line.filePath, line.content))
      .map((line) =>
        createFinding({
          ruleId: securityHeadersRule.id,
          severity: 'medium',
          confidence: 'medium',
          title: 'Security header configuration looks permissive',
          description: 'The diff adds or relaxes a browser security header in a way that weakens the protection baseline.',
          line,
          recommendation: 'Use strict header defaults such as SAMEORIGIN, nosniff, a narrow CSP, and non-zero HSTS max-age in production.',
          tags: securityHeadersRule.tags
        })
      );
  }
};

function isSecurityHeadersRisk(filePath: string, content: string): boolean {
  if (!headerFilePattern.test(filePath)) {
    return false;
  }

  const trimmed = content.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return false;
  }

  return (
    xFrameOptionsWeakPattern.test(content) ||
    xContentTypeWeakPattern.test(content) ||
    referrerPolicyWeakPattern.test(content) ||
    hstsWeakPattern.test(content) ||
    cspWeakPattern.test(content)
  );
}
