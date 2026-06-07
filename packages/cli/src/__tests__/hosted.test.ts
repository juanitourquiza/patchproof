import { describe, expect, it } from 'vitest';
import { buildScanPayload, defaultProjectName, defaultProjectSlug, summarizeScan } from '../hosted.js';

describe('hosted scan helpers', () => {
  it('derives a stable project identity from the repository path', () => {
    expect(defaultProjectName('/tmp/My App')).toBe('My App');
    expect(defaultProjectSlug('My App')).toBe('my-app');
    expect(defaultProjectSlug('My App', '/tmp/My App')).toMatch(/^my-app-[a-f0-9]{6}$/);
  });

  it('computes a clean result card for empty scans', () => {
    expect(
      summarizeScan({
        summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, filesScanned: 0 },
        findings: []
      })
    ).toEqual({
      score: 100,
      verdict: 'clean',
      label: 'Clean result',
      summary: 'No findings were recorded. Keep the clean baseline for future comparisons.',
      recommendation: 'No immediate issues were found. Keep the clean result as a baseline and scan again after the next change.',
      formula: 'Score formula: 100 - (critical × 25) - (high × 15) - (medium × 8) - (low × 3), with a minimum floor of 10.',
      finding_total: 0,
      severity: 'none'
    });
  });

  it('builds a payload that can be saved to the dashboard', () => {
    expect(
      buildScanPayload({
        targetPath: '/tmp/project',
        language: 'en',
        failOn: 'high',
        includeIgnored: false,
        format: 'json',
        result: {
          summary: { total: 1, critical: 0, high: 1, medium: 0, low: 0, filesScanned: 1 },
          findings: [
            {
              id: 'finding-1',
              ruleId: 'PP002',
              severity: 'high',
              confidence: 'high',
              title: 'SQL injection',
              description: 'Example',
              evidence: 'query',
              recommendation: 'Use parameters',
              file: 'src/app.ts',
              line: 42,
              tags: []
            }
          ]
        },
        action: 'save'
      })
    ).toMatchObject({
      project_name: 'project',
      project_slug: expect.stringMatching(/^project-[a-f0-9]{6}$/),
      source: 'cli',
      language: 'en',
      fail_on: 'high',
      format: 'json',
      status: 'completed',
      summary: { total: 1, critical: 0, high: 1, medium: 0, low: 0 },
      metadata: {
        target_path: '/tmp/project',
        repo_name: 'project',
        repo_slug: expect.stringMatching(/^project-[a-f0-9]{6}$/),
        include_ignored: false,
        action: 'save'
      }
    });
  });
});
