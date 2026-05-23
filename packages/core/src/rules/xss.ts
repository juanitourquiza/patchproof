import { createFinding } from '../finding.js';
import { hasUnsafeHtmlPattern } from '../ast.js';
import type { AuditRule, Finding } from '../types.js';

const unsafeHtmlPattern = /\b(?:innerHTML|outerHTML|insertAdjacentHTML|bypassSecurityTrustHtml|dangerouslySetInnerHTML)\b/;

export const xssRule: AuditRule = {
  id: 'PP003',
  title: 'Unsafe HTML rendering',
  tags: ['security', 'xss', 'owasp-a03'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => hasUnsafeHtmlPattern(line) || unsafeHtmlPattern.test(line.content))
      .map((line) =>
        createFinding({
          ruleId: xssRule.id,
          severity: 'high',
          confidence: 'medium',
          title: 'Potential XSS sink added',
          description: 'The diff introduces an API that can render unsanitized HTML.',
          line,
          recommendation: 'Prefer text rendering. If HTML is required, sanitize input with a trusted sanitizer and document the trust boundary.',
          tags: xssRule.tags
        })
      );
  }
};
