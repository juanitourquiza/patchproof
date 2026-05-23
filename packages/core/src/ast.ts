import ts from 'typescript';
import type { DiffLine } from './types.js';

export function parseLineAst(line: DiffLine): ts.SourceFile {
  const kind = inferScriptKind(line.filePath);
  return ts.createSourceFile(line.filePath, line.content, ts.ScriptTarget.Latest, true, kind);
}

export function getPropertyName(node: ts.Node): string | null {
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text;
  }

  if (ts.isIdentifier(node)) {
    return node.text;
  }

  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }

  return null;
}

export function getCallName(node: ts.CallExpression): string | null {
  if (ts.isIdentifier(node.expression)) {
    return node.expression.text;
  }

  if (ts.isPropertyAccessExpression(node.expression)) {
    return node.expression.name.text;
  }

  if (ts.isElementAccessExpression(node.expression) && ts.isStringLiteral(node.expression.argumentExpression)) {
    return node.expression.argumentExpression.text;
  }

  return null;
}

export function hasStringInterpolation(node: ts.Node): boolean {
  let interpolated = false;

  const visit = (current: ts.Node): void => {
    if (interpolated) {
      return;
    }

    if (ts.isTemplateExpression(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
      interpolated = true;
      return;
    }

    if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      interpolated = true;
      return;
    }

    ts.forEachChild(current, visit);
  };

  visit(node);
  return interpolated;
}

export function hasSuspiciousSecretAssignment(line: DiffLine): boolean {
  const source = parseLineAst(line);
  let found = false;

  const visit = (node: ts.Node): void => {
    if (found) {
      return;
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (isSecretName(node.name.text) && ts.isStringLiteralLike(node.initializer)) {
        found = true;
        return;
      }
    }

    if (ts.isPropertyAssignment(node) && isPropertyName(node.name) && node.initializer) {
      if (isSecretName(getText(node.name)) && ts.isStringLiteralLike(node.initializer)) {
        found = true;
        return;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
}

export function hasSqlInjectionPattern(line: DiffLine): boolean {
  const source = parseLineAst(line);
  let found = false;

  const visit = (node: ts.Node): void => {
    if (found) {
      return;
    }

    if (ts.isCallExpression(node)) {
      const callName = getCallName(node);
      if (callName && isSqlApiName(callName) && node.arguments.some((argument) => hasStringInterpolation(argument))) {
        found = true;
        return;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
}

export function hasUnsafeHtmlPattern(line: DiffLine): boolean {
  const source = parseLineAst(line);
  let found = false;

  const visit = (node: ts.Node): void => {
    if (found) {
      return;
    }

    if (ts.isPropertyAssignment(node) && isPropertyName(node.name)) {
      const propertyName = getText(node.name);
      if (isUnsafeHtmlName(propertyName)) {
        found = true;
        return;
      }
    }

    if (ts.isCallExpression(node)) {
      const callName = getCallName(node);
      if (callName && isUnsafeHtmlName(callName)) {
        found = true;
        return;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
}

export function hasDangerousExecutionPattern(line: DiffLine): boolean {
  const source = parseLineAst(line);
  let found = false;

  const visit = (node: ts.Node): void => {
    if (found) {
      return;
    }

    if (ts.isCallExpression(node)) {
      const callName = getCallName(node);
      if (callName && isDangerousExecutionName(callName)) {
        found = true;
        return;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
}

export function hasWildcardCorsPattern(line: DiffLine): boolean {
  const source = parseLineAst(line);
  let found = false;

  const visit = (node: ts.Node): void => {
    if (found) {
      return;
    }

    if (ts.isPropertyAssignment(node) && isPropertyName(node.name)) {
      const propertyName = getText(node.name);
      if (/^(origin|allowed_origins|Access-Control-Allow-Origin)$/i.test(propertyName) && isWildcardValue(node.initializer)) {
        found = true;
        return;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
}

function inferScriptKind(filePath: string): ts.ScriptKind {
  if (filePath.endsWith('.tsx')) {
    return ts.ScriptKind.TSX;
  }

  if (filePath.endsWith('.jsx')) {
    return ts.ScriptKind.JSX;
  }

  if (filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.cjs')) {
    return ts.ScriptKind.JS;
  }

  return ts.ScriptKind.TS;
}

function isPropertyName(node: ts.Node): node is ts.PropertyName {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node);
}

function getText(node: ts.Node): string {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }

  return node.getText();
}

function isSecretName(name: string): boolean {
  return /api[_-]?key|secret|token|password|passwd/i.test(name);
}

function isSqlApiName(name: string): boolean {
  return /^(query|raw|execute|exec|statement|select)$/i.test(name);
}

function isUnsafeHtmlName(name: string): boolean {
  return /^(innerHTML|outerHTML|insertAdjacentHTML|bypassSecurityTrustHtml|dangerouslySetInnerHTML)$/i.test(name);
}

function isDangerousExecutionName(name: string): boolean {
  return /^(eval|Function|execSync|spawnSync|shell_exec|passthru|system)$/i.test(name) || name === 'exec' || name === 'spawn';
}

function isWildcardValue(node: ts.Node): boolean {
  if (ts.isStringLiteralLike(node)) {
    return node.text === '*';
  }

  return hasStringInterpolation(node) || node.getText().includes('*');
}
