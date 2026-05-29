import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const weakHashPatterns = [
  /\bmd5\s*\(/i,
  /\bsha1\s*\(/i,
  /\bhash\s*\(\s*['"](?:md5|sha1)['"]\s*,/i,
  /\bhash_hmac\s*\(\s*['"](?:md5|sha1)['"]\s*,/i,
  /\bcreateHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/i,
  /\bCryptoJS\.(?:MD5|SHA1)\s*\(/i
];

export const weakHashingRule: AuditRule = {
  id: 'PP020',
  title: 'Weak cryptographic hash usage',
  tags: ['security', 'crypto', 'owasp-a02'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => weakHashPatterns.some((pattern) => pattern.test(line.content)))
      .map((line) =>
        createFinding({
          ruleId: weakHashingRule.id,
          severity: 'high',
          confidence: 'medium',
          title: 'Weak hash algorithm added',
          description: 'The diff adds a weak cryptographic hash such as MD5 or SHA-1.',
          line,
          recommendation: 'Use a modern digest or password-hashing primitive appropriate for the use case, such as SHA-256+ for integrity checks or Argon2/bcrypt for passwords.',
          tags: weakHashingRule.tags
        })
      );
  }
};
