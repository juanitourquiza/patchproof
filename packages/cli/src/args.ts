export type OutputFormat = 'text' | 'json' | 'markdown' | 'sarif';
export type Language = 'en' | 'es';

export interface CliOptions {
  readonly command: 'paudit' | 'audit' | 'init' | 'rules' | 'help' | 'version';
  readonly file?: string;
  readonly useGitDiff: boolean;
  readonly output: OutputFormat | null;
  readonly outputProvided: boolean;
  readonly failOn: 'critical' | 'high' | 'medium' | 'low' | null;
  readonly failOnProvided: boolean;
  readonly lang: Language | null;
  readonly langProvided: boolean;
}

const validFormats = new Set<OutputFormat>(['text', 'json', 'markdown', 'sarif']);
const validSeverities = new Set<CliOptions['failOn']>(['critical', 'high', 'medium', 'low']);
const validLanguages = new Set<Language>(['en', 'es']);

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

  if (command !== 'audit' && command !== 'paudit') {
    return defaultOptions('help');
  }

  let file: string | undefined;
  let useGitDiff = false;
  let output: OutputFormat | null = null;
  let outputProvided = false;
  let failOn: CliOptions['failOn'] = null;
  let failOnProvided = false;
  let lang: Language | null = null;
  let langProvided = false;

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
      outputProvided = true;
      index += 1;
      continue;
    }

    if (value === '--fail-on') {
      const candidate = requiredValue(rest, index, '--fail-on') as CliOptions['failOn'];
      if (!validSeverities.has(candidate)) {
        throw new Error(`Invalid --fail-on "${candidate}". Use critical, high, medium, or low.`);
      }
      failOn = candidate;
      failOnProvided = true;
      index += 1;
      continue;
    }

    if (value === '--lang') {
      const candidate = requiredValue(rest, index, '--lang') as Language;
      if (!validLanguages.has(candidate)) {
        throw new Error(`Invalid --lang "${candidate}". Use en or es.`);
      }
      lang = candidate;
      langProvided = true;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option "${value}".`);
  }

  return {
    command,
    file,
    useGitDiff,
    output,
    outputProvided,
    failOn,
    failOnProvided,
    lang,
    langProvided
  };
}

function defaultOptions(command: CliOptions['command']): CliOptions {
  return {
    command,
    useGitDiff: false,
    output: 'text',
    outputProvided: false,
    failOn: null,
    failOnProvided: false,
    lang: null,
    langProvided: false
  };
}

function requiredValue(values: string[], index: number, option: string): string {
  const value = values[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}
