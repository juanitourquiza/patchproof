import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const proxyFilePattern = /(?:^|\/)(?:\.env(?:\.[^/]+)?|config\/app\.php|config\/trustedproxy\.php|app\/Http\/Middleware\/TrustProxies\.php|app\/Providers\/AppServiceProvider\.php|nginx\.(?:conf|template)|docker-compose\.(?:ya?ml)|compose\.(?:ya?ml))$/i;
const insecureProxyPatterns = [
  /\bAPP_URL\s*=\s*http:\/\//i,
  /\bAPP_URL\s*[:=]\s*['"]http:\/\//i,
  /\bURL::forceScheme\s*\(\s*['"]http['"]\s*\)/i,
  /\bforceScheme\s*\(\s*['"]http['"]\s*\)/i,
  /\b['"]?(?:trusted_proxies|proxies)['"]?\s*=>\s*['"]\*['"]/i,
  /\bprotected\s+\$proxies\s*=\s*['"]\*['"]/i,
  /\btrusted_proxies\s*[:=]\s*['"]\*['"]/i,
  /\btrusted_proxies\s*[:=]\s*['"]0\.0\.0\.0\/0['"]/i,
  /\btrusted_proxies\s*[:=]\s*['"]::\/0['"]/i
];

export const proxyHttpsRule: AuditRule = {
  id: 'PP011',
  title: 'Insecure proxy or HTTPS configuration',
  tags: ['security', 'proxy', 'https', 'owasp-a05'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => isProxyHttpsRisk(line.filePath, line.content))
      .map((line) =>
        createFinding({
          ruleId: proxyHttpsRule.id,
          severity: 'medium',
          confidence: 'medium',
          title: 'Proxy or HTTPS configuration looks insecure',
          description: 'The diff weakens HTTPS enforcement or trusts all proxies, which can break correct URL generation and security boundaries.',
          line,
          recommendation: 'Use HTTPS URLs in production and restrict trusted proxies to known infrastructure ranges only.',
          tags: proxyHttpsRule.tags
        })
      );
  }
};

function isProxyHttpsRisk(filePath: string, content: string): boolean {
  if (!proxyFilePattern.test(filePath)) {
    return false;
  }

  const trimmed = content.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return false;
  }

  return insecureProxyPatterns.some((pattern) => pattern.test(content));
}
