import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const debugFilePattern = /(?:^|\/)(?:\.env(?:\.[^/]+)?|config\/app\.php|php\.ini|\.ini|docker-compose\.(?:ya?ml)|compose\.(?:ya?ml)|appsettings\.json)$/i;
const insecureDebugPatterns = [
  /\bAPP_DEBUG\s*=\s*true\b/i,
  /\bAPP_ENV\s*=\s*(development|local|staging)\b/i,
  /\b'debug'\s*=>\s*true\b/i,
  /\b"debug"\s*:\s*true\b/i,
  /\bdebug\s*:\s*true\b/i,
  /\bdisplay_errors\s*=\s*(1|on|true)\b/i,
  /\bexpose_php\s*=\s*(1|on|true)\b/i
];

export const debugConfigRule: AuditRule = {
  id: 'PP008',
  title: 'Exposed debug or non-production configuration',
  tags: ['security', 'configuration', 'owasp-a05'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => isDebugConfigRisk(line.filePath, line.content))
      .map((line) =>
        createFinding({
          ruleId: debugConfigRule.id,
          severity: 'medium',
          confidence: 'high',
          title: 'Debug or non-production configuration added',
          description: 'The diff enables debug mode or a non-production environment in a deployment-oriented config file.',
          line,
          recommendation: 'Keep debug disabled in production, use production environment values, and store example values only in sample files.',
          tags: debugConfigRule.tags
        })
      );
  }
};

function isDebugConfigRisk(filePath: string, content: string): boolean {
  if (!debugFilePattern.test(filePath)) {
    return false;
  }

  const trimmed = content.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return false;
  }

  return insecureDebugPatterns.some((pattern) => pattern.test(content));
}
