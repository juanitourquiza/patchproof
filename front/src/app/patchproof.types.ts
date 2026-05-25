export interface ProjectRecord {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  scans_count?: number;
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
  metadata: Record<string, unknown>;
  report_url: string | null;
  created_at: string | null;
  updated_at: string | null;
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
