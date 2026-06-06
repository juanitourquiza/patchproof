import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { auditDiff } from '../audit.js';

const fixturePath = (category: string, name: string) => new URL(`../../../../docs/fixtures/owasp/${category}/${name}`, import.meta.url);

describe('auditDiff', () => {
  it('reports risky additions in generated code diffs', () => {
    const diff = [
      'diff --git a/src/server.ts b/src/server.ts',
      '--- a/src/server.ts',
      '+++ b/src/server.ts',
      '@@ -1,2 +1,7 @@',
      ' import express from "express";',
      '+const apiKey = "sk-proj-abcdefghijklmnopqrstuvwxyz";',
      '+app.get("/search", (req, res) => db.query(`SELECT * FROM users WHERE name = ${req.query.name}`));',
      '+document.body.innerHTML = req.query.message;',
      '+eval(req.body.script);',
      '+const cors = { origin: "*" };'
    ].join('\n');

    const result = auditDiff(diff);

    expect(result.summary).toMatchObject({
      total: 5,
      critical: 1,
      high: 3,
      medium: 1,
      filesScanned: 1
    });
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP001', 'PP002', 'PP003', 'PP004', 'PP005']);
  });

  it('can filter findings below the configured severity', () => {
    const diff = [
      'diff --git a/config/cors.php b/config/cors.php',
      '--- a/config/cors.php',
      '+++ b/config/cors.php',
      '@@ -1 +1 @@',
      '+allowed_origins = "*"'
    ].join('\n');

    const result = auditDiff(diff, { minimumSeverity: 'high' });

    expect(result.findings).toEqual([]);
    expect(result.summary.total).toBe(0);
  });

  it('detects AST-based execution and SQL patterns that regex-only checks miss', () => {
    const diff = [
      'diff --git a/src/app.ts b/src/app.ts',
      '--- a/src/app.ts',
      '+++ b/src/app.ts',
      '@@ -1 +1,3 @@',
      '+globalThis["eval"](req.body.script);',
      '+db["query"](`SELECT * FROM users WHERE id = ${userId}`);'
    ].join('\n');

    const result = auditDiff(diff);

    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP004', 'PP002']);
  });

  it('flags sensitive public routes without obvious auth middleware', () => {
    const diff = readFileSync(fixturePath('a01', 'public-routes.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(1);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(expect.arrayContaining(['PP006']));
    expect(result.findings.map((finding) => finding.file)).toEqual(expect.arrayContaining(['routes/api.php']));
  });

  it('does not flag obvious public-by-design or already-protected id routes', () => {
    const diff = readFileSync(fixturePath('a01', 'object-level-authorization.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('does not flag obvious public-by-design or protected routes', () => {
    const diff = readFileSync(fixturePath('a01', 'public-routes.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('does not flag sync-style maintenance actions without a destructive business step', () => {
    const diff = readFileSync(fixturePath('a04', 'sync-maintenance.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags php raw sql built with concatenation or interpolation', () => {
    const diff = readFileSync(fixturePath('a03', 'php-sql-injection.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(1);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP002']);
  });

  it('does not flag php raw sql with bindings', () => {
    const diff = readFileSync(fixturePath('a03', 'php-sql-injection.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('does not flag php raw sql with constant expressions and bound parameters', () => {
    const diff = readFileSync(fixturePath('a03', 'php-sql-safe-expressions.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('does not flag php migrations that use trusted database config', () => {
    const diff = readFileSync(fixturePath('a03', 'php-migration-sql.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags php command execution built from user input', () => {
    const diff = readFileSync(fixturePath('a03', 'php-command-injection.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP004', 'PP004']);
  });

  it('does not flag php command execution with static commands', () => {
    const diff = readFileSync(fixturePath('a03', 'php-command-injection.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags debug mode and non-production config in deployment files', () => {
    const diff = readFileSync(fixturePath('a05', 'debug-config.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP008', 'PP008']);
  });

  it('does not flag safe production config values', () => {
    const diff = readFileSync(fixturePath('a05', 'debug-config.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags permissive security headers in deployment config', () => {
    const diff = readFileSync(fixturePath('a05', 'security-headers.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(4);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP009', 'PP009', 'PP009', 'PP009']);
  });

  it('does not flag strict security headers', () => {
    const diff = readFileSync(fixturePath('a05', 'security-headers.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags insecure session cookie settings in env and config files', () => {
    const diff = readFileSync(fixturePath('a05', 'session-cookies.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(3);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP010', 'PP010', 'PP010']);
  });

  it('does not flag secure session cookie settings', () => {
    const diff = readFileSync(fixturePath('a05', 'session-cookies.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags insecure proxy and HTTPS configuration', () => {
    const diff = readFileSync(fixturePath('a05', 'proxy-https.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(3);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP011', 'PP011', 'PP011']);
  });

  it('does not flag strict proxy and HTTPS configuration', () => {
    const diff = readFileSync(fixturePath('a05', 'proxy-https.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags verbose logging and error output in deployment files', () => {
    const diff = readFileSync(fixturePath('a05', 'verbose-logs.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(3);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP012', 'PP012', 'PP012']);
  });

  it('does not flag normal production logging defaults', () => {
    const diff = readFileSync(fixturePath('a05', 'verbose-logs.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags auth endpoints without throttle protection', () => {
    const diff = readFileSync(fixturePath('a07', 'auth-throttle.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP013', 'PP013']);
  });

  it('does not flag auth endpoints with throttle protection', () => {
    const diff = readFileSync(fixturePath('a07', 'auth-throttle.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags weak or empty password values in app code', () => {
    const diff = readFileSync(fixturePath('a07', 'weak-password.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP014', 'PP014']);
  });

  it('does not flag strong password values', () => {
    const diff = readFileSync(fixturePath('a07', 'weak-password.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('does not flag weak passwords outside app code', () => {
    const diff = readFileSync(fixturePath('a07', 'weak-password-nonapp.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags OTP/code validation routes without throttle protection', () => {
    const diff = readFileSync(fixturePath('a07', 'code-validation.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP015', 'PP015']);
  });

  it('does not flag OTP/code validation routes with throttle protection', () => {
    const diff = readFileSync(fixturePath('a07', 'code-validation.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags OTP/code issuance routes without throttle protection', () => {
    const diff = readFileSync(fixturePath('a07', 'code-issue.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP017', 'PP017']);
  });

  it('does not flag OTP/code issuance routes with throttle protection', () => {
    const diff = readFileSync(fixturePath('a07', 'code-issue.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags authenticated password routes without confirmation protection', () => {
    const diff = readFileSync(fixturePath('a07', 'password-confirmation.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(1);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP016']);
  });

  it('does not flag password routes with confirmation protection', () => {
    const diff = readFileSync(fixturePath('a07', 'password-confirmation.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags outbound requests built from user-controlled urls', () => {
    const diff = readFileSync(fixturePath('a10', 'ssrf.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP018', 'PP018']);
  });

  it('does not flag outbound requests to fixed urls', () => {
    const diff = readFileSync(fixturePath('a10', 'ssrf.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('does not flag plain request parameter access', () => {
    const diff = [
      'diff --git a/app/Http/Controllers/ProfileController.php b/app/Http/Controllers/ProfileController.php',
      '--- a/app/Http/Controllers/ProfileController.php',
      '+++ b/app/Http/Controllers/ProfileController.php',
      '@@ -1 +1,3 @@',
      "+public function show(Request $request) { $page = $request->get('page', 1); return response()->json(['page' => $page]); }"
    ].join('\n');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags unsafe php deserialization', () => {
    const diff = readFileSync(fixturePath('a08', 'unsafe-deserialization.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP021', 'PP021']);
  });

  it('does not flag safe json decoding', () => {
    const diff = readFileSync(fixturePath('a08', 'unsafe-deserialization.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags dangerous business actions without an explicit confirmation step', () => {
    const diff = readFileSync(fixturePath('a04', 'insecure-business-action.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP022', 'PP022']);
  });

  it('does not flag dangerous business actions with an explicit confirmation step', () => {
    const diff = readFileSync(fixturePath('a04', 'insecure-business-action.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags swallowed exceptions without logging', () => {
    const diff = readFileSync(fixturePath('a09', 'swallowed-exception.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP023', 'PP023']);
  });

  it('does not flag caught exceptions that are logged', () => {
    const diff = readFileSync(fixturePath('a09', 'swallowed-exception.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags explicitly pinned vulnerable dependency versions', () => {
    const diff = readFileSync(fixturePath('a06', 'vulnerable-dependency.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP019', 'PP019']);
  });

  it('does not flag modern dependency versions', () => {
    const diff = readFileSync(fixturePath('a06', 'vulnerable-dependency.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });

  it('flags explicit weak hashing algorithms in application code', () => {
    const diff = readFileSync(fixturePath('a02', 'weak-hash.vulnerable.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP020', 'PP020']);
  });

  it('does not flag strong hashing algorithms or password hashing helpers', () => {
    const diff = readFileSync(fixturePath('a02', 'weak-hash.safe.diff'), 'utf8');

    const result = auditDiff(diff);

    expect(result.findings).toEqual([]);
  });
});
