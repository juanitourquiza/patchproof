import { createFinding } from '../finding.js';
import { hasDangerousExecutionPattern } from '../ast.js';
import type { AuditRule, Finding } from '../types.js';

const dangerousExecutionPattern = /\b(?:eval|Function|execSync|spawnSync|child_process\.exec|exec)\s*\(/;
const phpCommandCallPattern = /\b(?:exec|shell_exec|passthru|system|proc_open|popen|pcntl_exec)\s*\(/i;

export const dangerousExecutionRule: AuditRule = {
  id: 'PP004',
  title: 'Dangerous dynamic execution',
  tags: ['security', 'command-injection', 'owasp-a03'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => {
        if (line.filePath.endsWith('.php')) {
          return isPhpCommandInjectionRisk(line.filePath, line.content);
        }

        return hasDangerousExecutionPattern(line) || dangerousExecutionPattern.test(line.content);
      })
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

function isPhpCommandInjectionRisk(filePath: string, content: string): boolean {
  if (!filePath.endsWith('.php')) {
    return false;
  }

  if (!phpCommandCallPattern.test(content)) {
    return false;
  }

  return hasPhpCommandInterpolationOrConcatenation(content);
}

function hasPhpCommandInterpolationOrConcatenation(content: string): boolean {
  return hasPhpConcatenationOutsideStrings(content) || hasPhpInterpolatedDoubleQuotedString(content);
}

function hasPhpConcatenationOutsideStrings(content: string): boolean {
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (!inDouble && char === '\'') {
      inSingle = !inSingle;
      continue;
    }

    if (!inSingle && char === '"') {
      inDouble = !inDouble;
      continue;
    }

    if (!inSingle && !inDouble && char === '.') {
      return true;
    }
  }

  return false;
}

function hasPhpInterpolatedDoubleQuotedString(content: string): boolean {
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let buffer = '';

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (escaped) {
      buffer += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      buffer += char;
      escaped = true;
      continue;
    }

    if (!inDouble && char === '\'') {
      inSingle = !inSingle;
      buffer = '';
      continue;
    }

    if (!inSingle && char === '"') {
      if (inDouble && /\$[A-Za-z_]/.test(buffer)) {
        return true;
      }

      inDouble = !inDouble;
      buffer = '';
      continue;
    }

    if (inDouble) {
      buffer += char;
    }
  }

  return false;
}
