import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const verboseLogFilePattern = /(?:^|\/)(?:\.env(?:\.[^/]+)?|config\/logging\.php|config\/app\.php|docker-compose\.(?:ya?ml)|compose\.(?:ya?ml)|\.json|\.ya?ml)$/i;
const verboseLogPatterns = [
  /(?:^|[\s"'])LOG_LEVEL\s*=\s*(debug|trace)\b/i,
  /(?:^|[\s"'])LOG_LEVEL\s*:\s*(debug|trace)\b/i,
  /(?:'level'|"level"|level)\s*=>\s*['"]?(debug|trace)['"]?/i,
  /(?:'level'|"level"|level)\s*:\s*['"]?(debug|trace)['"]?/i,
  /\bdisplay_errors\s*=\s*(1|on|true)\b/i,
  /\berror_reporting\s*=\s*(E_ALL|[-]1)\b/i
];

export const verboseLogsRule: AuditRule = {
  id: 'PP012',
  title: 'Verbose error or logging configuration',
  tags: ['security', 'logging', 'owasp-a05'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => isVerboseLoggingRisk(line.filePath, line.content))
      .map((line) =>
        createFinding({
          ruleId: verboseLogsRule.id,
          severity: 'medium',
          confidence: 'high',
          title: 'Logging or error reporting looks overly verbose',
          description: 'The diff enables debug-level logging or verbose error output in a deployment-oriented file.',
          line,
          recommendation: 'Keep production logging at an appropriate level and avoid exposing stack traces or debug-level logs in shipped configs.',
          tags: verboseLogsRule.tags
        })
      );
  }
};

function isVerboseLoggingRisk(filePath: string, content: string): boolean {
  if (!verboseLogFilePattern.test(filePath)) {
    return false;
  }

  const trimmed = content.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return false;
  }

  return verboseLogPatterns.some((pattern) => pattern.test(content));
}
