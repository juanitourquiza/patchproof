import { describe, expect, it } from 'vitest';
import { parseArgs } from '../args.js';

describe('parseArgs', () => {
  it('parses audit options', () => {
    expect(parseArgs(['audit', '--file', 'changes.diff', '--format', 'sarif', '--fail-on', 'medium'])).toEqual({
      command: 'audit',
      file: 'changes.diff',
      useGitDiff: false,
      output: 'sarif',
      failOn: 'medium'
    });
  });

  it('rejects invalid formats', () => {
    expect(() => parseArgs(['audit', '--format', 'xml'])).toThrow('Invalid --format');
  });
});
