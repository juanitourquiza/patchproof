import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { scanWorkspace } from '../scan.js';

describe('scanWorkspace', () => {
  it('finds risky patterns in a working tree snapshot', async () => {
    const root = await mkdtemp(join(tmpdir(), 'patchproof-scan-'));
    await mkdir(join(root, 'dist'), { recursive: true });
    await writeFile(
      join(root, 'dist', 'generated.ts'),
      [
        'export const apiKey = "sk-proj-abcdefghijklmnopqrstuvwxyz";',
        'export const query = db.query(`SELECT * FROM users WHERE id = ${userId}`);'
      ].join('\n')
    );

    const result = await scanWorkspace({
      targetPath: root,
      includeIgnored: true
    });

    expect(result.summary.total).toBe(2);
    expect(result.summary.filesScanned).toBeGreaterThanOrEqual(1);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['PP001', 'PP002']);
  });

  it('skips AI-assistant folders even when ignored files are included', async () => {
    const root = await mkdtemp(join(tmpdir(), 'patchproof-scan-ai-'));
    await mkdir(join(root, '.claude', 'skills'), { recursive: true });
    await writeFile(
      join(root, '.claude', 'skills', 'prompt.md'),
      [
        'export const apiKey = "sk-proj-abcdefghijklmnopqrstuvwxyz";',
        'export const query = db.query(`SELECT * FROM users WHERE id = ${userId}`);'
      ].join('\n')
    );
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'safe.ts'), 'export const ok = true;');

    const result = await scanWorkspace({
      targetPath: root,
      includeIgnored: true
    });

    expect(result.summary.total).toBe(0);
    expect(result.summary.filesScanned).toBe(1);
    expect(result.findings).toEqual([]);
  });
});
