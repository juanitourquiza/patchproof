import type { AuditRule } from '../types.js';
import { dangerousExecutionRule } from './dangerousExecution.js';
import { insecureCorsRule } from './insecureCors.js';
import { secretsRule } from './secrets.js';
import { sqlInjectionRule } from './sqlInjection.js';
import { xssRule } from './xss.js';

export const builtInRules: AuditRule[] = [
  secretsRule,
  sqlInjectionRule,
  xssRule,
  dangerousExecutionRule,
  insecureCorsRule
];

export { dangerousExecutionRule, insecureCorsRule, secretsRule, sqlInjectionRule, xssRule };
