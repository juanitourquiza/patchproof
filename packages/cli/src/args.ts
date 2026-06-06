export type OutputFormat = 'text' | 'json' | 'markdown' | 'sarif';
export type Language = 'en' | 'es';

export interface CliOptions {
  readonly command: 'paudit' | 'audit' | 'ppscan' | 'scan' | 'report' | 'init' | 'rules' | 'help' | 'version';
  readonly file?: string;
  readonly targetPath?: string;
  readonly useGitDiff: boolean;
  readonly includeIgnored: boolean;
  readonly apiBaseUrl?: string;
  readonly apiBaseUrlProvided: boolean;
  readonly projectName?: string;
  readonly projectNameProvided: boolean;
  readonly projectSlug?: string;
  readonly projectSlugProvided: boolean;
  readonly save: boolean;
  readonly saveProvided: boolean;
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
const commandNames = new Set<CliOptions['command']>(['paudit', 'audit', 'ppscan', 'scan', 'report', 'init', 'rules', 'help', 'version']);

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

  if (command !== 'audit' && command !== 'paudit' && command !== 'ppscan' && command !== 'scan' && command !== 'report') {
    return defaultOptions('help');
  }

  let file: string | undefined;
  let targetPath: string | undefined;
  let useGitDiff = false;
  let includeIgnored = false;
  let apiBaseUrl: string | undefined;
  let apiBaseUrlProvided = false;
  let projectName: string | undefined;
  let projectNameProvided = false;
  let projectSlug: string | undefined;
  let projectSlugProvided = false;
  let save = false;
  let saveProvided = false;
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

    if ((command === 'ppscan' || command === 'report' || command === 'scan') && !value.startsWith('--') && !targetPath) {
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

    if (value === '--api-base-url') {
      apiBaseUrl = requiredValue(options, index, '--api-base-url');
      apiBaseUrlProvided = true;
      index += 1;
      continue;
    }

    if (value === '--project-name') {
      projectName = requiredValue(options, index, '--project-name');
      projectNameProvided = true;
      index += 1;
      continue;
    }

    if (value === '--project-slug') {
      projectSlug = requiredValue(options, index, '--project-slug');
      projectSlugProvided = true;
      index += 1;
      continue;
    }

    if (value === '--save') {
      save = true;
      saveProvided = true;
      continue;
    }

    if (value === '--no-save') {
      save = false;
      saveProvided = true;
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
    apiBaseUrl,
    apiBaseUrlProvided,
    projectName,
    projectNameProvided,
    projectSlug,
    projectSlugProvided,
    save,
    saveProvided,
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
    apiBaseUrl: undefined,
    apiBaseUrlProvided: false,
    projectName: undefined,
    projectNameProvided: false,
    projectSlug: undefined,
    projectSlugProvided: false,
    save: false,
    saveProvided: false,
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
