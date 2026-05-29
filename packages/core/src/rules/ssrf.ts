import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const outboundRequestPatterns = [
  /\bfetch\s*\(/i,
  /\baxios\.(?:get|post|put|patch|delete|request)\s*\(/i,
  /\bgot\s*\(/i,
  /\bHttp::(?:get|post|put|patch|delete|request)\s*\(/i,
  /\bfile_get_contents\s*\(/i,
  /\bcurl_init\s*\(/i,
  /\bnew\s+(?:Client|HttpClient|GuzzleHttp\\Client)\b/i,
  /\b(?:GuzzleHttp\\Client|Client|HttpClient)->request\s*\(/i
];

const userControlledUrlPatterns = [
  /\$request->(?:input|get|query|post|json)\s*\(/i,
  /request\(\)->(?:input|get|query)\s*\(/i,
  /req(?:\.query|\.body|\.params)\.[A-Za-z_$][\w$]*/i,
  /req\[['"](?:query|body|params)['"]\]/i,
  /\$_(?:GET|POST|REQUEST)\b/i,
  /params\[['"](?:url|uri|target|endpoint|path|redirect|dest|destination)['"]\]/i
];

const directMetadataTargetPattern =
  /(?:169\.254\.169\.254|metadata\.google\.internal|latest\/meta-data|169\.254\.170\.2|169\.254\.169\.254\/latest\/meta-data)/i;

export const ssrfRule: AuditRule = {
  id: 'PP018',
  title: 'Potential server-side request forgery',
  tags: ['security', 'ssrf', 'owasp-a10'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => {
        if (!outboundRequestPatterns.some((pattern) => pattern.test(line.content))) {
          return false;
        }

        return userControlledUrlPatterns.some((pattern) => pattern.test(line.content)) || directMetadataTargetPattern.test(line.content);
      })
      .map((line) =>
        createFinding({
          ruleId: ssrfRule.id,
          severity: 'high',
          confidence: 'medium',
          title: 'Outbound request appears to use user-controlled URL',
          description: 'The diff adds a server-side request that appears to be driven by request input or a metadata target.',
          line,
          recommendation: 'Allowlist outbound hosts, reject arbitrary URLs from user input, and block metadata service access.',
          tags: ssrfRule.tags
        })
      );
  }
};
