import { describe, expect, it } from 'vitest';
import { auditDiff } from '../audit.js';

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
});
