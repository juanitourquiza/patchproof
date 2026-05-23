import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { builtInRules } from '@patchproof/core';
import { loadConfig, resolveAuditRules, resolveFailOn, resolveLanguage } from '../config.js';

describe('config', () => {
  it('loads config from the current directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'patchproof-config-'));
    writeFileSync(
      join(root, 'patchproof.config.json'),
      JSON.stringify(
        {
          failOn: 'medium',
          language: 'es',
          rules: {
            enabled: ['PP001', 'PP003']
          }
        },
        null,
        2
      )
    );

    const result = loadConfig(root);

    expect(result.configPath).toBe(join(root, 'patchproof.config.json'));
    expect(result.config?.failOn).toBe('medium');
    expect(result.config?.language).toBe('es');
  });

  it('resolves rules and fail-on from config when the CLI does not override them', () => {
    const filteredRules = resolveAuditRules(
      builtInRules,
      {
        rules: {
          enabled: ['PP001', 'PP003']
        }
      }
    );

    expect(filteredRules.map((rule) => rule.id)).toEqual(['PP001', 'PP003']);
    expect(resolveFailOn(null, { failOn: 'medium' })).toBe('medium');
    expect(resolveFailOn('high', { failOn: 'low' })).toBe('high');
    expect(resolveLanguage(null, { language: 'es' })).toBe('es');
    expect(resolveLanguage('en', { language: 'es' })).toBe('en');
  });

  it('finds config in a parent directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'patchproof-parent-'));
    const nested = join(root, 'repo', 'packages', 'cli');
    mkdirSync(nested, { recursive: true });
    writeFileSync(
      join(root, 'patchproof.config.json'),
      JSON.stringify(
        {
          failOn: 'low'
        },
        null,
        2
      )
    );

    const result = loadConfig(nested);

    expect(result.configPath).toBe(join(root, 'patchproof.config.json'));
    expect(result.config?.failOn).toBe('low');
  });
});
