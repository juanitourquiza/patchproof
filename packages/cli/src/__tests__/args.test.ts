import { describe, expect, it } from 'vitest';
import { parseArgs } from '../args.js';

describe('parseArgs', () => {
  it('parses audit options', () => {
    expect(parseArgs(['audit', '--file', 'changes.diff', '--format', 'sarif', '--fail-on', 'medium', '--lang', 'es'])).toEqual({
      command: 'audit',
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
    expect(parseArgs(['audit', '--diff'])).toEqual({
      command: 'audit',
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

  it('rejects invalid formats', () => {
    expect(() => parseArgs(['audit', '--format', 'xml'])).toThrow('Invalid --format');
  });
});
