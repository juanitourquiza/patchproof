import { createFinding } from '../finding.js';
import { parseLineAst } from '../ast.js';
import type { AuditRule, DiffLine, Finding } from '../types.js';
import ts from 'typescript';

const secretPatterns = [
  {
    name: 'OpenAI API key',
    pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/
  },
  {
    name: 'AWS access key',
    pattern: /AKIA[0-9A-Z]{16}/
  },
  {
    name: 'GitHub token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/
  },
  {
    name: 'Private key material',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/
  },
  {
    name: 'Hardcoded secret assignment',
    pattern: /\b(?:api[_-]?key|secret|token|password|passwd)\b\s*[:=]\s*['"][^'"]{8,}['"]/i
  }
];

export const secretsRule: AuditRule = {
  id: 'PP001',
  title: 'Hardcoded secret',
  tags: ['security', 'secrets', 'owasp-a02'],
  run(context): Finding[] {
    return context.addedLines.flatMap((line) => {
      const astMatch = inspectAstForSecrets(line);
      if (astMatch) {
        return astMatch;
      }

      const match = secretPatterns.find((entry) => entry.pattern.test(line.content));
      if (!match) {
        return [];
      }

      return createFinding({
        ruleId: secretsRule.id,
        severity: 'critical',
        confidence: 'high',
        title: `${match.name} committed in code`,
        description: 'The diff adds credential-like material. AI agents often inline examples that become real secrets.',
        line,
        recommendation: 'Remove the value, rotate it if it was real, and load it from an environment variable or secret manager.',
        tags: secretsRule.tags
      });
    });
  }
};

function inspectAstForSecrets(line: DiffLine): Finding[] | null {
  const source = parseLineAst(line);
  const findings: Finding[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
      const initializer = node.initializer;
      if (secretPatterns.some((entry) => entry.pattern.test(initializer.getText(source)))) {
        findings.push(
          createFinding({
            ruleId: secretsRule.id,
            severity: 'critical',
            confidence: 'high',
            title: `${labelForSecretName(node.name.text)} committed in code`,
            description: 'The diff adds credential-like material. AI agents often inline examples that become real secrets.',
            line,
            recommendation: 'Remove the value, rotate it if it was real, and load it from an environment variable or secret manager.',
            tags: secretsRule.tags
          })
        );
      }
    }

    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
      const initializer = node.initializer;
      if (initializer && secretPatterns.some((entry) => entry.pattern.test(initializer.getText(source)))) {
        findings.push(
          createFinding({
            ruleId: secretsRule.id,
            severity: 'critical',
            confidence: 'high',
            title: `${labelForSecretName(node.name.text)} committed in code`,
            description: 'The diff adds credential-like material. AI agents often inline examples that become real secrets.',
            line,
            recommendation: 'Remove the value, rotate it if it was real, and load it from an environment variable or secret manager.',
            tags: secretsRule.tags
          })
        );
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return findings.length > 0 ? findings : null;
}

function labelForSecretName(name: string): string {
  if (/api[_-]?key/i.test(name)) {
    return 'API key';
  }

  if (/secret/i.test(name)) {
    return 'Secret';
  }

  if (/token/i.test(name)) {
    return 'Token';
  }

  if (/password|passwd/i.test(name)) {
    return 'Password';
  }

  return 'Credential';
}
