export type OutputFormat = 'text' | 'json' | 'markdown' | 'sarif';

export interface CliOptions {
  readonly command: 'audit' | 'init' | 'rules' | 'help' | 'version';
  readonly file?: string;
  readonly useGitDiff: boolean;
  readonly output: OutputFormat;
  readonly failOn: 'critical' | 'high' | 'medium' | 'low';
}

const validFormats = new Set<OutputFormat>(['text', 'json', 'markdown', 'sarif']);
const validSeverities = new Set<CliOptions['failOn']>(['critical', 'high', 'medium', 'low']);

export function parseArgs(argv: string[]): CliOptions {
  const [command = 'help', ...rest] = argv;

  if (command === '--version' || command === '-v') {
    return defaultOptions('version');
  }

  if (command === '--help' || command === '-h') {
    return defaultOptions('help');
  }

  if (command === 'init') {
    return defaultOptions('init');
  }

  if (command === 'rules') {
    return defaultOptions('rules');
  }

  if (command !== 'audit') {
    return defaultOptions('help');
  }

  let file: string | undefined;
  let useGitDiff = false;
  let output: OutputFormat = 'text';
  let failOn: CliOptions['failOn'] = 'high';

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];

    if (value === '--file') {
      file = requiredValue(rest, index, '--file');
      index += 1;
      continue;
    }

    if (value === '--diff') {
      useGitDiff = true;
      continue;
    }

    if (value === '--format') {
      const candidate = requiredValue(rest, index, '--format') as OutputFormat;
      if (!validFormats.has(candidate)) {
        throw new Error(`Invalid --format "${candidate}". Use text, json, markdown, or sarif.`);
      }
      output = candidate;
      index += 1;
      continue;
    }

    if (value === '--fail-on') {
      const candidate = requiredValue(rest, index, '--fail-on') as CliOptions['failOn'];
      if (!validSeverities.has(candidate)) {
        throw new Error(`Invalid --fail-on "${candidate}". Use critical, high, medium, or low.`);
      }
      failOn = candidate;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option "${value}".`);
  }

  return { command: 'audit', file, useGitDiff, output, failOn };
}

function defaultOptions(command: CliOptions['command']): CliOptions {
  return {
    command,
    useGitDiff: false,
    output: 'text',
    failOn: 'high'
  };
}

function requiredValue(values: string[], index: number, option: string): string {
  const value = values[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}
