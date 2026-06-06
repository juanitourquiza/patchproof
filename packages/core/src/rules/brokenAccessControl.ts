import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const routePattern = /\bRoute::(get|post|put|patch|delete|match|any)\s*\(/i;
const routeFilePattern = /(?:^|\/)routes\/.*\.php$/i;
const adminRouteFilePattern = /(?:^|\/)routes\/admin\.php$/i;
const sensitivePathPattern = /['"`][^'"`]*(?:\/(?:admin|cron|crons|sync|jobs|queue|maintenance|cache|reindex|seed|debug|impersonate|export|import|reset|approve|reject|block|unblock|ban|unban|invite|invitations?|keys?|tokens?|password(?:s)?|roles?|permissions?)|\b(?:admin|cron|crons|sync|jobs|queue|maintenance|cache|reindex|seed|debug|impersonate|export|import|reset|approve|reject|block|unblock|ban|unban|invite|invitations?|keys?|tokens?|password(?:s)?|roles?|permissions?)\b)[^'"`]*/i;
const authMiddlewarePattern = /\b(?:middleware\s*=>\s*\[[^\]]*\bauth\b|middleware\s*:\s*\[[^\]]*\bauth\b|['"]middleware['"]\s*=>\s*['"][^'"]*\bauth\b|['"]middleware['"]\s*:\s*['"][^'"]*\bauth\b)/i;
const protectionPattern = /\b(?:signed|public-key|account-me|account-first|throttle|can:|policy|authorize|gate|permission|permissions?)\b/i;
const explicitAuthProtectionPattern = /\b(?:auth|sanctum|jwt|passport)\b/i;
const publicByDesignPatterns = [
  /\/accounts\/\{account_id\}\/(public|posts|posts\/favorites|posts\/saved|posts\/me|trendings|chats|replies|stats|notifications|addresses|products|followings|followers|blockeds|purchases)\b/i,
  /\/accounts\/\{report_account_id\}\/reports\b/i,
  /\/emails\/(unsubscribe|codes|contacts|[^\s'"]+)\b/i,
  /\/invitations\/\{email\}/i,
  /\/crons\/[^\s'"]+/i,
  /\/video\/jobs\b/i,
  /\/stripe\/oauth\/token\b/i,
  /\/documentation(?:-admin)?\.json\b/i,
  /\/documentation\b/i,
  /\/promos\/codes\b/i,
  /\/video\/jobs\/[^\s'"]+\/status\b/i,
  /\/algorithm\/posts\/\{post_id\}/i,
  /\/providers\/status\b/i,
  /\/shippings\b/i,
  /\/version\b/i
];

export const brokenAccessControlRule: AuditRule = {
  id: 'PP006',
  title: 'Potential broken access control',
  tags: ['security', 'access-control', 'owasp-a01'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => isRouteSecurityRisk(line.filePath, line.content))
      .map((line) =>
        createFinding({
          ruleId: brokenAccessControlRule.id,
          severity: 'high',
          confidence: 'medium',
          title: 'Sensitive route appears to be publicly exposed',
          description: 'The diff adds or modifies a route for an administrative or state-changing action without obvious auth or authorization middleware.',
          line,
          recommendation: 'Protect the route with authentication/authorization middleware, signed URLs, or a scheduler/queue instead of exposing it publicly.',
          tags: brokenAccessControlRule.tags
        })
      );
  }
};

function isRouteSecurityRisk(filePath: string, content: string): boolean {
  if (!routeFilePattern.test(filePath) || !routePattern.test(content)) {
    return false;
  }

  if (adminRouteFilePattern.test(filePath)) {
    return false;
  }

  const trimmed = content.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
    return false;
  }

  if (!sensitivePathPattern.test(content)) {
    return false;
  }

  if (publicByDesignPatterns.some((pattern) => pattern.test(content))) {
    return false;
  }

  if (authMiddlewarePattern.test(content) || protectionPattern.test(content) || explicitAuthProtectionPattern.test(content)) {
    return false;
  }

  return true;
}
