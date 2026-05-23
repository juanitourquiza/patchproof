import { createFinding } from '../finding.js';
import { hasDangerousExecutionPattern } from '../ast.js';
import type { AuditRule, Finding } from '../types.js';

const dangerousExecutionPattern = /\b(?:eval|Function|execSync|spawnSync|child_process\.exec|shell_exec|passthru|system)\s*\(/;

export const dangerousExecutionRule: AuditRule = {
  id: 'PP004',
  title: 'Dangerous dynamic execution',
  tags: ['security', 'command-injection', 'owasp-a03'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => hasDangerousExecutionPattern(line) || dangerousExecutionPattern.test(line.content))
      .map((line) =>
        createFinding({
          ruleId: dangerousExecutionRule.id,
          severity: 'high',
          confidence: 'medium',
          title: 'Dynamic execution API added',
          description: 'The diff adds an API that can execute code or shell commands.',
          line,
          recommendation: 'Avoid dynamic execution. If command execution is required, use fixed commands, argument arrays, and strict allowlists.',
          tags: dangerousExecutionRule.tags
        })
      );
  }
};
