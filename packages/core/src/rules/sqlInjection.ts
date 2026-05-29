import { createFinding } from '../finding.js';
import { hasSqlInjectionPattern } from '../ast.js';
import type { AuditRule, Finding } from '../types.js';

const sqlCallPattern = /\b(?:query|raw|execute|exec|statement|select)\s*\(/i;
const interpolationPattern = /(`[^`]*(?:\$\{[^}]+}|SELECT|INSERT|UPDATE|DELETE)[^`]*`|['"][^'"]*(?:SELECT|INSERT|UPDATE|DELETE)[^'"]*['"]\s*\+)/i;
const phpSqlCallPattern = /\b(?:whereRaw|orderByRaw|havingRaw|selectRaw|raw|query|statement|select|DB::raw|PDO::query|mysqli_query|pg_query)\s*\(/i;

export const sqlInjectionRule: AuditRule = {
  id: 'PP002',
  title: 'Potential SQL injection',
  tags: ['security', 'sql-injection', 'owasp-a03'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => hasSqlInjectionPattern(line) || isPhpSqlInjectionRisk(line.filePath, line.content) || (sqlCallPattern.test(line.content) && interpolationPattern.test(line.content)))
      .map((line) =>
        createFinding({
          ruleId: sqlInjectionRule.id,
          severity: 'high',
          confidence: 'medium',
          title: 'SQL query appears to include interpolated input',
          description: 'The added line builds a SQL statement with string concatenation or template interpolation.',
          line,
          recommendation: 'Use parameterized queries, prepared statements, or the framework query builder with bound values.',
          tags: sqlInjectionRule.tags
        })
      );
  }
};

function isPhpSqlInjectionRisk(filePath: string, content: string): boolean {
  if (!filePath.endsWith('.php')) {
    return false;
  }

  if (!phpSqlCallPattern.test(content)) {
    return false;
  }

  if (!hasPhpInterpolationOrConcatenation(content)) {
    return false;
  }

  return true;
}

function hasPhpInterpolationOrConcatenation(content: string): boolean {
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
