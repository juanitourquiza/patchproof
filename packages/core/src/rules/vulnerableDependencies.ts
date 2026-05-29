import { createFinding } from '../finding.js';
import type { AuditRule, Finding } from '../types.js';

const dependencyManifestPattern = /(?:^|\/)(?:package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|composer\.json|composer\.lock)$/i;

const vulnerableDependencyPatterns = [
  { name: 'lodash', pattern: /"lodash"\s*:\s*["'~^]*4\.17\.(?:1[0-9]|20)["']?/i },
  { name: 'lodash', pattern: /lodash@[^\\n]*4\.17\.(?:1[0-9]|20)/i },
  { name: 'moment', pattern: /"moment"\s*:\s*["'~^]*2\.29\.(?:0|1|2|3)["']?/i },
  { name: 'moment', pattern: /moment@[^\\n]*2\.29\.(?:0|1|2|3)/i },
  { name: 'jquery', pattern: /"jquery"\s*:\s*["'~^]*(?:1\.\d+\.\d+|2\.\d+\.\d+|3\.4\.\d+)["']?/i },
  { name: 'jquery', pattern: /jquery@[^\\n]*(?:1\.\d+\.\d+|2\.\d+\.\d+|3\.4\.\d+)/i }
] as const;

export const vulnerableDependenciesRule: AuditRule = {
  id: 'PP019',
  title: 'Potential vulnerable dependency version',
  tags: ['security', 'dependencies', 'owasp-a06'],
  run(context): Finding[] {
    return context.addedLines
      .filter((line) => dependencyManifestPattern.test(line.filePath) && matchesVulnerableDependency(line.content))
      .map((line) =>
        createFinding({
          ruleId: vulnerableDependenciesRule.id,
          severity: 'high',
          confidence: 'medium',
          title: 'Dependency appears pinned to a known vulnerable version',
          description: 'The diff adds a dependency version that matches a known vulnerable version pattern.',
          line,
          recommendation: 'Upgrade the dependency to a patched release and verify the fix against the relevant security advisory.',
          tags: vulnerableDependenciesRule.tags
        })
      );
  }
};

function matchesVulnerableDependency(content: string): boolean {
  return vulnerableDependencyPatterns.some(({ pattern }) => pattern.test(content));
}
