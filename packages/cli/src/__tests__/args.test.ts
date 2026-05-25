import { describe, expect, it } from 'vitest';
import { parseArgs } from '../args.js';

describe('parseArgs', () => {
  it('parses paudit options', () => {
    expect(parseArgs(['paudit', '--file', 'changes.diff', '--format', 'sarif', '--fail-on', 'medium', '--lang', 'es'])).toEqual({
      command: 'paudit',
      file: 'changes.diff',
      useGitDiff: false,
      output: 'sarif',
      outputProvided: true,
      failOn: 'medium',
      failOnProvided: true,
      lang: 'es',
      langProvided: true
    });
  });

  it('marks defaults when no overrides are provided', () => {
    expect(parseArgs(['paudit', '--diff'])).toEqual({
      command: 'paudit',
      file: undefined,
      useGitDiff: true,
      output: null,
      outputProvided: false,
      failOn: null,
      failOnProvided: false,
      lang: null,
      langProvided: false
    });
  });

  it('keeps audit as a compatibility alias', () => {
    expect(parseArgs(['audit', '--diff']).command).toBe('audit');
  });

  it('rejects invalid formats', () => {
    expect(() => parseArgs(['audit', '--format', 'xml'])).toThrow('Invalid --format');
  });
});
