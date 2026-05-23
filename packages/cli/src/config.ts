import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { AuditRule, Severity } from '@patchproof/core';
import type { Language } from './args.js';

export interface PatchProofConfig {
  readonly schema?: string;
  readonly failOn?: Severity;
  readonly language?: Language;
  readonly privacy?: {
    readonly sendCodeToCloud?: boolean;
    readonly llmExplanations?: boolean;
  };
  readonly rules?: {
    readonly enabled?: string[];
    readonly disabled?: string[];
  };
}

export interface ResolvedCliConfig {
  readonly configPath: string | null;
  readonly config: PatchProofConfig | null;
}

export function loadConfig(startDir = process.cwd()): ResolvedCliConfig {
  const configPath = findConfigFile(startDir);

  if (!configPath) {
    return { configPath: null, config: null };
  }

  const raw = readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw) as PatchProofConfig;

  return { configPath, config };
}

export function resolveAuditRules(allRules: readonly AuditRule[], config: PatchProofConfig | null): AuditRule[] {
  if (!config?.rules) {
    return [...allRules];
  }

  const enabled = config.rules.enabled?.length ? new Set(config.rules.enabled) : null;
  const disabled = config.rules.disabled?.length ? new Set(config.rules.disabled) : null;

  return allRules.filter((rule) => {
    if (enabled && !enabled.has(rule.id)) {
      return false;
    }

    if (disabled && disabled.has(rule.id)) {
      return false;
    }

    return true;
  });
}

export function resolveFailOn(cliValue: Severity | null, config: PatchProofConfig | null): Severity {
  return cliValue ?? config?.failOn ?? 'high';
}

export function resolveLanguage(cliValue: Language | null, config: PatchProofConfig | null): Language {
  return cliValue ?? config?.language ?? 'en';
}

function findConfigFile(startDir: string): string | null {
  let current = resolve(startDir);

  while (true) {
    const candidate = join(current, 'patchproof.config.json');
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}
