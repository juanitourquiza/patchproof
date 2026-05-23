import type { AuditResult, Finding } from '@patchproof/core';
import type { OutputFormat } from './args.js';

export function formatResult(result: AuditResult, format: OutputFormat): string {
  if (format === 'json') {
    return JSON.stringify(result, null, 2);
  }

  if (format === 'markdown') {
    return formatMarkdown(result);
  }

  if (format === 'sarif') {
    return JSON.stringify(formatSarif(result), null, 2);
  }

  return formatText(result);
}

export function formatRules(rules: readonly { id: string; title: string; tags: readonly string[] }[]): string {
  return rules.map((rule) => `${rule.id}\t${rule.title}\t${rule.tags.join(',')}`).join('\n');
}

function formatText(result: AuditResult): string {
  const lines = [
    `PatchProof found ${result.summary.total} finding(s) across ${result.summary.filesScanned} file(s).`,
    `Severity: ${result.summary.critical} critical, ${result.summary.high} high, ${result.summary.medium} medium, ${result.summary.low} low`
  ];

  for (const finding of result.findings) {
    lines.push('');
    lines.push(`[${finding.severity.toUpperCase()}] ${finding.ruleId} ${finding.title}`);
    lines.push(`  ${finding.file}:${finding.line}`);
    lines.push(`  ${finding.description}`);
    lines.push(`  Fix: ${finding.recommendation}`);
  }

  return lines.join('\n');
}

function formatMarkdown(result: AuditResult): string {
  const lines = [
    '# PatchProof Report',
    '',
    `Found **${result.summary.total}** finding(s) across **${result.summary.filesScanned}** file(s).`,
    '',
    '| Severity | Rule | Location | Finding | Recommendation |',
    '|---|---|---|---|---|'
  ];

  for (const finding of result.findings) {
    lines.push(
      `| ${finding.severity} | ${finding.ruleId} | ${finding.file}:${finding.line} | ${escapePipe(
        finding.title
      )} | ${escapePipe(finding.recommendation)} |`
    );
  }

  return lines.join('\n');
}

function formatSarif(result: AuditResult): unknown {
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'PatchProof',
            informationUri: 'https://github.com/patchproof/patchproof',
            rules: uniqueRules(result.findings)
          }
        },
        results: result.findings.map((finding) => ({
          ruleId: finding.ruleId,
          level: sarifLevel(finding),
          message: {
            text: `${finding.title}: ${finding.recommendation}`
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
