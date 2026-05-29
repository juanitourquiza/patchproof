import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const routePattern = /\bRoute::(post|put|patch|delete|match|any)\s*\(/i;
const routeFilePattern = /(?:^|\/)routes\/.*\.php$/i;
const adminRouteFilePattern = /(?:^|\/)routes\/admin\.php$/i;
const idParamPattern = /\{[^}]+\}/;
const strongProtectionTokens = ['auth', 'account-me', 'account-first', 'can:', 'policy', 'signed', 'public-key'];
const publicByDesignPatterns = [
  /\/accounts\/\{account_id\}\/(public|posts|posts\/favorites|posts\/saved|posts\/me|trendings|chats|replies|stats|notifications|addresses|products|followings|followers|blockeds|purchases)\b/i,
  /\/accounts\/\{report_account_id\}\/reports\b/i,
  /\/emails\/(unsubscribe|codes|contacts|[^\s'"]+)\b/i,
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
const publicByDesignPattern = /\b(?:auth-optional|public-key|publicProfile|public\/posts|unsubscribe|verify|publicPaymentLink)\b/i;
const sensitiveVerbPattern = /\b(?:post|put|patch|delete|match|any)\b/i;
const stateChangingPathPattern = /\b(?:admin|accounts?|users?|posts?|transactions?|payments?|reports?|invitations?|invites?|blockeds?|followings?|followers?|notifications?|addresses?|products?|sales|scan|scans|jobs?|prompts?|settings?|roles?|permissions?|keys?|tokens?|secrets?|withdraw|withdraws?|approve|reject|update|delete|remove|create|store|destroy|sync|reindex|process|toggle|status)\b/i;

export const objectLevelAuthorizationRule: AuditRule = {
  id: 'PP007',
  title: 'Potential object-level authorization bypass',
  tags: ['security', 'access-control', 'idor', 'owasp-a01'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => isRouteAuthorizationRisk(line.filePath, line.content))
      .map((line) =>
        createFinding({
          ruleId: objectLevelAuthorizationRule.id,
          severity: 'high',
          confidence: 'medium',
          title: 'State-changing route with object identifiers lacks obvious authorization',
          description: 'The diff adds or modifies a route that exposes resource identifiers in a mutating endpoint without obvious auth/authorization protection.',
          line,
          recommendation: 'Require strong authorization middleware or explicit ownership checks for object-scoped operations.',
          tags: objectLevelAuthorizationRule.tags
        })
      );
  }
};

function isRouteAuthorizationRisk(filePath: string, content: string): boolean {
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

  if (!idParamPattern.test(content)) {
    return false;
  }

  if (!sensitiveVerbPattern.test(content) || !stateChangingPathPattern.test(content)) {
    return false;
  }

  if (publicByDesignPattern.test(content) || publicByDesignPatterns.some((pattern) => pattern.test(content))) {
    return false;
  }

  if (hasStrongProtection(content)) {
    return false;
  }

  return true;
}

function hasStrongProtection(content: string): boolean {
  const normalized = content.toLowerCase();
  return strongProtectionTokens.some((token) => normalized.includes(token));
}
