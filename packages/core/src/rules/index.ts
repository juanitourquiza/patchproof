import type { AuditRule } from '../types.js';
import { brokenAccessControlRule } from './brokenAccessControl.js';
import { dangerousExecutionRule } from './dangerousExecution.js';
import { debugConfigRule } from './debugConfig.js';
import { insecureCorsRule } from './insecureCors.js';
import { authThrottleRule } from './authThrottle.js';
import { codeValidationThrottleRule } from './codeValidationThrottle.js';
import { codeIssueThrottleRule } from './codeIssueThrottle.js';
import { objectLevelAuthorizationRule } from './objectLevelAuthorization.js';
import { proxyHttpsRule } from './proxyHttps.js';
import { passwordProtectionRule } from './passwordProtection.js';
import { passwordChangeConfirmationRule } from './passwordChangeConfirmation.js';
import { securityHeadersRule } from './securityHeaders.js';
import { ssrfRule } from './ssrf.js';
import { vulnerableDependenciesRule } from './vulnerableDependencies.js';
import { weakHashingRule } from './weakHashing.js';
import { unsafeDeserializationRule } from './unsafeDeserialization.js';
import { insecureBusinessActionRule } from './insecureBusinessAction.js';
import { swallowedExceptionsRule } from './swallowedExceptions.js';
import { verboseLogsRule } from './verboseLogs.js';
import { sessionCookiesRule } from './sessionCookies.js';
import { secretsRule } from './secrets.js';
import { sqlInjectionRule } from './sqlInjection.js';
import { xssRule } from './xss.js';

export const builtInRules: AuditRule[] = [
  secretsRule,
  sqlInjectionRule,
  xssRule,
  dangerousExecutionRule,
  insecureCorsRule,
  debugConfigRule,
  securityHeadersRule,
  sessionCookiesRule,
  proxyHttpsRule,
  verboseLogsRule,
  authThrottleRule,
  codeValidationThrottleRule,
  codeIssueThrottleRule,
  passwordProtectionRule,
  passwordChangeConfirmationRule,
  ssrfRule,
  vulnerableDependenciesRule,
  weakHashingRule,
  unsafeDeserializationRule,
  insecureBusinessActionRule,
  swallowedExceptionsRule,
  brokenAccessControlRule,
  objectLevelAuthorizationRule
];

export { brokenAccessControlRule, dangerousExecutionRule, debugConfigRule, insecureCorsRule, objectLevelAuthorizationRule, authThrottleRule, codeValidationThrottleRule, codeIssueThrottleRule, passwordProtectionRule, passwordChangeConfirmationRule, proxyHttpsRule, securityHeadersRule, sessionCookiesRule, verboseLogsRule, ssrfRule, vulnerableDependenciesRule, weakHashingRule, unsafeDeserializationRule, insecureBusinessActionRule, swallowedExceptionsRule, secretsRule, sqlInjectionRule, xssRule };
