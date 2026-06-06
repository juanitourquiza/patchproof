import { describe, expect, it } from 'vitest';
import { parseArgs } from '../args.js';

describe('parseArgs', () => {
  it('parses paudit options', () => {
    expect(parseArgs(['paudit', '--file', 'changes.diff', '--format', 'sarif', '--fail-on', 'medium', '--lang', 'es'])).toEqual({
      command: 'paudit',
      file: 'changes.diff',
      targetPath: undefined,
      useGitDiff: false,
      includeIgnored: false,
      apiBaseUrl: undefined,
      apiBaseUrlProvided: false,
      projectName: undefined,
      projectNameProvided: false,
      projectSlug: undefined,
      projectSlugProvided: false,
      save: false,
      saveProvided: false,
      output: 'sarif',
      outputProvided: true,
      report: undefined,
      reportProvided: false,
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
      targetPath: undefined,
      useGitDiff: true,
      includeIgnored: false,
      apiBaseUrl: undefined,
      apiBaseUrlProvided: false,
      projectName: undefined,
      projectNameProvided: false,
      projectSlug: undefined,
      projectSlugProvided: false,
      save: false,
      saveProvided: false,
      output: null,
      outputProvided: false,
      report: undefined,
      reportProvided: false,
      failOn: null,
      failOnProvided: false,
      lang: null,
      langProvided: false
    });
  });

  it('keeps audit as a compatibility alias', () => {
    expect(parseArgs(['audit', '--diff']).command).toBe('audit');
  });

  it('parses ppscan options and repo path', () => {
    expect(parseArgs(['ppscan', '/tmp/project', '--include-ignored', '--format', 'markdown'])).toEqual({
      command: 'ppscan',
      file: undefined,
      targetPath: '/tmp/project',
      useGitDiff: false,
      includeIgnored: true,
      apiBaseUrl: undefined,
      apiBaseUrlProvided: false,
      projectName: undefined,
      projectNameProvided: false,
      projectSlug: undefined,
      projectSlugProvided: false,
      save: false,
      saveProvided: false,
      output: 'markdown',
      outputProvided: true,
      report: undefined,
      reportProvided: false,
      failOn: null,
      failOnProvided: false,
      lang: null,
      langProvided: false
    });
  });

  it('parses the interactive scan command with backend options', () => {
    expect(
      parseArgs([
        'scan',
        '/tmp/project',
        '--save',
        '--api-base-url',
        'http://127.0.0.1:8000/api',
        '--project-name',
        'My Repo',
        '--project-slug',
        'my-repo'
      ])
    ).toEqual({
      command: 'scan',
      file: undefined,
      targetPath: '/tmp/project',
      useGitDiff: false,
      includeIgnored: false,
      apiBaseUrl: 'http://127.0.0.1:8000/api',
      apiBaseUrlProvided: true,
      projectName: 'My Repo',
      projectNameProvided: true,
      projectSlug: 'my-repo',
      projectSlugProvided: true,
      save: true,
      saveProvided: true,
      output: null,
      outputProvided: false,
      report: undefined,
      reportProvided: false,
      failOn: null,
      failOnProvided: false,
      lang: null,
      langProvided: false
    });
  });

  it('parses report command and output file', () => {
    expect(parseArgs(['report', '/tmp/project', '--report', 'patchproof-report.md'])).toEqual({
      command: 'report',
      file: undefined,
      targetPath: '/tmp/project',
      useGitDiff: false,
      includeIgnored: false,
      apiBaseUrl: undefined,
      apiBaseUrlProvided: false,
      projectName: undefined,
      projectNameProvided: false,
      projectSlug: undefined,
      projectSlugProvided: false,
      save: false,
      saveProvided: false,
      output: null,
      outputProvided: false,
      report: 'patchproof-report.md',
      reportProvided: true,
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
