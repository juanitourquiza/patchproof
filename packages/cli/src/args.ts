export type OutputFormat = 'text' | 'json' | 'markdown' | 'sarif';
export type Language = 'en' | 'es';

export interface CliOptions {
  readonly command: 'paudit' | 'audit' | 'ppscan' | 'report' | 'init' | 'rules' | 'help' | 'version';
  readonly file?: string;
  readonly targetPath?: string;
  readonly useGitDiff: boolean;
  readonly includeIgnored: boolean;
  readonly output: OutputFormat | null;
  readonly outputProvided: boolean;
  readonly report?: string;
  readonly reportProvided: boolean;
  readonly failOn: 'critical' | 'high' | 'medium' | 'low' | null;
  readonly failOnProvided: boolean;
  readonly lang: Language | null;
  readonly langProvided: boolean;
}

const validFormats = new Set<OutputFormat>(['text', 'json', 'markdown', 'sarif']);
const validSeverities = new Set<CliOptions['failOn']>(['critical', 'high', 'medium', 'low']);
const validLanguages = new Set<Language>(['en', 'es']);
const commandNames = new Set<CliOptions['command']>(['paudit', 'audit', 'ppscan', 'report', 'init', 'rules', 'help', 'version']);

export function parseArgs(argv: string[], runtimeName = ''): CliOptions {
  const [first = 'help', ...rest] = argv;
  const runtimeCommand = runtimeName ? runtimeName.split(/[\\/]/).pop() : '';
  const defaultScanCommand = runtimeCommand === 'ppscan';

  if (first === '--version' || first === '-v') {
    return defaultOptions('version');
  }

  if (first === '--help' || first === '-h') {
    return defaultOptions('help');
  }

  let command: CliOptions['command'];
  let options = rest;

  if (commandNames.has(first as CliOptions['command'])) {
    command = first as CliOptions['command'];
  } else if (defaultScanCommand) {
    command = 'ppscan';
    options = argv;
  } else {
    return defaultOptions('help');
  }

  if (command === 'init' || command === 'rules') {
    return defaultOptions(command);
  }

  if (command !== 'audit' && command !== 'paudit' && command !== 'ppscan' && command !== 'report') {
    return defaultOptions('help');
  }

  let file: string | undefined;
  let targetPath: string | undefined;
  let useGitDiff = false;
  let includeIgnored = false;
  let output: OutputFormat | null = null;
  let outputProvided = false;
  let report: string | undefined;
  let reportProvided = false;
  let failOn: CliOptions['failOn'] = null;
  let failOnProvided = false;
  let lang: Language | null = null;
  let langProvided = false;

  for (let index = 0; index < options.length; index += 1) {
    const value = options[index];

    if (value === '--file') {
      file = requiredValue(options, index, '--file');
      index += 1;
      continue;
    }

    if ((command === 'ppscan' || command === 'report') && !value.startsWith('--') && !targetPath) {
      targetPath = value;
      continue;
    }

    if (value === '--diff') {
      useGitDiff = true;
      continue;
    }

    if (value === '--include-ignored') {
      includeIgnored = true;
      continue;
    }

    if (value === '--format') {
      const candidate = requiredValue(options, index, '--format') as OutputFormat;
      if (!validFormats.has(candidate)) {
        throw new Error(`Invalid --format "${candidate}". Use text, json, markdown, or sarif.`);
      }
      output = candidate;
      outputProvided = true;
      index += 1;
      continue;
    }

    if (value === '--report') {
      report = requiredValue(options, index, '--report');
      reportProvided = true;
      index += 1;
      continue;
    }

    if (value === '--fail-on') {
      const candidate = requiredValue(options, index, '--fail-on') as CliOptions['failOn'];
      if (!validSeverities.has(candidate)) {
        throw new Error(`Invalid --fail-on "${candidate}". Use critical, high, medium, or low.`);
      }
      failOn = candidate;
      failOnProvided = true;
      index += 1;
      continue;
    }

    if (value === '--lang') {
      const candidate = requiredValue(options, index, '--lang') as Language;
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
    targetPath,
    useGitDiff,
    includeIgnored,
    output,
    outputProvided,
    report,
    reportProvided,
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
    includeIgnored: false,
    output: 'text',
    outputProvided: false,
    report: undefined,
    reportProvided: false,
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
