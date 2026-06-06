import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import {
  AiRemediationResponse,
  AiReviewResponse,
  AiSettingsEnvelope,
  AiSettingsResponse,
  ApiKeyListResponse,
  ApiKeyRecord,
  HealthResponse,
  ProjectListResponse,
  ProjectRecord,
  ProjectSummaryEnvelope,
  ProjectSummaryResponse,
  ScanListResponse,
  ScanRecord,
  UsageEventRecord,
} from './patchproof.types';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PatchProofApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  getHealth(): Promise<HealthResponse> {
    return firstValueFrom(this.http.get<HealthResponse>(`${this.baseUrl}/health`));
  }

  listProjects(): Promise<ProjectListResponse> {
    return firstValueFrom(this.http.get<ProjectListResponse>(`${this.baseUrl}/projects`));
  }

  createProject(params: { name: string; description?: string; slug?: string }): Promise<{ data: ProjectRecord }> {
    const body: Record<string, string> = {
      name: params.name.trim(),
    };

    if (params.description?.trim()) {
      body['description'] = params.description.trim();
    }

    if (params.slug?.trim()) {
      body['slug'] = params.slug.trim();
    }

    return firstValueFrom(this.http.post<{ data: ProjectRecord }>(`${this.baseUrl}/projects`, body));
  }

  deleteProject(projectId: number, adminKey?: string): Promise<{ data: { deleted: boolean; project: Pick<ProjectRecord, 'id' | 'name' | 'slug'> } }> {
    return firstValueFrom(
      this.http.delete<{ data: { deleted: boolean; project: Pick<ProjectRecord, 'id' | 'name' | 'slug'> } }>(
        `${this.baseUrl}/projects/${projectId}`,
        {
          headers: this.buildAdminHeaders(adminKey),
        }
      )
    );
  }

  getProjectSummary(projectId: number): Promise<ProjectSummaryResponse> {
    return firstValueFrom(
      this.http.get<ProjectSummaryEnvelope>(`${this.baseUrl}/projects/${projectId}/summary`)
    ).then((response) => response.data);
  }

  getAiSettings(): Promise<AiSettingsResponse> {
    return firstValueFrom(this.http.get<AiSettingsEnvelope>(`${this.baseUrl}/settings/ai`)).then(
      (response) => response.data
    );
  }

  saveAiSettings(params: {
    enabled?: boolean;
    provider?: 'openai' | 'anthropic' | 'openai-compatible';
    model?: string;
    base_url?: string | null;
    api_key?: string | null;
    clear_api_key?: boolean;
  }): Promise<AiSettingsEnvelope> {
    const body: Record<string, string | boolean | null> = {};

    if (typeof params.enabled === 'boolean') {
      body['enabled'] = params.enabled;
    }

    if (params.provider) {
      body['provider'] = params.provider;
    }

    if (params.model?.trim()) {
      body['model'] = params.model.trim();
    }

    if (params.base_url !== undefined) {
      body['base_url'] = params.base_url?.trim() || null;
    }

    if (params.api_key !== undefined) {
      body['api_key'] = params.api_key?.trim() || null;
    }

    if (typeof params.clear_api_key === 'boolean') {
      body['clear_api_key'] = params.clear_api_key;
    }

    return firstValueFrom(this.http.put<AiSettingsEnvelope>(`${this.baseUrl}/settings/ai`, body));
  }

  listProjectScans(projectId: number, params: Record<string, string | number> = {}): Promise<ScanListResponse> {
    let httpParams = new HttpParams();

    for (const [key, value] of Object.entries(params)) {
      httpParams = httpParams.set(key, String(value));
    }

    return firstValueFrom(
      this.http.get<ScanListResponse>(`${this.baseUrl}/projects/${projectId}/scans`, {
        params: httpParams,
      })
    );
  }

  listProjectApiKeys(projectId: number): Promise<ApiKeyListResponse> {
    return this.listProjectApiKeysWithAdminKey(projectId);
  }

  listProjectApiKeysWithAdminKey(projectId: number, adminKey?: string): Promise<ApiKeyListResponse> {
    return firstValueFrom(
      this.http.get<ApiKeyListResponse>(`${this.baseUrl}/projects/${projectId}/api-keys`, {
        headers: this.buildAdminHeaders(adminKey),
      })
    );
  }

  revokeProjectApiKey(projectId: number, apiKeyId: number, adminKey?: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/projects/${projectId}/api-keys/${apiKeyId}`, {
        headers: this.buildAdminHeaders(adminKey),
      })
    );
  }

  createProjectApiKey(
    projectId: number,
    adminKey?: string,
    params: { name?: string } = {}
  ): Promise<{
    data: {
      project: Pick<ProjectRecord, 'id' | 'name' | 'slug'>;
      id: number;
      name: string | null;
      key_prefix: string;
      token: string;
    };
  }> {
    const body: Record<string, string> = {};

    if (params.name?.trim()) {
      body['name'] = params.name.trim();
    }

    return firstValueFrom(
      this.http.post<{
        data: {
          project: Pick<ProjectRecord, 'id' | 'name' | 'slug'>;
          id: number;
          name: string | null;
          key_prefix: string;
          token: string;
        };
      }>(`${this.baseUrl}/projects/${projectId}/api-keys`, body, {
        headers: this.buildAdminHeaders(adminKey),
      })
    );
  }

  submitScan(payload: {
      project_id: number;
      source?: string;
      language?: string;
      fail_on?: string;
      format?: string;
      status?: string;
      summary?: Record<string, number>;
      findings?: Record<string, unknown>[];
      metadata?: Record<string, unknown>;
      report_url?: string | null;
    }
  ): Promise<{ data: ScanRecord }> {
    return firstValueFrom(this.http.post<{ data: ScanRecord }>(`${this.baseUrl}/scans`, payload));
  }

  listUsageEvents(params: Record<string, string | number> = {}): Promise<{ data: UsageEventRecord[] }> {
    let httpParams = new HttpParams();

    for (const [key, value] of Object.entries(params)) {
      httpParams = httpParams.set(key, String(value));
    }

    return firstValueFrom(
      this.http.get<{ data: UsageEventRecord[] }>(`${this.baseUrl}/usage-events`, {
        params: httpParams,
      })
    );
  }

  generateAiRemediations(
    scanId: number,
    params: { apiKey?: string; model?: string } = {}
  ): Promise<{ data: AiRemediationResponse }> {
    const body: Record<string, string> = {};

    if (params.apiKey?.trim()) {
      body['api_key'] = params.apiKey.trim();
    }

    if (params.model?.trim()) {
      body['model'] = params.model.trim();
    }

    return firstValueFrom(
      this.http.post<{ data: AiRemediationResponse }>(
        `${this.baseUrl}/scans/${scanId}/remediations/ai`,
        body
      )
    );
  }

  generateAiReview(
    scanId: number,
    params: { apiKey?: string; model?: string } = {}
  ): Promise<{ data: AiReviewResponse }> {
    const body: Record<string, string> = {};

    if (params.apiKey?.trim()) {
      body['api_key'] = params.apiKey.trim();
    }

    if (params.model?.trim()) {
      body['model'] = params.model.trim();
    }

    return firstValueFrom(
      this.http.post<{ data: AiReviewResponse }>(`${this.baseUrl}/scans/${scanId}/review/ai`, body)
    );
  }

  private buildAdminHeaders(adminKey?: string): HttpHeaders | undefined {
    const trimmed = adminKey?.trim();

    if (!trimmed) {
      return undefined;
    }

    return new HttpHeaders({
      'X-PatchProof-Admin-Key': trimmed,
    });
  }

  private buildProjectHeaders(projectKey?: string): HttpHeaders | undefined {
    const trimmed = projectKey?.trim();

    if (!trimmed) {
      return undefined;
    }

    return new HttpHeaders({
      'X-PatchProof-Key': trimmed,
    });
  }
}
