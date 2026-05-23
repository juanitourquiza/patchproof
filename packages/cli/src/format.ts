import type { AuditResult, Finding } from '@patchproof/core';
import type { Language, OutputFormat } from './args.js';

export function formatResult(result: AuditResult, format: OutputFormat, lang: Language = 'en'): string {
  if (format === 'json') {
    return JSON.stringify(localizeResult(result, lang), null, 2);
  }

  if (format === 'markdown') {
    return formatMarkdown(result, lang);
  }

  if (format === 'sarif') {
    return JSON.stringify(formatSarif(result, lang), null, 2);
  }

  return formatText(result, lang);
}

export function formatRules(rules: readonly { id: string; title: string; tags: readonly string[] }[]): string {
  return rules.map((rule) => `${rule.id}\t${rule.title}\t${rule.tags.join(',')}`).join('\n');
}

function formatText(result: AuditResult, lang: Language): string {
  const text = copyText[lang];
  const lines = [
    text.summary(result.summary.total, result.summary.filesScanned),
    text.severity(result.summary.critical, result.summary.high, result.summary.medium, result.summary.low)
  ];

  for (const finding of result.findings) {
    lines.push('');
    lines.push(`[${finding.severity.toUpperCase()}] ${finding.ruleId} ${copyFinding[lang][finding.ruleId]?.title ?? finding.title}`);
    lines.push(`  ${finding.file}:${finding.line}`);
    lines.push(`  ${copyFinding[lang][finding.ruleId]?.description ?? finding.description}`);
    lines.push(`  ${text.fix}: ${copyFinding[lang][finding.ruleId]?.recommendation ?? finding.recommendation}`);
  }

  return lines.join('\n');
}

function formatMarkdown(result: AuditResult, lang: Language): string {
  const text = copyText[lang];
  const lines = [
    text.heading,
    '',
    text.summaryMarkdown(result.summary.total, result.summary.filesScanned),
    '',
    text.tableHeader,
    '|---|---|---|---|---|'
  ];

  for (const finding of result.findings) {
    const localized = copyFinding[lang][finding.ruleId];
    lines.push(
      `| ${finding.severity} | ${finding.ruleId} | ${finding.file}:${finding.line} | ${escapePipe(
        localized?.title ?? finding.title
      )} | ${escapePipe(localized?.recommendation ?? finding.recommendation)} |`
    );
  }

  return lines.join('\n');
}

function formatSarif(result: AuditResult, lang: Language): unknown {
  const localized = localizeResult(result, lang);
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'PatchProof',
            informationUri: 'https://github.com/patchproof/patchproof',
            rules: uniqueRules(localized.findings)
          }
        },
        results: localized.findings.map((finding) => ({
          ruleId: finding.ruleId,
          level: sarifLevel(finding),
          message: {
            text: `${copyFinding[lang][finding.ruleId]?.title ?? finding.title}: ${copyFinding[lang][finding.ruleId]?.recommendation ?? finding.recommendation}`
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: finding.file
                },
                region: {
                  startLine: finding.line
                }
              }
            }
          ]
        }))
      }
    ]
  };
}

function uniqueRules(findings: Finding[]): unknown[] {
  const rules = new Map<string, Finding>();
  for (const finding of findings) {
    rules.set(finding.ruleId, finding);
  }

  return [...rules.values()].map((finding) => ({
    id: finding.ruleId,
    name: finding.title,
    shortDescription: {
      text: finding.title
    },
    fullDescription: {
      text: finding.description
    },
    help: {
      text: finding.recommendation
    },
    properties: {
      tags: finding.tags
    }
  }));
}

function localizeResult(result: AuditResult, lang: Language): AuditResult {
  return {
    summary: result.summary,
    findings: result.findings.map((finding) => {
      const localized = copyFinding[lang][finding.ruleId];
      if (!localized) {
        return finding;
      }

      return {
        ...finding,
        title: localized.title,
        description: localized.description,
        recommendation: localized.recommendation
      };
    })
  };
}

const copyText: Record<Language, {
  heading: string;
  summary(total: number, files: number): string;
  summaryMarkdown(total: number, files: number): string;
  severity(critical: number, high: number, medium: number, low: number): string;
  fix: string;
  tableHeader: string;
}> = {
  en: {
    heading: '# PatchProof Report',
    summary: (total, files) => `PatchProof found ${total} finding(s) across ${files} file(s).`,
    summaryMarkdown: (total, files) => `Found **${total}** finding(s) across **${files}** file(s).`,
    severity: (critical, high, medium, low) =>
      `Severity: ${critical} critical, ${high} high, ${medium} medium, ${low} low`,
    fix: 'Fix',
    tableHeader: '| Severity | Rule | Location | Finding | Recommendation |'
  },
  es: {
    heading: '# Informe PatchProof',
    summary: (total, files) => `PatchProof encontró ${total} hallazgo(s) en ${files} archivo(s).`,
    summaryMarkdown: (total, files) => `Se encontraron **${total}** hallazgo(s) en **${files}** archivo(s).`,
    severity: (critical, high, medium, low) =>
      `Severidad: ${critical} crítico(s), ${high} alto(s), ${medium} medio(s), ${low} bajo(s)`,
    fix: 'Corrección',
    tableHeader: '| Severidad | Regla | Ubicación | Hallazgo | Recomendación |'
  }
};

const copyFinding: Record<Language, Record<string, { title: string; description: string; recommendation: string }>> = {
  en: {
    PP001: {
      title: 'OpenAI API key committed in code',
      description: 'The diff adds credential-like material. AI agents often inline examples that become real secrets.',
      recommendation: 'Remove the value, rotate it if it was real, and load it from an environment variable or secret manager.'
    },
    PP002: {
      title: 'SQL query appears to include interpolated input',
      description: 'The added line builds a SQL statement with string concatenation or template interpolation.',
      recommendation: 'Use parameterized queries, prepared statements, or the framework query builder with bound values.'
    },
    PP003: {
      title: 'Potential XSS sink added',
      description: 'The diff introduces an API that can render unsanitized HTML.',
      recommendation: 'Prefer text rendering. If HTML is required, sanitize input with a trusted sanitizer and document the trust boundary.'
    },
    PP004: {
      title: 'Dynamic execution API added',
      description: 'The diff adds an API that can execute code or shell commands.',
      recommendation: 'Avoid dynamic execution. If command execution is required, use fixed commands, argument arrays, and strict allowlists.'
    },
    PP005: {
      title: 'Wildcard CORS origin added',
      description: 'The diff permits requests from any origin, which is often copied from AI examples into production code.',
      recommendation: 'Restrict CORS origins per environment and avoid wildcard origins for authenticated APIs.'
    }
  },
  es: {
    PP001: {
      title: 'Clave API de OpenAI comprometida en código',
      description: 'El diff agrega material que parece una credencial. Los agentes de IA suelen insertar ejemplos que terminan siendo secretos reales.',
      recommendation: 'Elimina el valor, rótalo si era real y cárgalo desde una variable de entorno o un gestor de secretos.'
    },
    PP002: {
      title: 'La consulta SQL parece incluir entrada interpolada',
      description: 'La línea agregada construye una sentencia SQL con concatenación de cadenas o interpolación de templates.',
      recommendation: 'Usa consultas parametrizadas, prepared statements o el query builder del framework con valores vinculados.'
    },
    PP003: {
      title: 'Se agregó un posible punto de inyección XSS',
      description: 'El diff introduce una API que puede renderizar HTML sin sanitizar.',
      recommendation: 'Prefiere renderizar texto. Si necesitas HTML, sanitiza la entrada con un sanitizador confiable y documenta la frontera de confianza.'
    },
    PP004: {
      title: 'Se agregó una API de ejecución dinámica',
      description: 'El diff añade una API que puede ejecutar código o comandos de shell.',
      recommendation: 'Evita la ejecución dinámica. Si necesitas ejecutar comandos, usa comandos fijos, arreglos de argumentos y allowlists estrictas.'
    },
    PP005: {
      title: 'Se agregó un origen CORS comodín',
      description: 'El diff permite solicitudes desde cualquier origen, algo que suele copiarse desde ejemplos de IA a producción.',
      recommendation: 'Restringe los orígenes CORS por entorno y evita comodines en APIs autenticadas.'
    }
  }
};

function sarifLevel(finding: Finding): 'error' | 'warning' | 'note' {
  if (finding.severity === 'critical' || finding.severity === 'high') {
    return 'error';
  }

  if (finding.severity === 'medium') {
    return 'warning';
  }

  return 'note';
}

function escapePipe(value: string): string {
  return value.replaceAll('|', '\\|');
}
