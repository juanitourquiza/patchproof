export interface ProjectRecord {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  scans_count?: number;
  latest_scan_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BreakdownEntry {
  severity?: string;
  language?: string;
  source?: string;
  count: number;
}

export interface ProjectSummaryResponse {
  project: ProjectRecord;
  totals: {
    scans: number;
    statuses: Record<string, number>;
  };
  breakdowns: {
    languages: BreakdownEntry[];
    sources: BreakdownEntry[];
    severities: BreakdownEntry[];
  };
  latest_scan_at: string | null;
  recent_scans: ScanRecord[];
  recent_usages: UsageEventRecord[];
}

export interface UsageEventRecord {
  id: number;
  project?: Pick<ProjectRecord, 'id' | 'name' | 'slug'>;
  scan_id: number | null;
  kind: string;
  source: string;
  language: string | null;
  fail_on: string | null;
  format: string | null;
  status: string | null;
  findings_total: number;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

export interface ScanRecord {
  id: number;
  project?: Pick<ProjectRecord, 'id' | 'name' | 'slug'>;
  source: string;
  language: string;
  fail_on: string;
  format: string;
  status: string;
  summary: Record<string, number>;
  findings: Array<Record<string, unknown>>;
  result?: ScanResultRecord;
  remediations?: RemediationRecord[];
  metadata: Record<string, unknown>;
  report_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ScanResultRecord {
  score: number;
  verdict: string;
  label: string;
  summary: string;
  recommendation: string;
  formula?: string;
  finding_total: number;
  severity: string;
}

export interface AiRemediationResponse {
  scan_id: number;
  source: string;
  provider: string;
  model: string;
  note?: string;
  remediations: RemediationRecord[];
}

export interface AiReviewSuggestion {
  title: string;
  severity: string;
  confidence: string;
  rationale: string;
  recommendation: string;
  category: string;
  needs_human_review: boolean;
}

export interface AiReviewResponse {
  scan_id: number;
  source: string;
  provider: string;
  model: string;
  summary: string;
  confidence_average: string;
  suggestions: AiReviewSuggestion[];
  note?: string;
}

export interface RemediationAction {
  title: string;
  description: string;
}

export interface RemediationRecord {
  rule_id: string | null;
  rule_title: string;
  finding_title: string;
  summary: string;
  source: string;
  confidence?: string;
  primary_fix: RemediationAction;
  alternatives: RemediationAction[];
  ai_prompt: string;
}

export interface ApiKeyRecord {
  id: number;
  name: string | null;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string | null;
}

export interface ProjectListResponse {
  data: ProjectRecord[];
}

export interface ApiKeyListResponse {
  data: ApiKeyRecord[];
}

export interface ScanListResponse {
  data: ScanRecord[];
  links?: unknown;
  meta?: unknown;
}

export interface ProjectSummaryEnvelope {
  data: ProjectSummaryResponse;
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  version: string;
}

export interface AiProviderOption {
  value: 'openai' | 'anthropic' | 'openai-compatible';
  label: string;
  description: string;
  needs_base_url: boolean;
}

export interface AiSettingsResponse {
  enabled: boolean;
  provider: AiProviderOption['value'];
  model: string;
  base_url: string | null;
  source: 'env' | 'database';
  api_key_source: 'env' | 'database' | 'none';
  api_key_configured: boolean;
  configured: boolean;
  available_providers: AiProviderOption[];
}

export interface AiSettingsEnvelope {
  data: AiSettingsResponse;
}
